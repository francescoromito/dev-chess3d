/**
 * Edit Version Modal Component
 * Allows editing/replacing images and models in an existing version
 */
import { useState, useRef } from 'react';
import { X, Upload, Image, Trash2, Check } from 'lucide-react';
import type { PieceVersion } from '../types';

interface EditVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EditVersionData) => void;
  isLoading: boolean;
  version: PieceVersion;
  getFileUrl: (path: string | null) => string | null;
}

export interface EditVersionData {
  version_name?: string;
  img_front?: File;
  img_back?: File;
  img_side_r?: File;
  img_side_l?: File;
  model_glb?: File;
  model_stl?: File;
}

type ImageField = 'img_front' | 'img_back' | 'img_side_r' | 'img_side_l';

export default function EditVersionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  version,
  getFileUrl,
}: EditVersionModalProps) {
  const [versionName, setVersionName] = useState(version.version_name);
  const [newImages, setNewImages] = useState<Partial<Record<ImageField, File>>>({});
  const [newModels, setNewModels] = useState<{ model_glb?: File; model_stl?: File }>({});
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<ImageField, string>>>({});
  
  const fileInputRefs = {
    img_front: useRef<HTMLInputElement>(null),
    img_back: useRef<HTMLInputElement>(null),
    img_side_r: useRef<HTMLInputElement>(null),
    img_side_l: useRef<HTMLInputElement>(null),
    model_glb: useRef<HTMLInputElement>(null),
    model_stl: useRef<HTMLInputElement>(null),
  };

  const imageLabels: Record<ImageField, string> = {
    img_front: 'Fronte',
    img_back: 'Retro',
    img_side_r: 'Destra',
    img_side_l: 'Sinistra',
  };

  if (!isOpen) return null;

  const handleImageChange = (field: ImageField, file: File | null) => {
    if (file) {
      setNewImages((prev) => ({ ...prev, [field]: file }));
      const url = URL.createObjectURL(file);
      setPreviewUrls((prev) => ({ ...prev, [field]: url }));
    }
  };

  const handleRemoveNewImage = (field: ImageField) => {
    setNewImages((prev) => {
      const newState = { ...prev };
      delete newState[field];
      return newState;
    });
    if (previewUrls[field]) {
      URL.revokeObjectURL(previewUrls[field]!);
      setPreviewUrls((prev) => {
        const newState = { ...prev };
        delete newState[field];
        return newState;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: EditVersionData = {};
    
    if (versionName !== version.version_name) {
      data.version_name = versionName;
    }
    
    Object.entries(newImages).forEach(([key, file]) => {
      data[key as ImageField] = file;
    });
    
    if (newModels.model_glb) data.model_glb = newModels.model_glb;
    if (newModels.model_stl) data.model_stl = newModels.model_stl;
    
    // Only submit if there are changes
    if (Object.keys(data).length > 0) {
      onSubmit(data);
    } else {
      onClose();
    }
  };

  const getCurrentImageUrl = (field: ImageField): string | null => {
    if (previewUrls[field]) return previewUrls[field]!;
    return getFileUrl(version[field]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Modifica Versione: {version.version_name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Version Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Versione
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Images Grid */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Image className="w-4 h-4 mr-2" />
                Immagini (clicca per sostituire)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(Object.keys(imageLabels) as ImageField[]).map((field) => {
                  const currentUrl = getCurrentImageUrl(field);
                  const hasNewImage = !!newImages[field];
                  
                  return (
                    <div key={field} className="relative">
                      <input
                        ref={fileInputRefs[field]}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(field, e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      
                      <div
                        onClick={() => fileInputRefs[field].current?.click()}
                        className={`
                          aspect-square rounded-lg border-2 border-dashed cursor-pointer
                          flex flex-col items-center justify-center overflow-hidden
                          transition-all hover:border-blue-400 hover:bg-blue-50
                          ${currentUrl ? 'border-gray-200 bg-gray-50' : 'border-gray-300'}
                          ${hasNewImage ? 'ring-2 ring-green-500' : ''}
                        `}
                      >
                        {currentUrl ? (
                          <>
                            <img
                              src={currentUrl}
                              alt={imageLabels[field]}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center transition-colors">
                              <Upload className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-xs text-gray-500">Carica</span>
                          </>
                        )}
                      </div>
                      
                      <p className="text-xs text-center text-gray-600 mt-1">
                        {imageLabels[field]}
                      </p>
                      
                      {hasNewImage && (
                        <div className="absolute top-1 right-1 flex gap-1">
                          <span className="bg-green-500 text-white p-1 rounded-full">
                            <Check className="w-3 h-3" />
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveNewImage(field);
                            }}
                            className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3D Models */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Modelli 3D
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {/* GLB Model */}
                <div>
                  <input
                    ref={fileInputRefs.model_glb}
                    type="file"
                    accept=".glb"
                    onChange={(e) => setNewModels((prev) => ({ ...prev, model_glb: e.target.files?.[0] }))}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.model_glb.current?.click()}
                    className={`
                      w-full py-3 px-4 border-2 border-dashed rounded-lg
                      flex flex-col items-center justify-center gap-2
                      transition-all hover:border-blue-400 hover:bg-blue-50
                      ${version.model_glb || newModels.model_glb ? 'border-green-300 bg-green-50' : 'border-gray-300'}
                    `}
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {newModels.model_glb?.name || (version.model_glb ? 'Modello GLB presente' : 'Carica GLB')}
                    </span>
                  </button>
                </div>

                {/* STL Model */}
                <div>
                  <input
                    ref={fileInputRefs.model_stl}
                    type="file"
                    accept=".stl"
                    onChange={(e) => setNewModels((prev) => ({ ...prev, model_stl: e.target.files?.[0] }))}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.model_stl.current?.click()}
                    className={`
                      w-full py-3 px-4 border-2 border-dashed rounded-lg
                      flex flex-col items-center justify-center gap-2
                      transition-all hover:border-blue-400 hover:bg-blue-50
                      ${version.model_stl || newModels.model_stl ? 'border-green-300 bg-green-50' : 'border-gray-300'}
                    `}
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {newModels.model_stl?.name || (version.model_stl ? 'Modello STL presente' : 'Carica STL')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvataggio...
                </>
              ) : (
                'Salva Modifiche'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
