/**
 * AI Studio Modal
 * Full-featured AI generation panel for a piece version.
 * - Shows existing slot images when available
 * - Allows img2img editing from a saved image
 * - Freehand drawing canvas for annotated edits
 * - Generates multi-view images and 3D models
 */
import { useState, useCallback } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image,
  Box,
  Wand2,
  Pencil,
  PlusCircle,
} from 'lucide-react';
import { aiApi, getFileUrl } from '../services/api';
import DrawingCanvas from './DrawingCanvas';
import { useQueryClient } from '@tanstack/react-query';
import type { ChessPieceWithVersions, PieceVersion, StagedFile, SlotField } from '../types';
import { SLOT_LABELS, STYLE_PRESETS } from '../types';

interface AIStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  piece: ChessPieceWithVersions;
  version: PieceVersion;
}

const IMAGE_SLOTS: SlotField[] = ['img_front', 'img_back', 'img_side_r', 'img_side_l'];
const MODEL_SLOTS: SlotField[] = ['model_glb', 'model_stl'];

type GenerationMode = 'text_to_image' | 'edit' | 'multiview' | 'model_3d';

/** What the user has chosen to do when the slot already has an image */
type EditAction = 'modify' | 'draw' | 'new' | null;

function detectBaseMode(
  slot: SlotField,
  version: PieceVersion,
): GenerationMode {
  if (MODEL_SLOTS.includes(slot)) return 'model_3d';
  const slotValue = version[slot as keyof PieceVersion] as string | null;
  if (slotValue) return 'edit';
  if (slot !== 'img_front' && version.img_front) return 'multiview';
  return 'text_to_image';
}

const MODE_LABELS: Record<GenerationMode, string> = {
  text_to_image: 'Genera da testo',
  edit: 'Modifica immagine esistente',
  multiview: 'Genera vista da Fronte',
  model_3d: 'Genera modello 3D',
};

export default function AIStudioModal({ isOpen, onClose, piece, version }: AIStudioModalProps) {
  const queryClient = useQueryClient();

  // Slot selection — default to first empty image slot, else img_front
  const defaultSlot: SlotField =
    (IMAGE_SLOTS.find((s) => !version[s as keyof PieceVersion]) as SlotField | undefined) ??
    'img_front';

  const [selectedSlot, setSelectedSlot] = useState<SlotField>(defaultSlot);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staged state
  const [staged, setStaged] = useState<StagedFile | null>(null);
  const [stagedHistory, setStagedHistory] = useState<StagedFile[]>([]);

  // Edit action — only relevant when slot already has an image and no staged result yet
  const [editAction, setEditAction] = useState<EditAction>(null);

  // Drawing canvas overlay
  const [showCanvas, setShowCanvas] = useState(false);

  // 3D job polling
  const [jobId, setJobId] = useState<string | null>(null);

  const baseMode = detectBaseMode(selectedSlot, version);

  // Effective generation mode considering editAction override
  const effectiveMode: GenerationMode = (() => {
    if (baseMode !== 'edit') return baseMode;
    if (editAction === 'new') return 'text_to_image';
    return 'edit'; // 'modify' or null (when staged exists)
  })();

  const slotValue = (slot: SlotField) => version[slot as keyof PieceVersion] as string | null;
  const currentSlotUrl = slotValue(selectedSlot) ? getFileUrl(slotValue(selectedSlot)) : null;

  const handleSelectSlot = (slot: SlotField) => {
    setSelectedSlot(slot);
    setStaged(null);
    setError(null);
    setSelectedPreset(null);
    setCustomPrompt('');
    setEditAction(null);
    setShowCanvas(false);
  };

  const buildPrompt = (): string => {
    const preset = STYLE_PRESETS.find((p) => p.id === selectedPreset);
    const pieceLabel = piece.name || piece.type;
    const base = customPrompt.trim() || pieceLabel;
    if (preset) return `${base}, ${preset.promptSuffix}, isolated on white background, front view reference`;
    return `${base}, chess piece, isolated on white background, front view reference`;
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedPreset && !customPrompt.trim()) {
      setError('Scegli uno stile o inserisci un prompt personalizzato');
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      let result: StagedFile;

      if (effectiveMode === 'text_to_image') {
        result = await aiApi.generateImage({
          prompt: buildPrompt(),
          style_preset: selectedPreset ?? undefined,
          piece_type: piece.type.toLowerCase(),
        });
      } else if (effectiveMode === 'edit') {
        if (staged) {
          result = await aiApi.editImage({ staged_id: staged.id, prompt: buildPrompt() });
        } else {
          // editAction === 'modify' → use saved image URL
          result = await aiApi.editImage({
            source_url: currentSlotUrl ?? undefined,
            prompt: buildPrompt(),
          });
        }
      } else if (effectiveMode === 'multiview') {
        const angleMap: Record<SlotField, 'back' | 'left' | 'right'> = {
          img_back: 'back',
          img_side_r: 'right',
          img_side_l: 'left',
          img_front: 'back',
          model_glb: 'back',
          model_stl: 'back',
        };
        const frontUrl = getFileUrl(version.img_front) ?? undefined;
        result = await aiApi.generateView({
          angle: angleMap[selectedSlot],
          source_url: frontUrl,
        });
      } else {
        // model_3d — start async job
        const imageUrls = IMAGE_SLOTS
          .map((s) => getFileUrl(version[s as keyof PieceVersion] as string | null))
          .filter(Boolean) as string[];
        const job = await aiApi.generate3D(imageUrls);
        setJobId(job.job_id);
        pollJob(job.job_id);
        return;
      }

      if (staged) setStagedHistory((h) => [staged, ...h].slice(0, 6));
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la generazione');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, selectedSlot, selectedPreset, customPrompt, staged, version, piece, currentSlotUrl]);

  const pollJob = async (id: string) => {
    setIsGenerating(true);
    try {
      // Poll every 3 seconds, max 20 attempts
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const job = await aiApi.pollJob(id);
        if (job.status === 'completed' && job.staged_id) {
          setStaged({ id: job.staged_id, preview_url: job.output_url! });
          setJobId(null);
          break;
        }
        if (job.status === 'failed') {
          setError('Generazione 3D fallita');
          setJobId(null);
          break;
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante il polling');
      setJobId(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!staged) return;
    setIsSaving(true);
    setError(null);
    try {
      await aiApi.confirmStaged(staged.id, version.id, selectedSlot);
      queryClient.invalidateQueries({ queryKey: ['piece', String(piece.id)] });
      setStaged(null);
      setStagedHistory([]);
      setEditAction(null);
      // Move to next empty slot automatically
      const nextEmpty = IMAGE_SLOTS.find(
        (s) => s !== selectedSlot && !version[s as keyof PieceVersion]
      ) as SlotField | undefined;
      if (nextEmpty) setSelectedSlot(nextEmpty);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!staged) return;
    await aiApi.discardStaged(staged.id).catch(() => {});
    setStaged(null);
    setEditAction(null);
  };

  const handleRestoreFromHistory = (item: StagedFile) => {
    if (staged) setStagedHistory((h) => [staged, ...h.filter((x) => x.id !== item.id)].slice(0, 6));
    setStaged(item);
  };

  const handleCanvasSubmit = async (blob: Blob, prompt: string) => {
    setIsAnnotating(true);
    setShowCanvas(false);
    setError(null);
    try {
      const result = await aiApi.annotatedEdit(blob, prompt);
      if (staged) setStagedHistory((h) => [staged, ...h].slice(0, 6));
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Errore durante l'invio annotazione");
    } finally {
      setIsAnnotating(false);
    }
  };

  if (!isOpen) return null;

  // Whether the current slot already has a saved image
  const slotHasSavedImage = !!slotValue(selectedSlot) && IMAGE_SLOTS.includes(selectedSlot);

  // Source URL for DrawingCanvas: prefer staged preview, fallback to saved slot URL
  const canvasBaseUrl = staged?.preview_url ?? currentSlotUrl ?? '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold text-lg">AI Studio</span>
            <span className="text-violet-200 text-sm">—</span>
            <span className="text-violet-100 text-sm">{piece.name || piece.type}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: Slot map */}
          <div className="w-52 shrink-0 border-r bg-gray-50 p-4 flex flex-col gap-2 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Slot</p>

            <p className="text-xs text-gray-400 mt-1">Immagini</p>
            {IMAGE_SLOTS.map((slot) => {
              const saved = slotValue(slot);
              const active = selectedSlot === slot;
              const thumbUrl = saved ? getFileUrl(saved) : null;
              return (
                <button
                  key={slot}
                  onClick={() => handleSelectSlot(slot)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    active
                      ? 'bg-violet-600 text-white shadow'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={SLOT_LABELS[slot]}
                      className="w-8 h-8 rounded object-cover shrink-0 border border-gray-200"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <Image className="w-4 h-4 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{SLOT_LABELS[slot]}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${saved ? 'bg-green-400' : 'bg-gray-300'}`}
                  />
                </button>
              );
            })}

            <p className="text-xs text-gray-400 mt-2">Modelli 3D</p>
            {MODEL_SLOTS.map((slot) => {
              const filled = !!slotValue(slot);
              const active = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => handleSelectSlot(slot)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    active
                      ? 'bg-violet-600 text-white shadow'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Box className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{SLOT_LABELS[slot]}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${filled ? 'bg-green-400' : 'bg-gray-300'}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right: Controls + Preview */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-0">
            {/* Controls section */}
            <div className="p-6 border-b">
              {/* Mode badge */}
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                  {MODE_LABELS[effectiveMode]}
                </span>
                <span className="text-xs text-gray-400">— {SLOT_LABELS[selectedSlot]}</span>
              </div>

              {effectiveMode === 'model_3d' ? (
                <p className="text-sm text-gray-600 mb-4">
                  Genera un modello 3D a partire dalle immagini caricate per questo pezzo.
                  {IMAGE_SLOTS.filter((s) => !!slotValue(s)).length === 0 && (
                    <span className="text-orange-600 font-medium ml-1">
                      Carica almeno un'immagine prima di generare il 3D.
                    </span>
                  )}
                </p>
              ) : (
                <>
                  {/* Style presets */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Stile rapido
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset.id === selectedPreset ? null : preset.id);
                          setError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          selectedPreset === preset.id
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                        }`}
                      >
                        <span>{preset.emoji}</span>
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom prompt toggle */}
                  <button
                    onClick={() => setShowPromptInput(!showPromptInput)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
                  >
                    {showPromptInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Personalizza prompt
                  </button>
                  {showPromptInput && (
                    <textarea
                      value={customPrompt}
                      onChange={(e) => { setCustomPrompt(e.target.value); setError(null); }}
                      placeholder={`Es: bishop chess piece, baroque style, gold and ivory...`}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                      rows={2}
                    />
                  )}
                </>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || isAnnotating || (effectiveMode === 'model_3d' && IMAGE_SLOTS.filter((s) => !!slotValue(s)).length === 0)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {jobId ? 'Generando 3D…' : 'Generando…'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Genera
                  </>
                )}
              </button>
            </div>

            {/* Preview section */}
            <div className="p-6 flex-1">
              {staged ? (
                /* ── Has a staged (newly generated) image ── */
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Anteprima generata
                  </p>
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                    {effectiveMode === 'model_3d' ? (
                      <div className="flex items-center justify-center h-40 text-gray-500 text-sm gap-2">
                        <Box className="w-5 h-5" />
                        Modello 3D pronto — usa "Salva" per applicarlo allo slot
                      </div>
                    ) : (
                      <img
                        src={staged.preview_url}
                        alt="Preview generata"
                        className="w-full max-h-72 object-contain"
                      />
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || isAnnotating}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Rigenera
                    </button>
                    {effectiveMode !== 'model_3d' && (
                      <button
                        onClick={() => setShowCanvas(true)}
                        disabled={isGenerating || isAnnotating}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Pencil className="w-4 h-4" />
                        Disegna e modifica
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Salva nello slot
                    </button>
                    <button
                      onClick={handleDiscard}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Scarta
                    </button>
                  </div>

                  {/* History */}
                  {stagedHistory.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Generazioni precedenti
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {stagedHistory.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleRestoreFromHistory(item)}
                            className="w-14 h-14 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 transition-colors"
                          >
                            <img
                              src={item.preview_url}
                              alt="History"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : slotHasSavedImage && editAction === null ? (
                /* ── Slot has existing image, user hasn't chosen an action yet ── */
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Immagine corrente
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-5">
                    <img
                      src={currentSlotUrl!}
                      alt="Immagine corrente"
                      className="w-full max-h-64 object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Cosa vuoi fare?
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => setEditAction('modify')}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 transition-colors text-left"
                    >
                      <Wand2 className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-violet-700">Modifica con AI</p>
                        <p className="text-xs text-violet-500 mt-0.5">Parti dall'immagine esistente e affina con un prompt</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setEditAction('draw'); setShowCanvas(true); }}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-colors text-left"
                    >
                      <Pencil className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-indigo-700">Disegna e modifica</p>
                        <p className="text-xs text-indigo-500 mt-0.5">Disegna sull'immagine (es. una chiazza) e descrivi la modifica all'AI</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setEditAction('new')}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 transition-colors text-left"
                    >
                      <PlusCircle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Genera nuova</p>
                        <p className="text-xs text-gray-400 mt-0.5">Ignora l'immagine attuale e genera da zero con un nuovo prompt</p>
                      </div>
                    </button>
                  </div>
                </>
              ) : isAnnotating ? (
                /* ── Sending annotated image ── */
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                  <p className="text-sm text-violet-600 font-medium">Invio annotazione all'AI…</p>
                </div>
              ) : (
                /* ── Empty slot or awaiting generation ── */
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <Sparkles className="w-10 h-10 text-gray-200" />
                  <p className="text-sm">
                    {isGenerating
                      ? 'Generazione in corso…'
                      : 'Scegli uno stile e premi Genera per creare un\'immagine'}
                  </p>
                  {isGenerating && <Loader2 className="w-5 h-5 animate-spin text-violet-400" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Drawing canvas overlay */}
      {showCanvas && canvasBaseUrl && (
        <DrawingCanvas
          baseImageUrl={canvasBaseUrl}
          isSubmitting={isAnnotating}
          onSubmit={handleCanvasSubmit}
          onCancel={() => setShowCanvas(false)}
        />
      )}
    </>
  );
}
