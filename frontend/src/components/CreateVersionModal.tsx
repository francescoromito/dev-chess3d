/**
 * Modal Component for Creating a New Piece Version
 */
import { useState, FormEvent, ChangeEvent, useRef, useEffect } from 'react';
import { X, Upload, RefreshCw, Wand2, ImagePlus } from 'lucide-react';
import type { CreateVersionRequest } from '../types';
import AIImageEditor from './AIImageEditor';

interface CreateVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVersionRequest) => void;
  isLoading: boolean;
}

export default function CreateVersionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateVersionModalProps) {
  const [versionName, setVersionName] = useState('');
  const [imgFront, setImgFront] = useState<File | undefined>();
  const [imgBack, setImgBack] = useState<File | undefined>();
  const [imgSideR, setImgSideR] = useState<File | undefined>();
  const [imgSideL, setImgSideL] = useState<File | undefined>();
  const [modelGlb, setModelGlb] = useState<File | undefined>();
  const [modelStl, setModelStl] = useState<File | undefined>();
  const imgFrontInputRef = useRef<HTMLInputElement | null>(null);
  const imgBackInputRef = useRef<HTMLInputElement | null>(null);
  const imgSideRInputRef = useRef<HTMLInputElement | null>(null);
  const imgSideLInputRef = useRef<HTMLInputElement | null>(null);
  const [imgFrontPreview, setImgFrontPreview] = useState<string | null>(null);
  const [imgBackPreview, setImgBackPreview] = useState<string | null>(null);
  const [imgSideRPreview, setImgSideRPreview] = useState<string | null>(null);
  const [imgSideLPreview, setImgSideLPreview] = useState<string | null>(null);
  
  // AI Editor state
  const [aiEditorOpen, setAiEditorOpen] = useState(false);
  const [currentEditingField, setCurrentEditingField] = useState<'front' | 'back' | 'sideR' | 'sideL' | null>(null);
  const [aiEditType, setAiEditType] = useState<'rotate_90_cw' | 'rotate_90_ccw' | 'back_view' | 'generic_edit'>('generic_edit');
  const [aiAutoSubmit, setAiAutoSubmit] = useState(false);

  useEffect(() => {
    let url: string | undefined;
    if (imgFront) {
      url = URL.createObjectURL(imgFront);
      setImgFrontPreview(url);
    } else {
      setImgFrontPreview(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [imgFront]);

  useEffect(() => {
    let url: string | undefined;
    if (imgBack) {
      url = URL.createObjectURL(imgBack);
      setImgBackPreview(url);
    } else {
      setImgBackPreview(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [imgBack]);

  useEffect(() => {
    let url: string | undefined;
    if (imgSideR) {
      url = URL.createObjectURL(imgSideR);
      setImgSideRPreview(url);
    } else {
      setImgSideRPreview(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [imgSideR]);

  useEffect(() => {
    let url: string | undefined;
    if (imgSideL) {
      url = URL.createObjectURL(imgSideL);
      setImgSideLPreview(url);
    } else {
      setImgSideLPreview(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [imgSideL]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      version_name: versionName,
      img_front: imgFront,
      img_back: imgBack,
      img_side_r: imgSideR,
      img_side_l: imgSideL,
      model_glb: modelGlb,
      model_stl: modelStl,
    });
    // Reset form
    setVersionName('');
    setImgFront(undefined);
    setImgBack(undefined);
    setImgSideR(undefined);
    setImgSideL(undefined);
    setModelGlb(undefined);
    setModelStl(undefined);
  };

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (file: File | undefined) => void
  ) => {
    const file = e.target.files?.[0];
    setter(file);
  };

  const openAIEditor = (
    field: 'front' | 'back' | 'sideR' | 'sideL', 
    editType: 'rotate_90_cw' | 'rotate_90_ccw' | 'back_view' | 'generic_edit' = 'generic_edit',
    autoSubmit: boolean = false
  ) => {
    setCurrentEditingField(field);
    setAiEditType(editType);
    setAiAutoSubmit(autoSubmit);
    setAiEditorOpen(true);
  };

  const handleAIGenerate = (generatedImages: File[]) => {
    // Take the first generated image and set it to the current field
    if (generatedImages.length > 0 && currentEditingField) {
      const firstImage = generatedImages[0];
      
      switch (currentEditingField) {
        case 'front':
          setImgFront(firstImage);
          break;
        case 'back':
          setImgBack(firstImage);
          break;
        case 'sideR':
          setImgSideR(firstImage);
          break;
        case 'sideL':
          setImgSideL(firstImage);
          break;
      }
    }
    
    // Close editor
    setAiEditorOpen(false);
    setCurrentEditingField(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Crea Nuova Versione
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="versionName" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Versione *
            </label>
            <input
              type="text"
              id="versionName"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Es. v1, bozza, finale..."
              disabled={isLoading}
            />
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Immagini</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Fronte</label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgFront"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgFront)}
                    className="hidden"
                    disabled={isLoading}
                    ref={imgFrontInputRef}
                  />

                  {/* Card with big "Genera" action and small upload + rigenera buttons in corner; show preview if available */}
                  <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative overflow-visible">
                    {imgFrontPreview ? (
                      <img src={imgFrontPreview} alt="Anteprima fronte" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : null}

                    {/* Generate button occupying whole card; semi-transparent when preview shown */}
                    <button
                      type="button"
                      onClick={() => openAIEditor('front')}
                      aria-label="Genera immagine fronte"
                      className={`absolute inset-0 z-10 flex items-center justify-center text-sm font-medium shadow ${imgFrontPreview ? 'bg-indigo-600/25 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'} rounded-lg`}
                    >
                      {imgFrontPreview ? <span className="sr-only">Genera con AI</span> : <>Genera con AI 🤖</>}
                    </button>

                    {/* Small upload & rigenerate buttons in top-right corner */}
                    <div className="absolute top-2 right-2 flex flex-col items-center gap-2 z-40">
                      {imgFront && (
                        <button
                          type="button"
                          onClick={() => openAIEditor('front')}
                          title="Rigenera immagine"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => imgFrontInputRef.current?.click()}
                        title="Carica immagine"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow text-gray-600 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>

                    {/* filename shown bottom-left if present (contrast with preview) */}
                    {/* filename hidden as requested */}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Retro</label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgBack"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgBack)}
                    className="hidden"
                    disabled={isLoading}
                    ref={imgBackInputRef}
                  />

                  <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative overflow-visible">
                    {imgBackPreview ? (
                      <img src={imgBackPreview} alt="Anteprima retro" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : null}

                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('back', 'back_view', true)}
                          title="Genera automaticamente dal fronte"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('back', 'back_view', false)}
                          title="Modifica partendo dal fronte"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col items-center gap-2 z-40">
                      <button
                        type="button"
                        onClick={() => imgBackInputRef.current?.click()}
                        title="Carica immagine"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow text-gray-600 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Destra</label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgSideR"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgSideR)}
                    className="hidden"
                    disabled={isLoading}
                    ref={imgSideRInputRef}
                  />

                  <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative overflow-visible">
                    {imgSideRPreview ? (
                      <img src={imgSideRPreview} alt="Anteprima destra" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : null}

                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('sideR', 'rotate_90_cw', true)}
                          title="Ruota automaticamente dal fronte (90° orario)"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('sideR', 'rotate_90_cw', false)}
                          title="Modifica ruotando dal fronte (90° orario)"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col items-center gap-2 z-40">
                      <button
                        type="button"
                        onClick={() => imgSideRInputRef.current?.click()}
                        title="Carica immagine"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow text-gray-600 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Sinistra</label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgSideL"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgSideL)}
                    className="hidden"
                    disabled={isLoading}
                    ref={imgSideLInputRef}
                  />

                  <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative overflow-visible">
                    {imgSideLPreview ? (
                      <img src={imgSideLPreview} alt="Anteprima sinistra" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : null}

                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('sideL', 'rotate_90_ccw', true)}
                          title="Ruota automaticamente dal fronte (90° antiorario)"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!imgFront}
                          onClick={() => openAIEditor('sideL', 'rotate_90_ccw', false)}
                          title="Modifica ruotando dal fronte (90° antiorario)"
                          className={`p-1.5 rounded shadow-sm transition-colors ${imgFront ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col items-center gap-2 z-40">
                      <button
                        type="button"
                        onClick={() => imgSideLInputRef.current?.click()}
                        title="Carica immagine"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow text-gray-600 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Modelli 3D</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modelGlb" className="block text-sm text-gray-700 mb-1">
                  File GLB (Anteprima)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="modelGlb"
                    accept=".glb"
                    onChange={(e) => handleFileChange(e, setModelGlb)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="modelGlb"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {modelGlb ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {modelGlb.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="modelStl" className="block text-sm text-gray-700 mb-1">
                  File STL (Stampa)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="modelStl"
                    accept=".stl"
                    onChange={(e) => handleFileChange(e, setModelStl)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="modelStl"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {modelStl ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {modelStl.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !versionName.trim()}
            >
              {isLoading ? 'Caricamento...' : 'Crea Versione'}
            </button>
          </div>
        </form>
      </div>

      {/* AI Image Editor */}
      <AIImageEditor
        isOpen={aiEditorOpen}
        onClose={() => setAiEditorOpen(false)}
        onGenerate={handleAIGenerate}
        initialImage={aiEditType !== 'generic_edit' ? imgFront : (currentEditingField === 'front' ? imgFront : currentEditingField === 'back' ? imgBack : currentEditingField === 'sideR' ? imgSideR : currentEditingField === 'sideL' ? imgSideL : undefined)}
        initialEditType={aiEditType}
        autoSubmit={aiAutoSubmit}
      />
    </div>
  );
}
