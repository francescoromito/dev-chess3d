/**
 * Model Card Component
 * Displays a 3D model file as a card with preview modal and edit capability
 */
import { useState, useRef, Suspense, useEffect } from 'react';
import { X, Download, Edit2, Box, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ModelViewer from './ModelViewer';
import sizePresets from '../config/sizePresets.json';
import { piecesApi } from '../services/api';

interface ModelCardProps {
  src: string;
  label: string;
  fileType: 'glb' | 'stl';
  onEdit?: (file: File) => void;
  onRemove?: () => void;
  pieceType?: string; // e.g. "king", "queen", "knight", etc.
  versionId?: number; // used for backend STL conversion
}

export default function ModelCard({ src, label, fileType, onEdit, onRemove, pieceType, versionId }: ModelCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const viewerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  // Scale and base plane controls
  const [modelScale, setModelScale] = useState({ x: 1, y: 1, z: 1 });
  const [baseSizeCm, setBaseSizeCm] = useState(sizePresets.presets.small.baseSizeCm);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; depth: number } | null>(null);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number; depth: number } | null>(null);
  const [lockProportions, setLockProportions] = useState(true);
  const [expandControls, setExpandControls] = useState(false);
  const [activePreset, setActivePreset] = useState<'small' | 'medium' | 'large' | 'current'>('current');
  // Snapshot captured when the modal opens — used by "Attuale" button
  const initialScaleRef = useRef({ x: 1, y: 1, z: 1 });
  const initialBaseSizeCmRef = useRef(sizePresets.presets.small.baseSizeCm);

  // Get default height for this piece type from a specific preset
  const getDefaultHeight = (preset: 'small' | 'medium' | 'large') => {
    const presetConfig = sizePresets.presets[preset];
    if (pieceType && pieceType in presetConfig.pieceHeights) {
      return (presetConfig.pieceHeights as Record<string, number>)[pieceType];
    }
    return presetConfig.defaultHeight;
  };

  // Apply a preset
  const applyPreset = (preset: 'small' | 'medium' | 'large') => {
    const presetConfig = sizePresets.presets[preset];
    setBaseSizeCm(presetConfig.baseSizeCm);
    setActivePreset(preset);
    
    // Also set height based on piece type for this preset
    const targetHeight = getDefaultHeight(preset);
    if (baseSize && baseSize.height > 0) {
      const newScale = targetHeight / baseSize.height;
      setModelScale({ x: newScale, y: newScale, z: newScale });
    }
  };

  // Handler for dimension change that maintains proportions
  const handleDimensionChange = (axis: 'x' | 'y' | 'z', newValue: number) => {
    if (!baseSize) return;
    
    // Calculate the new scale for this axis
    const baseDim = axis === 'x' ? baseSize.width : axis === 'y' ? baseSize.height : baseSize.depth;
    if (baseDim === 0) return;
    
    const newScale = newValue / baseDim;
    
    if (lockProportions) {
      // Apply same scale to all axes
      setModelScale({ x: newScale, y: newScale, z: newScale });
    } else {
      setModelScale(prev => ({ ...prev, [axis]: newScale }));
    }
  };

  // Hide loading after model is likely loaded + capture initial state for "Attuale"
  useEffect(() => {
    if (isOpen) {
      // Snapshot the current state so "Attuale" can restore it
      initialScaleRef.current = { ...modelScale };
      initialBaseSizeCmRef.current = baseSizeCm;
      setActivePreset('current');
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowFormatPicker(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore to the state captured when the modal was opened
  const applyCurrentPreset = () => {
    setModelScale({ ...initialScaleRef.current });
    setBaseSizeCm(initialBaseSizeCmRef.current);
    setActivePreset('current');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onEdit) {
      onEdit(file);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={fileType === 'glb' ? '.glb,.gltf' : '.stl'}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Card */}
      <div
        onClick={() => setIsOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-slate-700 to-slate-800 shadow-sm transition-all hover:shadow-lg hover:border-blue-400 hover:scale-[1.02]"
      >
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Rimuovi"
            className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600 hover:text-white" />
          </button>
        )}
        <div className="aspect-square flex flex-col items-center justify-center p-4">
          <Box className="w-12 h-12 text-slate-400 group-hover:text-blue-400 transition-colors mb-2" />
          <span className="text-xs text-slate-300 uppercase font-semibold tracking-wider">
            {fileType.toUpperCase()}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white text-sm font-medium">{label}</p>
        </div>
        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center">
          <span className="text-white text-xs opacity-0 group-hover:opacity-100 bg-blue-600 px-3 py-1 rounded-full transition-opacity">
            Visualizza 3D
          </span>
        </div>
      </div>

      {/* Modal with 3D Viewer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl h-[80vh] bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <Box className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">{label}</span>
                <span className="text-slate-400 text-sm">({fileType.toUpperCase()})</span>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                      Sostituisci
                    </button>
                    <button
                      onClick={() => setRotation({ x: 0, y: 0, z: 0 })}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                    >
                      Reset Rot
                    </button>
                    <button
                      onClick={async () => {
                        if (!viewerRef.current) return;
                        try {
                          setIsSaving(true);
                          console.log('Starting export, fileType:', fileType);
                          
                          let blob: Blob | null;
                          let fileName: string;
                          let mimeType: string;
                          
                          if (fileType === 'glb') {
                            // Export as GLB to preserve the format
                            console.log('Exporting as GLB...');
                            blob = await viewerRef.current.exportGLB();
                            fileName = 'modified.glb';
                            mimeType = 'model/gltf-binary';
                          } else {
                            // Export as STL
                            console.log('Exporting as STL...');
                            blob = await viewerRef.current.exportSTL();
                            fileName = 'modified.stl';
                            mimeType = 'model/stl';
                          }
                          
                          console.log('Export result:', blob, blob?.size);
                          if (!blob) throw new Error('Export fallito');
                          if (blob.size === 0) throw new Error('File esportato vuoto');
                          
                          const file = new File([blob], fileName, { type: mimeType });
                          console.log('File created:', file.name, file.size, file.type);
                          
                          // Use onEdit to save the file back to its original field
                          if (onEdit) {
                            console.log('Saving file...');
                            onEdit(file);
                          }
                          setIsOpen(false);
                        } catch (e) {
                          console.error('Save error:', e);
                          alert('Errore durante il salvataggio delle modifiche: ' + (e as Error).message);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm"
                    >
                      {isSaving ? 'Salvando...' : 'Salva Modifiche'}
                    </button>
                  </>
                )}
                {/* Download button with GLB/STL format picker */}
                <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!downloadLoading) setShowFormatPicker((v) => !v);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                  >
                    {downloadLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {downloadLoading ? 'Scaricamento...' : 'Scarica'}
                    {!downloadLoading && <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showFormatPicker && !downloadLoading && (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[110px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* GLB download */}
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowFormatPicker(false);
                          try {
                            setDownloadLoading(true);
                            const res = await fetch(src);
                            if (!res.ok) throw new Error('Network response was not ok');
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const safeLabel = label.replace(/[^a-z0-9\-_.]/gi, '_');
                            a.download = `${safeLabel}.glb`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          } catch {
                            alert('Errore durante il download GLB');
                          } finally {
                            setDownloadLoading(false);
                          }
                        }}
                      >
                        Scarica GLB
                      </button>

                      {/* STL download — only if versionId is available */}
                      {versionId != null && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 transition-colors border-t border-gray-100"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowFormatPicker(false);
                            try {
                              setDownloadLoading(true);
                              const { blob, filename } = await piecesApi.downloadVersionAsStl(versionId);
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = filename;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              window.URL.revokeObjectURL(url);
                            } catch {
                              alert('Errore durante la conversione STL');
                            } finally {
                              setDownloadLoading(false);
                            }
                          }}
                        >
                          Scarica STL
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 3D Viewer */}
              <div className="w-full h-full relative flex">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-5">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <span className="text-slate-400 text-sm">Caricamento modello 3D...</span>
                  </div>
                </div>
              )}
              <Suspense fallback={null}>
                <div className="flex-1">
                  <ModelViewer
                    key={src} // Force re-mount when URL changes
                    ref={viewerRef}
                    url={src}
                    fileType={fileType}
                    rotation={rotation}
                    scale={modelScale}
                    baseSizeCm={baseSizeCm}
                    onDimensions={(dims, base) => { setDimensions(dims); setBaseSize(base); }}
                  />
                </div>
                {/* Size and dimension controls - for both STL and GLB */}
                <div className="w-80 p-4 pt-16 bg-slate-800 border-l border-slate-700 overflow-y-auto">
                  {/* Size Presets Buttons */}
                  <h4 className="text-sm text-white mb-2">Dimensioni</h4>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={applyCurrentPreset}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activePreset === 'current'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Attuale
                    </button>
                    {(Object.keys(sizePresets.presets) as Array<'small' | 'medium' | 'large'>).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => applyPreset(preset)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activePreset === preset
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {sizePresets.presets[preset].label}
                      </button>
                    ))}
                  </div>

                  {/* Expander for advanced controls */}
                  <button
                    onClick={() => setExpandControls(!expandControls)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors mb-2"
                  >
                    <span>Controlli avanzati</span>
                    {expandControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {expandControls && (
                    <div className="space-y-4 p-3 bg-slate-900 rounded-lg">
                      {/* Base Plane */}
                      <div>
                        <h4 className="text-sm text-white mb-2">Piano base (cm)</h4>
                        <div className="mb-3">
                          <label className="text-xs text-slate-300">Lato: {baseSizeCm} cm</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.5}
                            value={baseSizeCm}
                            onChange={(e) => setBaseSizeCm(Number(e.target.value))}
                            className="w-full"
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={baseSizeCm}
                            onChange={(e) => setBaseSizeCm(Number(e.target.value))}
                            className="w-full mt-1 px-2 py-1 bg-slate-700 text-white text-xs rounded"
                          />
                          <p className="text-xs text-slate-400 mt-1">0 = nascosto</p>
                        </div>
                      </div>

                      <hr className="border-slate-600" />

                      {/* Model Dimensions */}
                      <div>
                        <h4 className="text-sm text-white mb-2 flex items-center justify-between">
                          <span>Dimensioni modello (cm)</span>
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lockProportions}
                              onChange={(e) => setLockProportions(e.target.checked)}
                              className="w-3 h-3"
                            />
                            🔗 Proporzioni
                          </label>
                        </h4>

                        {dimensions && baseSize && (
                          <div className="space-y-3 mb-4">
                            {/* Width (X) */}
                            <div>
                              <label className="text-xs text-slate-300">Larghezza (X): {dimensions.width.toFixed(2)} cm</label>
                              <input
                                type="range"
                                min={0.1}
                                max={100}
                                step={0.1}
                                value={dimensions.width}
                                onChange={(e) => handleDimensionChange('x', Number(e.target.value))}
                                className="w-full"
                              />
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={dimensions.width.toFixed(2)}
                                onChange={(e) => handleDimensionChange('x', Number(e.target.value))}
                                className="w-full mt-1 px-2 py-1 bg-slate-700 text-white text-xs rounded"
                              />
                            </div>
                            {/* Height (Y) */}
                            <div>
                              <label className="text-xs text-slate-300">Altezza (Y): {dimensions.height.toFixed(2)} cm</label>
                              <input
                                type="range"
                                min={0.1}
                                max={100}
                                step={0.1}
                                value={dimensions.height}
                                onChange={(e) => handleDimensionChange('y', Number(e.target.value))}
                                className="w-full"
                              />
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={dimensions.height.toFixed(2)}
                                onChange={(e) => handleDimensionChange('y', Number(e.target.value))}
                                className="w-full mt-1 px-2 py-1 bg-slate-700 text-white text-xs rounded"
                              />
                            </div>
                            {/* Depth (Z) */}
                            <div>
                              <label className="text-xs text-slate-300">Profondità (Z): {dimensions.depth.toFixed(2)} cm</label>
                              <input
                                type="range"
                                min={0.1}
                                max={100}
                                step={0.1}
                                value={dimensions.depth}
                                onChange={(e) => handleDimensionChange('z', Number(e.target.value))}
                                className="w-full"
                              />
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={dimensions.depth.toFixed(2)}
                                onChange={(e) => handleDimensionChange('z', Number(e.target.value))}
                                className="w-full mt-1 px-2 py-1 bg-slate-700 text-white text-xs rounded"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <hr className="border-slate-600" />

                      {/* Rotation controls - for both STL and GLB */}
                      <div>
                        <h4 className="text-sm text-white mb-2">Rotazione Modello (gradi)</h4>
                        {(['x', 'y', 'z'] as const).map((axis) => (
                          <div key={axis} className="mb-3">
                            <label className="text-xs text-slate-300">{axis.toUpperCase()}: {Math.round((rotation as any)[axis])}°</label>
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              value={(rotation as any)[axis]}
                              onChange={(e) => setRotation({ ...rotation, [axis]: Number(e.target.value) })}
                              className="w-full mb-1"
                            />
                            <div className="flex justify-between gap-1">
                              {[-180, -90, 0, 90, 180].map((val) => (
                                <button
                                  key={val}
                                  onClick={() => setRotation({ ...rotation, [axis]: val })}
                                  className="flex-1 px-1 py-1 bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-300 rounded transition-colors"
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Suspense>
            </div>

            {/* Controls hint at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-center text-slate-400 text-sm">
                🖱️ <span className="text-slate-300">Ruota:</span> click + trascina | 
                <span className="text-slate-300"> Zoom:</span> scroll | 
                <span className="text-slate-300"> Pan:</span> click destro + trascina |
                <span className="text-slate-300"> Passa sopra:</span> auto-rotazione
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
