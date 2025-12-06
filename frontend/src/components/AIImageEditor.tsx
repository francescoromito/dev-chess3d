/**
 * AI Image Editor Component
 * Full-screen modal for AI-powered image generation and editing
 * Reusable across multiple pages
 */
import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Send } from 'lucide-react';

interface AIImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate?: (prompt: string, selectedImages: File[]) => void;
  initialImage?: File;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  selected: boolean;
  order?: number | null;
}

export default function AIImageEditor({ 
  isOpen, 
  onClose, 
  onGenerate,
  initialImage 
}: AIImageEditorProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with initialImage if provided
  useEffect(() => {
    if (initialImage && isOpen) {
      const id = `img-${Date.now()}`;
      const preview = URL.createObjectURL(initialImage);
      setImages([{ id, file: initialImage, preview, selected: true }]);
      return () => URL.revokeObjectURL(preview);
    }
  }, [initialImage, isOpen]);

  // Cleanup previews on unmount or close
  useEffect(() => {
    if (!isOpen) {
      // Cleanup all previews when closing
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      setPrompt('');
      setSelectionWarning('');
    }
  }, [isOpen]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    const newImages: UploadedImage[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const id = `img-${Date.now()}-${Math.random()}`;
        const preview = URL.createObjectURL(file);
        newImages.push({ id, file, preview, selected: false, order: null });
      }
    });
    
    setImages(prev => [...prev, ...newImages]);
  };

  const toggleImageSelection = (id: string) => {
    setImages(prev => {
      const selected = prev.filter(i => i.selected).slice().sort((a,b)=> (a.order||0)-(b.order||0));
      const selectedCount = selected.length;
      const current = prev.find(i => i.id === id);
      if (!current) return prev;
      if (!current.selected && selectedCount >= 5) {
        setSelectionWarning('Puoi selezionare al massimo 5 immagini');
        window.setTimeout(() => setSelectionWarning(''), 3000);
        return prev;
      }

      if (!current.selected) {
        // select: assign next order
        return prev.map(i => i.id === id ? { ...i, selected: true, order: selectedCount + 1 } : i);
      } else {
        // deselect: remove order and decrement others
        const removedOrder = current.order || 0;
        return prev.map(i => {
          if (i.id === id) return { ...i, selected: false, order: null };
          if (i.order && i.order > removedOrder) return { ...i, order: i.order - 1 };
          return i;
        });
      }
    });
  };

  const removeImage = (id: string) => {
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    setImages(prev => prev.filter(i => i.id !== id));
  };

  const handleSubmit = () => {
    const selectedImages = images.filter(img => img.selected).map(img => img.file);
    if (onGenerate) {
      onGenerate(prompt, selectedImages);
    }
    // For now, just log - backend integration will come later
    console.log('Generate with prompt:', prompt, 'Images:', selectedImages);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            Editor AI Immagini
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
            title="Chiudi editor"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Image Gallery */}
          <div className="w-64 border-r bg-gray-50 flex flex-col">
            <div className="p-3 border-b bg-white">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Carica Immagini
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              {selectionWarning && (
                <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">{selectionWarning}</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-4 isolate auto-rows-[96px]">
              {images.length === 0 ? (
                <div className="col-span-2 text-center text-gray-400 text-sm mt-8">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  Nessuna immagine caricata
                </div>
              ) : (
                images.map(img => (
                  <div
                    key={img.id}
                    className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all h-full ${
                      img.selected 
                        ? 'border-indigo-500' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => toggleImageSelection(img.id)}
                  >
                    <div className="w-full h-full flex items-center justify-center bg-white p-2 box-border">
                      <img
                        src={img.preview}
                        alt="Uploaded"
                        className="object-contain w-auto h-full"
                      />
                    </div>
                    
                    {/* Selection order badge */}
                    {img.order && (
                      <div className="absolute top-2 left-2 bg-indigo-600 text-white rounded-full px-2 py-0.5 text-xs font-semibold">
                        {img.order}
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rimuovi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {images.length > 0 && (
              <div className="p-3 border-t bg-white text-xs text-gray-600">
                {images.filter(i => i.selected).length} di {images.length} selezionate
              </div>
            )}
          </div>

          {/* Center - Preview/Canvas Area */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center p-8">
            <div className="text-center text-gray-400">
              <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">Area Anteprima</p>
              <p className="text-sm">
                Le immagini generate appariranno qui
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Prompt Input */}
        <div className="border-t bg-white p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Descrivi l'immagine da generare o le modifiche da apportare
              </label>
              <textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. 'Un cavallo degli scacchi in stile moderno' o 'Rendi l'immagine più luminosa e aggiungi dettagli dorati'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium h-fit"
              title="Genera (Ctrl+Enter)"
            >
              <Send className="w-5 h-5" />
              Genera
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Suggerimento: Seleziona le immagini a sinistra da includere come riferimento
          </p>
        </div>
      </div>
    </div>
  );
}
