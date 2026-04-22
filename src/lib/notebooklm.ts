import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Use local worker via Vite Web Worker instantiation
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerPort) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
}

export async function processNotebookLmPdf(pdfBuffer: ArrayBuffer): Promise<Uint8Array> {
  // Clone the ArrayBuffer to prevent "Cannot perform Construct on a detached ArrayBuffer"
  // when pdf.js transfers the buffer to the Web Worker.
  const pdfBufferJs = pdfBuffer.slice(0);
  const pdfBufferLib = pdfBuffer.slice(0);

  const loadingTask = pdfjsLib.getDocument({ data: pdfBufferJs });
  const pdfDocJs = await loadingTask.promise;
  
  const pdfDocLib = await PDFDocument.load(pdfBufferLib);
  const libPages = pdfDocLib.getPages();
  const scale = 2.5; // High DPI for good inpainting accuracy
  
  // The area where we expect the watermark (in PDF points)
  // Slightly larger than 150x50 to be safe
  const targetWidthPts = 180;
  const targetHeightPts = 60;
  
  for (let i = 1; i <= pdfDocJs.numPages; i++) {
    const page = await pdfDocJs.getPage(i);
    const viewport = page.getViewport({ scale });
    
    // Render full page to canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    const patchWidthPx = targetWidthPts * scale;
    const patchHeightPx = targetHeightPts * scale;
    
    // Process the full page canvas, which will internally clean the bottom right portion
    const processedCanvas = processNotebookLmImage(canvas, patchWidthPx, patchHeightPx);
    
    // Extract JUST the inpainted bottom-right patch to save PDF size
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = patchWidthPx;
    patchCanvas.height = patchHeightPx;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) continue;
    
    patchCtx.drawImage(
      processedCanvas,
      canvas.width - patchWidthPx, canvas.height - patchHeightPx, patchWidthPx, patchHeightPx,
      0, 0, patchWidthPx, patchHeightPx
    );
    
    const pngDataUrl = patchCanvas.toDataURL('image/png', 1.0);
    const pngImageBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());
    const pngImage = await pdfDocLib.embedPng(pngImageBytes);
    
    // Paste the clean patch back onto the PDF directly covering the watermark
    const libPage = libPages[i - 1];
    const { width } = libPage.getSize();
    
    libPage.drawImage(pngImage, {
      x: width - targetWidthPts,
      y: 0, // In pdf-lib, y: 0 is the bottom edge
      width: targetWidthPts,
      height: targetHeightPts,
    });
  }
  
  return await pdfDocLib.save();
}

/**
 * Perform a FAST Median Blur (approx)
 */
function medianBlur(data: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  const side = radius * 2 + 1;
  const numPixels = side * side;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const rArr = [], gArr = [], bArr = [];
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.min(Math.max(y + dy, 0), h - 1);
          const nx = Math.min(Math.max(x + dx, 0), w - 1);
          const nidx = (ny * w + nx) * 4;
          rArr.push(data[nidx]);
          gArr.push(data[nidx+1]);
          bArr.push(data[nidx+2]);
        }
      }
      
      rArr.sort((a,b)=>a-b);
      gArr.sort((a,b)=>a-b);
      bArr.sort((a,b)=>a-b);
      const mid = Math.floor(numPixels/2);
      
      out[idx] = rArr[mid];
      out[idx+1] = gArr[mid];
      out[idx+2] = bArr[mid];
      out[idx+3] = data[idx+3];
    }
  }
  return out;
}

interface ComponentStat {
  label: number;
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

function getConnectedComponents(mask: Uint8Array, w: number, h: number): { labels: Int32Array, stats: ComponentStat[] } {
  const labels = new Int32Array(mask.length);
  let currentLabel = 1;
  const stats: ComponentStat[] = [];
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1 && labels[i] === 0) {
      let minX = i % w;
      let maxX = i % w;
      let minY = Math.floor(i / w);
      let maxY = Math.floor(i / w);
      let area = 0;
      
      const stack = [i];
      labels[i] = currentLabel;
      
      while (stack.length > 0) {
        const curr = stack.pop()!;
        area++;
        
        const cx = curr % w;
        const cy = Math.floor(curr / w);
        
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        
        // check 8 neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = ny * w + nx;
              if (mask[nIdx] === 1 && labels[nIdx] === 0) {
                labels[nIdx] = currentLabel;
                stack.push(nIdx);
              }
            }
          }
        }
      }
      
      stats.push({
        label: currentLabel,
        area,
        minX, maxX, minY, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      });
      currentLabel++;
    }
  }
  return { labels, stats };
}

export function processNotebookLmImage(image: HTMLImageElement | HTMLCanvasElement, coverWidth: number = 300, coverHeight: number = 100): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  
  ctx.drawImage(image, 0, 0);
  
  const startX = Math.max(0, canvas.width - coverWidth);
  const startY = Math.max(0, canvas.height - coverHeight);
  const w = Math.min(coverWidth, canvas.width);
  const h = Math.min(coverHeight, canvas.height);
  
  if (w <= 0 || h <= 0) return canvas;

  const imgData = ctx.getImageData(startX, startY, w, h);
  const data = imgData.data;
  
  // 1. Create heavily median-blurred background to isolate thin text structure exactly like cv2.medianBlur
  const blurRadius = Math.max(2, Math.min(5, Math.floor(Math.min(w, h) / 12))); 
  const background = medianBlur(data, w, h, blurRadius);
  
  // 2. Identify the accurate watermark mask using Absolute Difference + Threshold
  const rawMask = new Uint8Array(w * h);
  const threshold = 25; // 灵敏度阈值 (pixel threshold)
  
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const diffR = Math.abs(data[idx] - background[idx]);
    const diffG = Math.abs(data[idx+1] - background[idx+1]);
    const diffB = Math.abs(data[idx+2] - background[idx+2]);
    // gray difference
    const diffGray = diffR * 0.299 + diffG * 0.587 + diffB * 0.114;
    if (diffGray > threshold) {
      rawMask[i] = 1;
    }
  }

  // Connected Components Filtering to remove borders, lines, and noise
  const { labels, stats } = getConnectedComponents(rawMask, w, h);
  const validLabels = new Set<number>();
  for (const comp of stats) {
    if (comp.area < 2) continue; // Noise
    // Lines/borders usually have huge width/height. Watermark text/icon is relatively small.
    if (comp.width > 180 || comp.height > 45) continue;
    // Lines entering the ROI from outside will touch the top/left edges of our 300x100 box
    if (comp.minX <= 2 || comp.minY <= 2) continue; 
    
    validLabels.add(comp.label);
  }

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < rawMask.length; i++) {
    if (rawMask[i] === 1 && validLabels.has(labels[i])) {
      mask[i] = 1;
    }
  }
  
  // 3. Morphological Dilation to cover the anti-aliased edge pixels perfectly (radius 3)
  const dilatedMask = new Uint8Array(w * h);
  const dilateR = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        for (let dy = -dilateR; dy <= dilateR; dy++) {
          for (let dx = -dilateR; dx <= dilateR; dx++) {
            // circular structuring element
            if (dx*dx + dy*dy <= dilateR*dilateR + 1) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                dilatedMask[ny * w + nx] = 1;
              }
            }
          }
        }
      }
    }
  }
  
  // 4. Onion-Peel Inpainting (Fast Marching approximation)
  // Fill from the edges of the mask inwards, picking up the unmasked background colors.
  const buffer = new Uint8ClampedArray(data);
  let maskedCount = 0;
  for(let i=0; i<w*h; i++) if(dilatedMask[i]) maskedCount++;
  
  let loopProtect = 1000;
  while (maskedCount > 0 && loopProtect-- > 0) {
    const toFill = []; // {idx, r, g, b}
    
    // Find all boundary pixels of the mask
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (dilatedMask[i] === 1) {
          // Look for unmasked neighbors
          let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                const ni = ny * w + nx;
                if (dilatedMask[ni] === 0) { // Found a filled/unmasked pixel!
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  const w_i = 1 / dist;
                  rSum += buffer[ni*4] * w_i;
                  gSum += buffer[ni*4+1] * w_i;
                  bSum += buffer[ni*4+2] * w_i;
                  weightSum += w_i;
                }
              }
            }
          }
          if (weightSum > 0) {
             toFill.push({
               i: i,
               r: Math.round(rSum / weightSum),
               g: Math.round(gSum / weightSum),
               b: Math.round(bSum / weightSum)
             });
          }
        }
      }
    }
    
    // Apply fillings simultaneously
    for (const p of toFill) {
      buffer[p.i*4] = p.r;
      buffer[p.i*4+1] = p.g;
      buffer[p.i*4+2] = p.b;
      dilatedMask[p.i] = 0; // Mark as unmasked!
      maskedCount--;
    }
    
    // If no boundary found but maskedCount > 0, break to avoid infinite loop
    if (toFill.length === 0) break;
  }

  // 5. Apply the inpainted result back
  for (let i = 0; i < w * h; i++) {
    // Only where the original dilated mask was 1 (we ruined our dilatedMask in step 4, 
    // but we can just copy from `buffer` everything since buffer is untouched outside mask)
    data[i * 4] = buffer[i * 4];
    data[i * 4 + 1] = buffer[i * 4 + 1];
    data[i * 4 + 2] = buffer[i * 4 + 2];
  }
  
  ctx.putImageData(imgData, startX, startY);
  return canvas;
}
