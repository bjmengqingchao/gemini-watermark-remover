// Version: 1.0.1
// Application: Watermark Remover
import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  Download,
  Loader2,
  RefreshCw,
  Layers,
  Sliders,
  FileText,
  AlertCircle,
  Plus,
  X,
  Heart
} from "lucide-react";
import { WatermarkEngine } from "./lib/watermark";
import { processNotebookLmImage, processNotebookLmPdf } from "./lib/notebooklm";
import thanksImg from "./thanks.jpg";

type AppMode = "gemini" | "notebooklm";

interface UploadItem {
  id: string;
  originalUrl: string;
  processedUrl: string | null;
  isPdf: boolean;
  fileName: string;
  isProcessing: boolean;
  error?: string;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("gemini");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [engine, setEngine] = useState<WatermarkEngine | null>(null);
  const [layers, setLayers] = useState<number>(1);
  const [alphaGain, setAlphaGain] = useState<number>(1.0);
  const [downloadPending, setDownloadPending] = useState<{url: string, filename: string, isPdf: boolean} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    WatermarkEngine.create().then(setEngine).catch(console.error);
  }, []);

  const handleUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Check if there is any PDF.
    const pdfFile = fileArray.find((f) => f.type === "application/pdf");

    if (pdfFile) {
      // If a PDF is found, we ONLY process that single PDF (as per request)
      if (mode !== "notebooklm") {
        setMode("notebooklm");
      }
      
      const id = Math.random().toString(36).substring(7);
      const item: UploadItem = {
        id,
        originalUrl: URL.createObjectURL(pdfFile),
        processedUrl: null,
        isPdf: true,
        fileName: pdfFile.name,
        isProcessing: true,
      };

      setItems([item]); // Overwrite any existing things for PDF focus
      const buffer = await pdfFile.arrayBuffer();
      processItem(item.id, buffer, true, layers, alphaGain, "notebooklm");
    } else {
      // It's a batch of images
      const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const newItems: UploadItem[] = imageFiles.map((f) => ({
        id: Math.random().toString(36).substring(7),
        originalUrl: URL.createObjectURL(f),
        processedUrl: null,
        isPdf: false,
        fileName: f.name,
        isProcessing: true,
      }));

      setItems((prev) => [...prev, ...newItems]);

      newItems.forEach((item) => {
        // Pass current mode at start of processing
        processItem(item.id, item.originalUrl, false, layers, alphaGain, mode);
      });
    }
  };

  const updateItem = (id: string, partial: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...partial } : it))
    );
  };

  const processItem = async (
    id: string,
    fileData: string | ArrayBuffer,
    isPdfProcessing: boolean,
    currentLayers: number,
    currentGain: number,
    currentMode: AppMode
  ) => {
    try {
      if (isPdfProcessing) {
        if (currentMode === "notebooklm") {
          const processedBytes = await processNotebookLmPdf(fileData as ArrayBuffer);
          const processedBlob = new Blob([processedBytes], {
            type: "application/pdf",
          });
          updateItem(id, {
            processedUrl: URL.createObjectURL(processedBlob),
            isProcessing: false,
          });
        }
      } else {
        const imageUrl = fileData as string;
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        if (currentMode === "gemini") {
          if (!engine) throw new Error("Engine not initialized");
          const canvas = await engine.removeWatermarkFromImage(img, {
            layers: currentLayers,
            alphaGain: currentGain,
          });
          updateItem(id, {
            processedUrl: canvas.toDataURL("image/png"),
            isProcessing: false,
          });
        } else if (currentMode === "notebooklm") {
          const canvas = processNotebookLmImage(img);
          updateItem(id, {
            processedUrl: canvas.toDataURL("image/png"),
            isProcessing: false,
          });
        }
      }
    } catch (error) {
      console.error("处理文件出错:", error);
      updateItem(id, {
        isProcessing: false,
        error: error instanceof Error ? error.message : "处理文件失败，请重试。",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const reprocessAllImages = (newLayers: number, newGain: number) => {
    const images = items.filter((it) => !it.isPdf);
    if (images.length === 0) return;

    const ids = new Set(images.map((it) => it.id));

    setItems((prev) =>
      prev.map((it) =>
        ids.has(it.id)
          ? { ...it, processedUrl: null, isProcessing: true, error: undefined }
          : it
      )
    );

    images.forEach((img) => {
      // For images, fileData is originalUrl (string)
      processItem(img.id, img.originalUrl, false, newLayers, newGain, mode);
    });
  };

  const handleLayersChange = (newLayers: number) => {
    setLayers(newLayers);
    reprocessAllImages(newLayers, alphaGain);
  };

  const handleGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGain = parseFloat(e.target.value);
    setAlphaGain(newGain);
    reprocessAllImages(layers, newGain);
  };

  const resetState = () => {
    setItems([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (addMoreInputRef.current) addMoreInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center justify-center gap-3">
            <ImageIcon className="w-10 h-10 text-emerald-400" />
            AI 水印移除工具
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            支持批量上传图片或单个上传 PDF。所有处理均在您的浏览器中本地极速并发运行。
          </p>
        </header>

        <div className="flex justify-center mb-8">
          <div className="bg-zinc-900 rounded-full p-1 border border-zinc-800 flex">
            <button
              onClick={() => {
                setMode("gemini");
                resetState();
              }}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === "gemini"
                  ? "bg-emerald-500 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Gemini 水印 (图片)
            </button>
            <button
              onClick={() => {
                setMode("notebooklm");
                resetState();
              }}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === "notebooklm"
                  ? "bg-emerald-500 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              NotebookLM (图片/PDF)
            </button>
          </div>
        </div>

        {mode === "gemini" && (
          <div className="flex flex-wrap justify-center items-center gap-4 mb-4">
            <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-300">水印层数:</span>
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => handleLayersChange(num)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    layers === num
                      ? "bg-emerald-500 text-zinc-950"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-300">去除强度:</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={alphaGain}
                onChange={handleGainChange}
                className="w-24 accent-emerald-500"
              />
              <span className="text-sm text-zinc-400 w-8">
                {alphaGain.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/50 transition-colors rounded-3xl p-16 text-center cursor-pointer flex flex-col items-center justify-center min-h-[400px]"
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
              accept={mode === "gemini" ? "image/*" : "image/*,application/pdf"}
              className="hidden"
            />
            <div className="bg-zinc-900 p-4 rounded-full mb-6">
              <Upload className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-medium mb-2">点击或拖拽文件批量上传</h3>
            <p className="text-zinc-500">
              {mode === "gemini"
                ? "支持 PNG, JPG, WebP 格式的多图批量处理"
                : "支持批量图片处理或单次提交1份 PDF"}
            </p>
            {mode === "gemini" && !engine && (
              <div className="mt-8 flex items-center gap-2 text-amber-400/80 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在初始化引擎...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800 sticky top-4 z-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={resetState}
                  className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  ← 清空并重置
                </button>
                <div className="h-4 w-px bg-zinc-700" />
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  继续添加图片
                </button>
                <input
                  type="file"
                  multiple
                  ref={addMoreInputRef}
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  accept={mode === "gemini" ? "image/*" : "image/*,application/pdf"}
                  className="hidden"
                />
              </div>

              <div className="text-sm text-zinc-400">
                处理列表：共 {items.length} 个文件
              </div>
            </div>

            <div className="space-y-12">
              {items.map((item, index) => (
                <div key={item.id} className="space-y-4 pb-12 border-b border-zinc-800/50 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-medium text-zinc-300 flex items-center gap-2">
                      <span className="bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full text-xs">
                        #{index + 1}
                      </span>
                      {item.fileName}
                      {item.isPdf && <FileText className="w-4 h-4 text-emerald-400 ml-2" />}
                    </h3>

                    {item.processedUrl && (
                      <button
                        onClick={() => setDownloadPending({
                          url: item.processedUrl!,
                          filename: `no-watermark-${item.fileName}`,
                          isPdf: item.isPdf
                        })}
                        className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        下载此文件
                      </button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm text-zinc-500">原文件</h4>
                      <div className={`bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800/50 ${item.isPdf ? 'h-[60vh] min-h-[500px]' : 'aspect-video md:aspect-square'} flex items-center justify-center`}>
                        {item.isPdf ? (
                          <embed
                            src={item.originalUrl}
                            type="application/pdf"
                            className="w-full h-full"
                          />
                        ) : (
                          <img
                            src={item.originalUrl}
                            alt="原图"
                            className="max-w-full max-h-full object-contain"
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm text-zinc-500 flex items-center justify-between">
                        处理后
                        {item.isProcessing && (
                          <span className="flex items-center gap-2 text-emerald-400">
                            正在处理 <Loader2 className="w-3 h-3 animate-spin" />
                          </span>
                        )}
                        {item.error && (
                          <span className="flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            出错了
                          </span>
                        )}
                      </h4>
                      <div className={`bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800/50 ${item.isPdf ? 'h-[60vh] min-h-[500px]' : 'aspect-video md:aspect-square'} flex items-center justify-center relative shadow-inner`}>
                        {item.processedUrl ? (
                          item.isPdf ? (
                            <embed
                              src={item.processedUrl}
                              type="application/pdf"
                              className="w-full h-full"
                            />
                          ) : (
                            <img
                              src={item.processedUrl}
                              alt="处理后"
                              className="max-w-full max-h-full object-contain"
                            />
                          )
                        ) : item.error ? (
                          <div className="flex flex-col items-center gap-3 text-red-500 p-8 text-center bg-red-500/5 rounded-2xl">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm">{item.error}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 text-emerald-500/50">
                            <RefreshCw className="w-8 h-8 animate-spin" />
                            <p className="text-sm">引擎计算中...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {downloadPending && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative">
              <button
                onClick={() => setDownloadPending(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-[#07C160]/10 text-[#07C160] rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">支持一下开发者</h3>
              <p className="text-zinc-400 text-sm mb-6">
                处理完成！如果这个工具对您有帮助，欢迎使用微信扫码赞赏，金额随您心情定~ 
              </p>
              
              <div className="bg-white p-2 rounded-xl inline-block mb-6 shadow-sm border border-zinc-200 relative group overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-0 bg-zinc-50">
                  <span className="text-xs font-medium text-zinc-400">正在加载...</span>
                  <span className="text-[10px] text-zinc-400 mt-1 scale-90">若不显示请关闭广告拦截</span>
                </div>
                <img 
                  src={thanksImg} 
                  alt="图片" 
                  loading="eager"
                  fetchPriority="high"
                  className="w-48 h-48 rounded-lg object-contain relative z-10"
                />
                <p className="text-zinc-500 text-[10px] font-bold mt-2 text-center tracking-widest relative z-10 bg-white">扫一扫，支持开发者</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <a
                  href={downloadPending.url}
                  download={downloadPending.filename}
                  target={downloadPending.isPdf ? "_blank" : undefined}
                  onClick={() => setDownloadPending(null)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  保存文件
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
