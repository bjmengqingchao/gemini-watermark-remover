import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  Download,
  Loader2,
  RefreshCw,
  Layers,
  Sliders,
} from "lucide-react";
import { WatermarkEngine } from "./lib/watermark";

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [engine, setEngine] = useState<WatermarkEngine | null>(null);
  const [layers, setLayers] = useState<number>(1);
  const [alphaGain, setAlphaGain] = useState<number>(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    WatermarkEngine.create().then(setEngine).catch(console.error);
  }, []);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setOriginalImage(url);
    setProcessedImage(null);
    processImage(url, layers, alphaGain);
  };

  const processImage = async (
    imageUrl: string,
    currentLayers: number,
    currentGain: number,
  ) => {
    if (!engine) return;
    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = await engine.removeWatermarkFromImage(img, {
        layers: currentLayers,
        alphaGain: currentGain,
      });
      setProcessedImage(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("处理图片出错:", error);
      alert("处理图片失败，请重试。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLayersChange = (newLayers: number) => {
    setLayers(newLayers);
    if (originalImage) {
      setProcessedImage(null);
      processImage(originalImage, newLayers, alphaGain);
    }
  };

  const handleGainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGain = parseFloat(e.target.value);
    setAlphaGain(newGain);
    if (originalImage) {
      setProcessedImage(null);
      processImage(originalImage, layers, newGain);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center justify-center gap-3">
            <ImageIcon className="w-10 h-10 text-emerald-400" />
            Gemini 水印移除工具
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            上传您的 Gemini AI
            生成的图片，自动移除水印。所有处理均在您的浏览器中本地完成。
          </p>
        </header>

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
            <span className="text-sm text-zinc-400 w-8">{alphaGain.toFixed(2)}</span>
          </div>
        </div>

        {!originalImage ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/50 transition-colors rounded-3xl p-16 text-center cursor-pointer flex flex-col items-center justify-center min-h-[400px]"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) =>
                e.target.files?.[0] && handleImageUpload(e.target.files[0])
              }
              accept="image/*"
              className="hidden"
            />
            <div className="bg-zinc-900 p-4 rounded-full mb-6">
              <Upload className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-medium mb-2">点击或拖拽图片上传</h3>
            <p className="text-zinc-500">支持 PNG, JPG, WebP 格式</p>
            {!engine && (
              <div className="mt-8 flex items-center gap-2 text-amber-400/80 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在初始化引擎...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <button
                onClick={() => {
                  setOriginalImage(null);
                  setProcessedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                ← 上传另一张图片
              </button>

              {processedImage && (
                <a
                  href={processedImage}
                  download="gemini-no-watermark.png"
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-full font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载结果
                </a>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                  原图
                </h3>
                <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square flex items-center justify-center">
                  <img
                    src={originalImage}
                    alt="原图"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                  处理后
                  {isProcessing && (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  )}
                </h3>
                <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 aspect-square flex items-center justify-center relative">
                  {processedImage ? (
                    <img
                      src={processedImage}
                      alt="处理后"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-zinc-500">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      <p>正在移除水印...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
