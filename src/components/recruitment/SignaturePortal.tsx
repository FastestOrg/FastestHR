import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper, { Point, Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Upload, Crop, Trash2, CheckCircle, Info, FileSignature } from 'lucide-react';
import { toast } from 'sonner';

interface SignaturePortalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignatureReady: (signatureData: string) => void;
}

export function SignaturePortal({ isOpen, onClose, onSignatureReady }: SignaturePortalProps) {
  const [method, setMethod] = useState<'draw' | 'upload'>('draw');
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'crop' | 'preview'>('upload');
  const [preview, setPreview] = useState<string | null>(null);

  // Drawing Canvas references and states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Initialize canvas with transparent background
  useEffect(() => {
    if (isOpen && method === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isOpen, method]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImage(reader.result as string);
        setStep('crop');
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const removeBackground = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    // Simple background removal logic: if pixel is close to white, make it transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Threshold for "white" - can be adjusted
      if (r > 200 && g > 200 && b > 200) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  const generateCroppedImage = async () => {
    if (!image || !croppedAreaPixels) return;

    setProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = image;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const { x, y, width, height } = croppedAreaPixels;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Could not get canvas context');

      // Draw the cropped area
      ctx.drawImage(
        img,
        x, y, width, height,
        0, 0, width, height
      );

      // Remove background
      removeBackground(ctx, canvas);

      const finalImage = canvas.toDataURL('image/png');
      setPreview(finalImage);
      setStep('preview');
    } catch (err: any) {
      toast.error("Failed to process signature: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Drawing Canvas Methods
  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return lastPos;
      // Get the correct touch coordinates relative to canvas
      const touch = e.touches[0];
      return {
        x: ((touch.clientX - rect.left) / rect.width) * canvas.width,
        y: ((touch.clientY - rect.top) / rect.height) * canvas.height
      };
    } else {
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e, canvas);
    setLastPos(pos);
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep slate signing ink
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Validate that the canvas contains strokes and is not completely blank
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error("Please draw your signature before submitting.");
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    setPreview(dataUrl);
    setStep('preview');
  };

  const handleFinish = () => {
    if (preview) {
      onSignatureReady(preview);
      onClose();
    }
  };

  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setStep('upload');
    if (canvasRef.current) {
      clearCanvas();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-background/95 backdrop-blur-xl border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSignature className="h-5 w-5 text-primary" />
            Digital Offer Letter Signing
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sign your official contract document. FastestHR processes and secures your signature locally in your browser session.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Controllers */}
        {step !== 'preview' && (
          <div className="flex border-b border-border mt-2">
            <button
              onClick={() => { setMethod('draw'); setStep('upload'); }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all border-b-2 ${method === 'draw' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Draw Signature
            </button>
            <button
              onClick={() => { setMethod('upload'); setStep('upload'); }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all border-b-2 ${method === 'upload' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Upload Image File
            </button>
          </div>
        )}

        <div className="mt-4 min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden relative">
          {step === 'preview' && preview ? (
            <div className="flex flex-col items-center justify-center p-8 w-full gap-6">
              <div className="p-4 bg-white border rounded shadow-inner w-full flex justify-center items-center min-h-[100px] relative overflow-hidden signature-checkerboard-bg">
                <img src={preview} alt="Signature Preview" className="max-h-[80px] object-contain animate-in zoom-in-95" />
              </div>
              <p className="text-xs text-muted-foreground italic flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Signature generated and finalized successfully
              </p>
            </div>
          ) : method === 'draw' ? (
            <div className="w-full p-6 flex flex-col items-center gap-4">
              <div className="relative w-full border border-border rounded-lg overflow-hidden bg-white shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[150px] cursor-crosshair touch-none"
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="absolute bottom-2 right-2 text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded transition-colors"
                >
                  Clear Canvas
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 text-primary" />
                Use your mouse, trackpad, or touchscreen to draw your legal signature inside the box.
              </div>
            </div>
          ) : (
            // Upload Image Tab
            <>
              {step === 'upload' && (
                <div className="text-center p-8">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Click or drag image here</h3>
                  <p className="text-xs text-muted-foreground mb-4">PNG, JPG or SVG (Max 5MB)</p>
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                  <Button variant="outline" size="sm" className="pointer-events-none">
                    Browse Files
                  </Button>
                </div>
              )}

              {step === 'crop' && image && (
                <div className="relative w-full h-[350px]">
                  <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={4 / 1} // Signature shape
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border shadow-lg flex items-center gap-4 z-10 w-[80%]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zoom</span>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="zoom-range w-full"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-between items-center sm:justify-between">
          <div>
            {((method === 'upload' && step !== 'upload') || step === 'preview') && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {method === 'draw' && step !== 'preview' && (
              <Button size="sm" onClick={saveCanvasSignature} className="gap-2 bg-primary hover:bg-primary/90">
                <CheckCircle className="h-4 w-4" />
                Preview Signature
              </Button>
            )}
            {method === 'upload' && step === 'crop' && (
              <Button size="sm" onClick={generateCroppedImage} disabled={processing} className="gap-2">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
                Finalize Crop
              </Button>
            )}
            {step === 'preview' && (
              <Button size="sm" onClick={handleFinish} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <FileSignature className="h-4 w-4" />
                Use this Signature
              </Button>
            )}
          </div>
        </DialogFooter>

        <style dangerouslySetInnerHTML={{ __html: `
          .signature-checkerboard-bg {
            background-image: 
              linear-gradient(45deg, #f8fafc 25%, transparent 25%),
              linear-gradient(-45deg, #f8fafc 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #f8fafc 75%),
              linear-gradient(-45deg, transparent 75%, #f8fafc 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
