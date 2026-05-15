/**
 * DrawingCanvas — freehand drawing overlay on top of a base image.
 * Used in AI Studio so the user can annotate an image before sending it to the AI.
 *
 * Usage:
 *   <DrawingCanvas
 *     baseImageUrl="http://..."
 *     onSubmit={(blob, prompt) => { ... }}
 *     onCancel={() => { ... }}
 *   />
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Check, Eraser, Trash2, Minus, Plus } from 'lucide-react';

interface DrawingCanvasProps {
  baseImageUrl: string;
  onApplyDirectly: (blob: Blob) => void;
  onCancel: () => void;
}

type DrawMode = 'draw' | 'erase';

const COLOR_PRESETS = [
  { value: '#ef4444', label: 'Rosso' },
  { value: '#3b82f6', label: 'Blu' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#facc15', label: 'Giallo' },
  { value: '#ffffff', label: 'Bianco' },
  { value: '#000000', label: 'Nero' },
];

const CANVAS_SIZE = 512; // square canvas

export default function DrawingCanvas({
  baseImageUrl,
  onApplyDirectly,
  onCancel,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(8);
  const [mode, setMode] = useState<DrawMode>('draw');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Load base image onto the bottom canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      // Draw image scaled to fit canvas, maintaining aspect ratio
      const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (CANVAS_SIZE - w) / 2;
      const y = (CANVAS_SIZE - h) / 2;
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, x, y, w, h);
      setImageLoaded(true);
      setImageError(false);
    };
    img.onerror = () => {
      // If CORS blocks the image, draw a placeholder
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Immagine non caricabile (CORS)', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 10);
      ctx.fillText('Puoi comunque disegnare', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
      setImageLoaded(true);
      setImageError(true);
    };
    img.src = baseImageUrl;
  }, [baseImageUrl]);

  // Get canvas-relative position from mouse or touch event
  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      lastPos.current = pos;
      if (!pos) return;
      // Draw a dot on first click
      const ctx = overlayRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    [color, brushSize, mode]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const pos = getPos(e);
      if (!pos) return;
      const ctx = overlayRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastPos.current?.x ?? pos.x, lastPos.current?.y ?? pos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    },
    [color, brushSize, mode]
  );

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  const handleClear = () => {
    const ctx = overlayRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  };

  const handleApplyDirectly = () => {
    const composite = document.createElement('canvas');
    composite.width = CANVAS_SIZE;
    composite.height = CANVAS_SIZE;
    const ctx = composite.getContext('2d');
    if (!ctx) return;
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
    if (overlayRef.current) ctx.drawImage(overlayRef.current, 0, 0);
    composite.toBlob(
      (blob) => {
        if (blob) onApplyDirectly(blob);
      },
      'image/png'
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <span className="font-semibold">Disegna e modifica</span>
          <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50 flex-wrap">
          {/* Color presets */}
          <div className="flex items-center gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => { setColor(c.value); setMode('draw'); }}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  mode === 'draw' && color === c.value
                    ? 'border-violet-500 scale-125 shadow'
                    : 'border-gray-300 hover:scale-110'
                }`}
              />
            ))}
            {/* Custom color */}
            <label title="Colore personalizzato" className="relative cursor-pointer">
              <input
                type="color"
                value={color}
                onChange={(e) => { setColor(e.target.value); setMode('draw'); }}
                className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6"
              />
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-transform ${
                  mode === 'draw' && !COLOR_PRESETS.find((c) => c.value === color)
                    ? 'border-violet-500 scale-125 shadow'
                    : 'border-gray-300 hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              >
                +
              </div>
            </label>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Brush size */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setBrushSize((s) => Math.max(2, s - 2))}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs text-gray-600 w-5 text-center font-mono">{brushSize}</span>
            <button
              onClick={() => setBrushSize((s) => Math.min(60, s + 2))}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Eraser */}
          <button
            onClick={() => setMode(mode === 'erase' ? 'draw' : 'erase')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors ${
              mode === 'erase'
                ? 'bg-violet-100 text-violet-700 border border-violet-300'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Eraser className="w-4 h-4" />
            Gomma
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Cancella tutto
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-4 min-h-0">
          <div
            className="relative select-none"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, maxWidth: '100%', maxHeight: '100%' }}
          >
            {/* Base image canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="absolute inset-0 rounded-xl"
              style={{ imageRendering: 'pixelated' }}
            />
            {/* Drawing overlay canvas */}
            <canvas
              ref={overlayRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="absolute inset-0 rounded-xl"
              style={{
                cursor: mode === 'erase' ? 'cell' : 'crosshair',
                touchAction: 'none',
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-xl">
                <span className="text-sm text-gray-500">Caricamento immagine…</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 border-t">
          {imageError && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mb-3">
              L'immagine base non è caricabile a causa di restrizioni CORS. Puoi comunque disegnare sopra.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleApplyDirectly}
              disabled={!imageLoaded}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              Usa questa versione
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
