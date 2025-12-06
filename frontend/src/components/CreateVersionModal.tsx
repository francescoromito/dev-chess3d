/**
 * Modal Component for Creating a New Piece Version
 */
import { useState, FormEvent, ChangeEvent } from 'react';
import { X, Upload } from 'lucide-react';
import type { CreateVersionRequest } from '../types';

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
                <label htmlFor="imgFront" className="block text-sm text-gray-700 mb-1">
                  Fronte
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgFront"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgFront)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="imgFront"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {imgFront ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {imgFront.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="imgBack" className="block text-sm text-gray-700 mb-1">
                  Retro
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgBack"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgBack)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="imgBack"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {imgBack ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {imgBack.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="imgSideR" className="block text-sm text-gray-700 mb-1">
                  Destra
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgSideR"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgSideR)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="imgSideR"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {imgSideR ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {imgSideR.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="imgSideL" className="block text-sm text-gray-700 mb-1">
                  Sinistra
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="imgSideL"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImgSideL)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="imgSideL"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    {imgSideL ? (
                      <span className="text-sm text-gray-600 truncate px-2">
                        {imgSideL.name}
                      </span>
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </label>
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
    </div>
  );
}
