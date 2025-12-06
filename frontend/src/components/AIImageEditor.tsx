/**
 * AI Image Editor Component
 * Full-screen modal for AI-powered image generation and editing
 * Reusable across multiple pages
 */
import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import { aiApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AIImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate?: (generatedImages: File[]) => void;
  initialImage?: File;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  selected: boolean;
  order?: number | null;
}

type ModelName = 'fal-ai/nano-banana';

export default function AIImageEditor({ 
  isOpen, 
  onClose, 
  onGenerate,
  initialImage 
}: AIImageEditorProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectionWarning, setSelectionWarning] = useState('');
  const [modelName, setModelName] = useState<ModelName>('fal-ai/nano-banana');
  const [numImages, setNumImages] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreviews, setGeneratedPreviews] = useState<string[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<File[]>([]);
  const [selectedGeneratedIndex, setSelectedGeneratedIndex] = useState<number | null>(null);
  const [showGeneratedSelection, setShowGeneratedSelection] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pricePerImage, setPricePerImage] = useState<number>(0.039);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, refreshUser } = useAuth();

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
      generatedPreviews.forEach(url => URL.revokeObjectURL(url));
      setImages([]);
      setPrompt('');
      setSelectionWarning('');
      setGeneratedPreviews([]);
    }
  }, [isOpen]);

  // Fetch current price for selected model when editor opens or model changes
  useEffect(() => {
    let mounted = true;
    if (!isOpen) return;
    (async () => {
      try {
        const data = await aiApi.getPrice(modelName);
        if (mounted && data && typeof data.price_per_image === 'number') {
          setPricePerImage(data.price_per_image);
        }
      } catch (err) {
        // silently ignore and keep default price
        console.warn('Could not fetch price, using default', err);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, modelName]);

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

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    // Check if user has enough credits
    const totalCost = pricePerImage * numImages;
    if (!user || user.credits < totalCost) {
      alert(`Crediti insufficienti. Necessari: ${totalCost.toFixed(2)}, Disponibili: ${user?.credits.toFixed(2) || 0}`);
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Call backend to generate images
      const response = await aiApi.generateImages({
        prompt: prompt.trim(),
        model_name: modelName,
        num_images: numImages,
      });
      
      console.log('Generation response:', response);
      
      // Check if response has images
      if (!response || !response.images || !Array.isArray(response.images)) {
        throw new Error('Invalid response from server: ' + JSON.stringify(response));
      }
      
      // Fetch the generated images and convert to Files
      const generatedFiles: File[] = [];
      const previewUrls: string[] = [];
      
      for (let i = 0; i < response.images.length; i++) {
        const imageUrl = response.images[i].url;
        const imageResponse = await fetch(imageUrl);
        const blob = await imageResponse.blob();
        
        // Create File from blob
        const file = new File([blob], `generated-${Date.now()}-${i}.png`, { type: 'image/png' });
        generatedFiles.push(file);
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(blob);
        previewUrls.push(previewUrl);
      }
      
      setGeneratedPreviews(previewUrls);
      setGeneratedFiles(generatedFiles);
      setShowGeneratedSelection(true);
      setSelectedGeneratedIndex(null);
      
      // Deduct credits and refresh user data
      // Note: In a real app, the backend should handle this transaction
      // For now, we refresh to get the updated credits from backend
      await refreshUser();
      
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generazione fallita. Riprova. Errore: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyGenerated = () => {
    if (selectedGeneratedIndex === null) {
      alert('Seleziona un\'immagine');
      return;
    }

    const selectedFile = generatedFiles[selectedGeneratedIndex];
    
    // Pass the selected image back to parent and close
    if (onGenerate) {
      onGenerate([selectedFile]);
    }
    
    // Clean up before closing
    resetEditor();
    onClose();
  };

  const handleAddToStack = () => {
    if (selectedGeneratedIndex === null) {
      alert('Seleziona un\'immagine');
      return;
    }

    const selectedFile = generatedFiles[selectedGeneratedIndex];
    
    // Convert File to UploadedImage format
    const newImage: UploadedImage = {
      id: `gen-${Date.now()}`,
      file: selectedFile,
      preview: generatedPreviews[selectedGeneratedIndex],
      selected: false,
      order: null,
    };
    
    // Add to reference images for next iterations
    setImages([...images, newImage]);
    
    // Clear generated images and go back to main view
    setGeneratedPreviews([]);
    setGeneratedFiles([]);
    setShowGeneratedSelection(false);
    setShowConfirmModal(false);
    setSelectedGeneratedIndex(null);
  };

  const handleCancelGenerated = () => {
    // Clear generated images and go back
    setGeneratedPreviews([]);
    setGeneratedFiles([]);
    setShowGeneratedSelection(false);
    setShowConfirmModal(false);
    setSelectedGeneratedIndex(null);
  };

  const handleImageSelect = (index: number) => {
    setSelectedGeneratedIndex(index);
    setShowConfirmModal(true);
  };

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
    setSelectedGeneratedIndex(null);
  };

  const resetEditor = () => {
    // Clean up all previews
    images.forEach(img => URL.revokeObjectURL(img.preview));
    generatedPreviews.forEach(url => URL.revokeObjectURL(url));
    
    // Reset all state
    setImages([]);
    setPrompt('');
    setGeneratedPreviews([]);
    setGeneratedFiles([]);
    setShowGeneratedSelection(false);
    setShowConfirmModal(false);
    setSelectedGeneratedIndex(null);
    setIsGenerating(false);
  };

  // Reset when editor is closed
  useEffect(() => {
    if (!isOpen) {
      resetEditor();
    }
  }, [isOpen]);

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
            {isGenerating ? (
              <div className="text-center">
                <Loader2 className="w-16 h-16 mx-auto mb-4 text-indigo-600 animate-spin" />
                <p className="text-lg font-medium text-gray-700 mb-2">Generazione in corso...</p>
                <p className="text-sm text-gray-500">Questo potrebbe richiedere 10-30 secondi</p>
              </div>
            ) : showGeneratedSelection ? (
              <div className="w-full h-full flex flex-col">
                <div className="px-4 py-1.5 text-center flex-shrink-0 border-b bg-white">
                  <h3 className="text-sm font-medium">Seleziona un'immagine</h3>
                </div>
                <div className="flex-1 min-h-0 p-6">
                  <div className={`h-full grid gap-6 ${
                    generatedPreviews.length === 1 ? 'grid-cols-1' :
                    generatedPreviews.length === 2 ? 'grid-cols-2' :
                    'grid-cols-2 grid-rows-2'
                  }`}>
                    {generatedPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleImageSelect(idx)}
                        className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer transition-all hover:ring-4 hover:ring-indigo-400 flex items-center justify-center"
                      >
                        <img src={url} alt={`Generated ${idx + 1}`} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Cancel button */}
                <div className="flex justify-center py-1.5 border-t bg-white flex-shrink-0">
                  <button
                    onClick={handleCancelGenerated}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : generatedPreviews.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 max-w-4xl">
                {generatedPreviews.map((preview, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <img src={preview} alt={`Generated ${idx + 1}`} className="w-full h-auto object-contain" />
                    <div className="p-2 text-center text-sm text-gray-600">Variante {idx + 1}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Area Anteprima</p>
                <p className="text-sm">
                  Le immagini generate appariranno qui
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar - Prompt Input */}
        <div className="border-t bg-white p-4">
          {/* Settings Row */}
          <div className="flex gap-4 mb-3">
            <div className="flex-1">
              <label htmlFor="model-select" className="block text-xs font-medium text-gray-700 mb-1">
                Modello AI
              </label>
              <select
                id="model-select"
                value={modelName}
                onChange={(e) => setModelName(e.target.value as ModelName)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value="fal-ai/nano-banana">Nano Banana (Fast)</option>
              </select>
            </div>
            <div className="w-32">
              <label htmlFor="num-images-select" className="block text-xs font-medium text-gray-700 mb-1">
                Varianti
              </label>
              <select
                id="num-images-select"
                value={numImages}
                onChange={(e) => setNumImages(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              >
                <option value={1}>1 immagine</option>
                <option value={2}>2 immagini</option>
                <option value={3}>3 immagini</option>
                <option value={4}>4 immagini</option>
              </select>
            </div>
          </div>
          
          {/* Prompt Row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Descrivi l'immagine da generare
              </label>
              <textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. 'Un cavallo degli scacchi in stile moderno con dettagli dorati'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={2}
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isGenerating) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isGenerating}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium h-fit"
                title="Genera (Ctrl+Enter)"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Genera
                  </>
                )}
              </button>

              <div className="text-sm text-gray-700">
                <span className="font-medium">Costo:</span>{' '}
                <span className="font-semibold">💰{(pricePerImage * numImages).toFixed(2)}</span>
                <span className="text-gray-500"> (💰{pricePerImage.toFixed(2)}/immagine)</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Le immagini caricate a sinistra saranno usate come riferimento (max 5)
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedGeneratedIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
              <h3 className="text-xl font-bold">Cosa vuoi fare con questa immagine?</h3>
            </div>

            {/* Preview */}
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <img 
                  src={generatedPreviews[selectedGeneratedIndex]} 
                  alt="Selected" 
                  className="w-full h-64 object-contain"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleAddToStack}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-orange-400 rounded-xl hover:bg-orange-50 transition-all group"
                >
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <Upload className="w-8 h-8 text-orange-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-gray-900 mb-1">Continua Modifiche</div>
                    <div className="text-sm text-gray-600">Aggiungi allo stack e rigenera con questa come riferimento</div>
                  </div>
                </button>

                <button
                  onClick={handleApplyGenerated}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-indigo-400 rounded-xl hover:bg-indigo-50 transition-all group"
                >
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <ImageIcon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-gray-900 mb-1">Usa Immagine</div>
                    <div className="text-sm text-gray-600">Applica questa immagine e chiudi l'editor</div>
                  </div>
                </button>
              </div>

              {/* Cancel */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleCloseConfirmModal}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Indietro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
