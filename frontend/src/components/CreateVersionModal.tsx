/**
 * CreateVersionModal — AI-first wizard for creating a new piece version.
 *
 * Default tab: AI generation (style preset → generate → create)
 * Fallback tab: manual file upload (original behaviour)
 */
import { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from 'lucide-react';
import { piecesApi } from '../services/api';
import { aiApi } from '../services/api';
import type { StagedFile } from '../types';
import { STYLE_PRESETS } from '../types';

interface CreateVersionModalProps {
  isOpen: boolean;
  /** Piece ID — used by AI path to create the version via API directly */
  pieceId: number;
  /** Piece type label (e.g. "Bishop") — enhances AI prompts */
  pieceType: string;
  onClose: () => void;
  /** Called after successful creation (both AI and manual paths) */
  onSuccess: () => void;
}

// -------------------------------------------------------------------------
// Manual file-upload slot helper
// -------------------------------------------------------------------------
function FileSlot({
  id,
  label,
  accept,
  file,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  file: File | undefined;
  onChange: (f: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <input
        ref={ref}
        type="file"
        id={id}
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`w-full h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors text-xs
          ${file ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-400 text-gray-400'}`}
      >
        <Upload className="w-5 h-5" />
        {file ? <span className="truncate max-w-full px-1">{file.name}</span> : 'Carica'}
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------
// Main component
// -------------------------------------------------------------------------
export default function CreateVersionModal({
  isOpen,
  pieceId,
  pieceType,
  onClose,
  onSuccess,
}: CreateVersionModalProps) {
  // Shared
  const [tab, setTab] = useState<'ai' | 'manual'>('ai');
  const [versionName, setVersionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // AI path
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [staged, setStaged] = useState<StagedFile | null>(null);
  const [stagedHistory, setStagedHistory] = useState<StagedFile[]>([]);

  // Manual path
  const [imgFront, setImgFront] = useState<File | undefined>();
  const [imgBack, setImgBack] = useState<File | undefined>();
  const [imgSideR, setImgSideR] = useState<File | undefined>();
  const [imgSideL, setImgSideL] = useState<File | undefined>();
  const [modelGlb, setModelGlb] = useState<File | undefined>();
  const [modelStl, setModelStl] = useState<File | undefined>();
  const [isManualCreating, setIsManualCreating] = useState(false);

  const reset = () => {
    setTab('ai');
    setVersionName('');
    setError(null);
    setSelectedPreset(null);
    setCustomPrompt('');
    setShowPrompt(false);
    setIsGenerating(false);
    setIsCreating(false);
    setStaged(null);
    setStagedHistory([]);
    setImgFront(undefined);
    setImgBack(undefined);
    setImgSideR(undefined);
    setImgSideL(undefined);
    setModelGlb(undefined);
    setModelStl(undefined);
    setIsManualCreating(false);
  };

  const handleClose = () => {
    // Discard staged on close
    if (staged) aiApi.discardStaged(staged.id).catch(() => {});
    reset();
    onClose();
  };

  // ---- AI path ----

  const buildPrompt = useCallback((): string => {
    const preset = STYLE_PRESETS.find((p) => p.id === selectedPreset);
    const base = customPrompt.trim() || pieceType.toLowerCase();
    if (preset) return `${base} chess piece, ${preset.promptSuffix}, isolated on white background, front view reference`;
    return `${base} chess piece, isolated on white background, front view reference`;
  }, [selectedPreset, customPrompt, pieceType]);

  const handleGenerate = async () => {
    if (!selectedPreset && !customPrompt.trim()) {
      setError('Scegli uno stile o inserisci un prompt personalizzato');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result = await aiApi.generateImage({
        prompt: buildPrompt(),
        style_preset: selectedPreset ?? undefined,
        piece_type: pieceType.toLowerCase(),
      });
      if (staged) setStagedHistory((h) => [staged, ...h].slice(0, 5));
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la generazione');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateWithAI = async () => {
    if (!versionName.trim()) { setError('Inserisci un nome per la versione'); return; }
    if (!staged) { setError('Genera prima un\'immagine'); return; }
    setError(null);
    setIsCreating(true);
    try {
      // 1. Create empty version
      const version = await piecesApi.createVersion(pieceId, { version_name: versionName.trim() });
      // 2. Confirm staged → img_front
      await aiApi.confirmStaged(staged.id, version.id, 'img_front');
      reset();
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la creazione');
      setIsCreating(false);
    }
  };

  // ---- Manual path ----
  const handleCreateManual = async () => {
    if (!versionName.trim()) { setError('Inserisci un nome per la versione'); return; }
    setError(null);
    setIsManualCreating(true);
    try {
      await piecesApi.createVersion(pieceId, {
        version_name: versionName.trim(),
        img_front: imgFront,
        img_back: imgBack,
        img_side_r: imgSideR,
        img_side_l: imgSideL,
        model_glb: modelGlb,
        model_stl: modelStl,
      });
      reset();
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la creazione');
      setIsManualCreating(false);
    }
  };

  if (!isOpen) return null;

  const canGenerate = !isGenerating && (!!selectedPreset || customPrompt.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold text-lg">Nuova versione</span>
            <span className="text-violet-200 text-sm capitalize">— {pieceType}</span>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b">
          <button
            onClick={() => { setTab('ai'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'ai'
                ? 'border-violet-600 text-violet-700 bg-violet-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Genera con AI
          </button>
          <button
            onClick={() => { setTab('manual'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'manual'
                ? 'border-gray-600 text-gray-700 bg-gray-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            Carica file
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Version name — always visible */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome versione <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => { setVersionName(e.target.value); setError(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm"
              placeholder="Es. v1, marmo classico, bozza..."
            />
          </div>

          {/* ============ AI TAB ============ */}
          {tab === 'ai' && (
            <>
              {/* Style presets grid */}
              {!staged && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Scegli uno stile <span className="text-gray-400 font-normal text-xs">(o scrivi tu)</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {STYLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => { setSelectedPreset(preset.id === selectedPreset ? null : preset.id); setError(null); }}
                          className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all font-medium text-sm ${
                            selectedPreset === preset.id
                              ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm scale-[1.02]'
                              : 'border-gray-200 hover:border-violet-300 text-gray-600 hover:text-violet-700'
                          }`}
                        >
                          <span className="text-2xl">{preset.emoji}</span>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom prompt */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Descrizione personalizzata
                    </button>
                    {showPrompt && (
                      <textarea
                        value={customPrompt}
                        onChange={(e) => { setCustomPrompt(e.target.value); setError(null); }}
                        placeholder={`Es: ${pieceType.toLowerCase()} chess piece, baroque style, hand-crafted ivory and gold leaf...`}
                        rows={2}
                        className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                      />
                    )}
                  </div>
                </>
              )}

              {/* Preview */}
              {staged && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Immagine principale generata</p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={staged.preview_url}
                      alt="Preview"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                  {/* History */}
                  {stagedHistory.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-400 shrink-0">Precedenti:</span>
                      {stagedHistory.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setStagedHistory((h) => [staged, ...h.filter((x) => x.id !== item.id)].slice(0, 5));
                            setStaged(item);
                          }}
                          className="w-10 h-10 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 shrink-0"
                        >
                          <img src={item.preview_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {staged && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Rigenera
                  </button>
                )}

                {!staged ? (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Genera immagine principale</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateWithAI}
                    disabled={isCreating || !versionName.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    {isCreating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                    ) : (
                      <><Check className="w-4 h-4" /> Crea versione</>
                    )}
                  </button>
                )}
              </div>

              {!staged && (
                <p className="text-xs text-center text-gray-400">
                  Potrai generare le viste rimanenti dall'AI Studio dopo la creazione
                </p>
              )}
            </>
          )}

          {/* ============ MANUAL TAB ============ */}
          {tab === 'manual' && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Immagini</p>
                <div className="grid grid-cols-2 gap-3">
                  <FileSlot id="m-front" label="Fronte" accept="image/*" file={imgFront} onChange={setImgFront} />
                  <FileSlot id="m-back" label="Retro" accept="image/*" file={imgBack} onChange={setImgBack} />
                  <FileSlot id="m-sider" label="Destra" accept="image/*" file={imgSideR} onChange={setImgSideR} />
                  <FileSlot id="m-sidel" label="Sinistra" accept="image/*" file={imgSideL} onChange={setImgSideL} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Modelli 3D</p>
                <div className="grid grid-cols-2 gap-3">
                  <FileSlot id="m-glb" label="GLB (anteprima)" accept=".glb,.gltf" file={modelGlb} onChange={setModelGlb} />
                  <FileSlot id="m-stl" label="STL (stampa)" accept=".stl" file={modelStl} onChange={setModelStl} />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleCreateManual}
                  disabled={isManualCreating || !versionName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isManualCreating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                  ) : (
                    'Crea versione'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



