/**
 * AI Studio Modal
 * Full-featured AI generation panel for a piece version.
 * - Shows existing slot images when available
 * - Allows img2img editing from a saved image
 * - Freehand drawing canvas for annotated edits
 * - Generates multi-view images and 3D models
 */
import { useState, useCallback, useRef, useEffect } from 'react';
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
  Upload,
  Download,
  ListChecks,
  XCircle,
  Play,
} from 'lucide-react';
import { aiApi, piecesApi, getFileUrl } from '../services/api';
import DrawingCanvas from './DrawingCanvas';
import ModelCard from './ModelCard';
import { useQueryClient } from '@tanstack/react-query';
import type { ChessPieceWithVersions, PieceVersion, StagedFile, SlotField } from '../types';
import { SLOT_LABELS, STYLE_PRESETS } from '../types';

interface AIStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  piece: ChessPieceWithVersions;
  version: PieceVersion;
  defaultSlot?: SlotField;
  onDeleteVersion?: () => void;
}

const IMAGE_SLOTS: SlotField[] = ['img_front', 'img_back', 'img_side_r', 'img_side_l'];
const MODEL_SLOTS: SlotField[] = ['model_glb'];

type GenerationMode = 'text_to_image' | 'edit' | 'multiview' | 'model_3d';

/** History entry — may be AI-staged (id non-empty) or a local/uploaded image */
type HistoryEntry = StagedFile & { isLocal?: boolean; localFile?: File };

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

export default function AIStudioModal({ isOpen, onClose, piece, version, defaultSlot: initialSlot, onDeleteVersion }: AIStudioModalProps) {
  const queryClient = useQueryClient();

  // Slot selection — use provided defaultSlot, first empty image slot, or img_front
  const computedDefaultSlot: SlotField =
    initialSlot ??
    (IMAGE_SLOTS.find((s) => !version[s as keyof PieceVersion]) as SlotField | undefined) ??
    'img_front';

  const [selectedSlot, setSelectedSlot] = useState<SlotField>(computedDefaultSlot);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staged state
  const [staged, setStaged] = useState<HistoryEntry | null>(null);
  // Per-slot history — each slot has its own independent timeline
  const [slotHistories, setSlotHistories] = useState<Partial<Record<SlotField, HistoryEntry[]>>>({});
  // Derive current slot's history
  const history = slotHistories[selectedSlot] ?? [];
  // Write to the current slot's history
  const setHistory = useCallback(
    (updater: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => {
      setSlotHistories((prev) => {
        const cur = prev[selectedSlot] ?? [];
        const next = typeof updater === 'function' ? updater(cur) : updater;
        return { ...prev, [selectedSlot]: next };
      });
    },
    [selectedSlot],
  );

  // Edit queue — when multiple history items are queued, auto-advances as staged clears
  const [editQueue, setEditQueue] = useState<HistoryEntry[]>([]);
  // Multi-select mode for history
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedHistoryUrls, setSelectedHistoryUrls] = useState<Set<string>>(new Set());

  // Drawing canvas overlay
  const [showCanvas, setShowCanvas] = useState(false);

  // 3D job polling
  const [jobId, setJobId] = useState<string | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Force text_to_image even when a source image exists
  const [forceFromScratch, setForceFromScratch] = useState(false);

  // Version metadata editing
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState(version.version_name);
  const [metaDescription, setMetaDescription] = useState(version.version_description ?? '');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // ZIP download
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [downloadZipProgress, setDownloadZipProgress] = useState(0);

  // Sync meta state when version prop changes (e.g. after upload + query invalidation)
  useEffect(() => {
    setMetaName(version.version_name);
    setMetaDescription(version.version_description ?? '');
  }, [version.version_name, version.version_description]);

  const slotValue = (slot: SlotField) => version[slot as keyof PieceVersion] as string | null;
  const currentSlotUrl = slotValue(selectedSlot) ? getFileUrl(slotValue(selectedSlot)) : null;

  // Effective mode: edit if we have an image source, unless user forced from-scratch
  const effectiveMode: GenerationMode = (() => {
    if (MODEL_SLOTS.includes(selectedSlot)) return 'model_3d';
    if (forceFromScratch) return 'text_to_image';
    const hasStagedSource = !!(staged && staged.id && !staged.isLocal);
    const hasSlotSource = !!slotValue(selectedSlot);
    if (hasStagedSource || hasSlotSource) return 'edit';
    if (selectedSlot !== 'img_front' && version.img_front) return 'multiview';
    return 'text_to_image';
  })();

  // Auto-advance edit queue: when staged is cleared and queue has items, load next
  useEffect(() => {
    if (staged === null && editQueue.length > 0) {
      const [next, ...rest] = editQueue;
      setStaged(next);
      setEditQueue(rest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged]);

  // Dedup helper — per-slot, never lets the same preview_url appear twice
  const pushToHistory = useCallback((entry: HistoryEntry) => {
    setSlotHistories((prev) => {
      const h = prev[selectedSlot] ?? [];
      const next = [entry, ...h.filter((x) => x.preview_url !== entry.preview_url)].slice(0, 8);
      return { ...prev, [selectedSlot]: next };
    });
  }, [selectedSlot]);

  const handleSelectSlot = (slot: SlotField) => {
    if (slot === selectedSlot) return;
    // Save current staged to the LEAVING slot's history before switching
    if (staged) {
      const leavingSlot = selectedSlot;
      const leavingStaged = staged;
      setSlotHistories((prev) => {
        const h = prev[leavingSlot] ?? [];
        const next = [leavingStaged, ...h.filter((x) => x.preview_url !== leavingStaged.preview_url)].slice(0, 8);
        return { ...prev, [leavingSlot]: next };
      });
    }
    setSelectedSlot(slot);
    setStaged(null);
    setEditQueue([]);
    setIsMultiSelectMode(false);
    setSelectedHistoryUrls(new Set());
    setError(null);
    setSelectedPreset(null);
    setCustomPrompt('');
    setShowCanvas(false);
    setForceFromScratch(false);
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
        if (staged && staged.id && !staged.isLocal) {
          result = await aiApi.editImage({ staged_id: staged.id, prompt: buildPrompt() });
        } else {
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

      if (staged) pushToHistory(staged);
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la generazione');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, selectedSlot, selectedPreset, customPrompt, staged, version, piece, currentSlotUrl, pushToHistory]);

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

  const ANGLE_MAP: Partial<Record<SlotField, 'back' | 'left' | 'right'>> = {
    img_back: 'back',
    img_side_r: 'right',
    img_side_l: 'left',
  };

  // Returns the best available source URL from other slots (prefer img_front)
  const getBestSourceUrl = (): string | undefined => {
    const preferredOrder: SlotField[] = ['img_front', 'img_back', 'img_side_r', 'img_side_l'];
    for (const s of preferredOrder) {
      if (s === selectedSlot) continue;
      const v = slotValue(s);
      if (v) return getFileUrl(v) ?? undefined;
    }
    return undefined;
  };

  const handleGenerateFromViews = useCallback(async () => {
    const angle = ANGLE_MAP[selectedSlot];
    if (!angle) return;
    const sourceUrl = getBestSourceUrl();
    if (!sourceUrl) return;
    setError(null);
    setIsGenerating(true);
    try {
      const result = await aiApi.generateView({ angle, source_url: sourceUrl });
      if (staged) pushToHistory(staged);
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la generazione');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot, staged, version, pushToHistory]);

  /** Put selected history items into the edit queue */
  const handleEnqueueSelected = () => {
    const selected = history.filter((x) => selectedHistoryUrls.has(x.preview_url));
    if (selected.length === 0) return;
    // Remove them from history
    setSlotHistories((prev) => {
      const h = prev[selectedSlot] ?? [];
      return { ...prev, [selectedSlot]: h.filter((x) => !selectedHistoryUrls.has(x.preview_url)) };
    });
    setIsMultiSelectMode(false);
    setSelectedHistoryUrls(new Set());
    if (!staged) {
      const [first, ...rest] = selected;
      setStaged(first);
      setEditQueue(rest);
    } else {
      setEditQueue((q) => [...q, ...selected]);
    }
  };

  const handleSave = async () => {
    if (!staged) return;
    setIsSaving(true);
    setError(null);
    try {
      // Push old slot image into history before overwriting
      if (currentSlotUrl) {
        pushToHistory({ id: `slot-prev-${Date.now()}`, preview_url: currentSlotUrl, isLocal: true });
      }
      if (staged.isLocal && staged.localFile) {
        await piecesApi.updateVersion(version.id, { [selectedSlot]: staged.localFile });
      } else if (!staged.isLocal) {
        await aiApi.confirmStaged(staged.id, version.id, selectedSlot);
      }
      queryClient.invalidateQueries({ queryKey: ['piece', String(piece.id)] });
      setStaged(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardSlot = async () => {
    if (!currentSlotUrl) return;
    setError(null);
    try {
      // Save old slot URL before the query invalidation wipes it
      const oldUrl = currentSlotUrl;
      await piecesApi.deleteVersionFile(version.id, selectedSlot);
      queryClient.invalidateQueries({ queryKey: ['piece', String(piece.id)] });
      pushToHistory({ id: `slot-disc-${Date.now()}`, preview_url: oldUrl, isLocal: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante la rimozione');
    }
  };

  const handleDiscard = async () => {
    if (!staged) return;
    if (!staged.isLocal && staged.id) {
      await aiApi.discardStaged(staged.id).catch(() => {});
    }
    setStaged(null);
  };

  const handleRestoreFromHistory = (item: HistoryEntry) => {
    // Capture slot URL synchronously before any state updates
    const slotUrl = currentSlotUrl;
    setSlotHistories((prev) => {
      const h = prev[selectedSlot] ?? [];
      // Remove the clicked item
      const without = h.filter((x) => x.preview_url !== item.preview_url);
      const toAdd: HistoryEntry[] = [];
      if (staged && staged.preview_url !== item.preview_url) {
        // Push current staged back
        toAdd.push(staged);
      } else if (!staged && slotUrl && slotUrl !== item.preview_url) {
        // staged is null (e.g. after auto-save) — push slot image so it isn't lost
        toAdd.push({ id: `slot-cur-${Date.now()}`, preview_url: slotUrl, isLocal: true });
      }
      const merged = [
        ...toAdd,
        ...without.filter((x) => !toAdd.some((a) => a.preview_url === x.preview_url)),
      ];
      return { ...prev, [selectedSlot]: merged.slice(0, 8) };
    });
    setStaged(item);
  };

  const handleCanvasApply = useCallback((blob: Blob) => {
    const file = new File([blob], `canvas_edit_${Date.now()}.png`, { type: 'image/png' });
    const previewUrl = URL.createObjectURL(blob);
    if (staged) pushToHistory(staged);
    setStaged({ id: `canvas-${Date.now()}`, preview_url: previewUrl, isLocal: true, localFile: file });
    setShowCanvas(false);
  }, [staged, pushToHistory]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    // Build a HistoryEntry for each selected file
    const entries: HistoryEntry[] = files.map((file) => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      preview_url: URL.createObjectURL(file),
      isLocal: true,
      localFile: file,
    }));

    // All files except the last → history
    const historyEntries = entries.slice(0, -1);
    const lastEntry = entries[entries.length - 1];

    // Push current staged + old slot image + extra uploads into history atomically
    const slotToPush = selectedSlot;
    setSlotHistories((prev) => {
      const h = prev[slotToPush] ?? [];
      const toAdd: HistoryEntry[] = [];
      // current staged (if any)
      if (staged) toAdd.push(staged);
      // extra uploaded files (all but last), newest first
      toAdd.push(...historyEntries.reverse());
      const merged = [...toAdd, ...h];
      const seen = new Set<string>();
      const deduped = merged.filter((x) => {
        if (seen.has(x.preview_url)) return false;
        seen.add(x.preview_url);
        return true;
      });
      return { ...prev, [slotToPush]: deduped.slice(0, 8) };
    });

    // Auto-save the last file directly to the slot
    setIsUploading(true);
    setError(null);
    try {
      // Save existing slot image to history before overwriting
      if (currentSlotUrl) {
        const oldUrl = currentSlotUrl;
        setSlotHistories((prev) => {
          const h = prev[slotToPush] ?? [];
          const entry: HistoryEntry = { id: `slot-prev-${Date.now()}`, preview_url: oldUrl, isLocal: true };
          const next = [entry, ...h.filter((x) => x.preview_url !== oldUrl)].slice(0, 8);
          return { ...prev, [slotToPush]: next };
        });
      }
      await piecesApi.updateVersion(version.id, { [slotToPush]: lastEntry.localFile! });
      queryClient.invalidateQueries({ queryKey: ['piece', String(piece.id)] });
      setStaged(null);
    } catch (e: any) {
      // On failure, keep as staged so user can retry
      setStaged(lastEntry);
      setError(e?.response?.data?.detail ?? 'Errore durante il caricamento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMeta = async () => {
    setIsSavingMeta(true);
    setError(null);
    try {
      await piecesApi.updateVersionMetadata(version.id, {
        version_name: metaName.trim() || undefined,
        version_description: metaDescription.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['piece', String(piece.id)] });
      setIsEditingMeta(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante il salvataggio');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleDownloadZip = async () => {
    if (isDownloadingZip) return;
    setIsDownloadingZip(true);
    setDownloadZipProgress(0);
    try {
      const result = await piecesApi.downloadVersionZipWithProgress(
        version.id,
        (p) => setDownloadZipProgress(p)
      );
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `version_${version.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Errore durante il download');
    } finally {
      setIsDownloadingZip(false);
      setDownloadZipProgress(0);
    }
  };

  const handleDeleteVersion = () => {
    if (!confirm('Confermi la cancellazione di questa versione e dei suoi file?')) return;
    onDeleteVersion?.();
  };

  if (!isOpen) return null;

  // Whether the current slot already has a saved image
  const slotHasSavedImage = !!slotValue(selectedSlot) && IMAGE_SLOTS.includes(selectedSlot);
  const slotHasSavedModel = !!slotValue(selectedSlot) && MODEL_SLOTS.includes(selectedSlot);

  // Source URL for DrawingCanvas: prefer staged preview, fallback to saved slot URL
  const canvasBaseUrl = staged?.preview_url ?? currentSlotUrl ?? '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="relative w-full max-w-7xl h-[95vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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
            {/* Version name / metadata */}
            {isEditingMeta ? (
              <div className="mb-1">
                <input
                  type="text"
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-violet-300 rounded-lg mb-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="Nome versione"
                />
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-violet-300"
                  rows={2}
                  placeholder="Descrizione (opzionale)"
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    onClick={handleSaveMeta}
                    disabled={isSavingMeta || !metaName.trim()}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white rounded text-xs font-medium transition-colors"
                  >
                    {isSavingMeta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Salva
                  </button>
                  <button
                    onClick={() => { setIsEditingMeta(false); setMetaName(version.version_name); setMetaDescription(version.version_description ?? ''); }}
                    className="px-2 py-1 text-gray-500 hover:text-gray-700 border border-gray-200 rounded text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-1">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-gray-800 leading-tight flex-1 min-w-0 truncate">{version.version_name}</span>
                  <button
                    onClick={() => setIsEditingMeta(true)}
                    className="p-0.5 text-gray-400 hover:text-violet-600 transition-colors shrink-0"
                    title="Modifica nome e descrizione"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                {version.version_description && (
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{version.version_description}</p>
                )}
              </div>
            )}
            <div className="border-t border-gray-200 -mx-4 mb-1" />

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

            {/* Version actions */}
            <div className="mt-auto pt-3 border-t border-gray-200 flex flex-col gap-1">
              <button
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 w-full text-left"
              >
                {isDownloadingZip ? (
                  <><Loader2 className="w-4 h-4 animate-spin shrink-0" /><span>{downloadZipProgress > 0 ? `${downloadZipProgress}%` : 'Scaricando…'}</span></>
                ) : (
                  <><Download className="w-4 h-4 shrink-0" /><span>Scarica ZIP</span></>
                )}
              </button>
              {onDeleteVersion && (
                <button
                  onClick={handleDeleteVersion}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  Elimina versione
                </button>
              )}
            </div>
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

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {/* Genera dalle altre viste — primo, compatto, solo slot non-fronte */}
                {selectedSlot !== 'img_front' && !MODEL_SLOTS.includes(selectedSlot) && !!getBestSourceUrl() && (
                  <button
                    onClick={handleGenerateFromViews}
                    disabled={isGenerating || isAnnotating}
                    title="Genera questa vista partendo dalle altre immagini disponibili"
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Da altre viste
                  </button>
                )}

                {/* Genera */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isAnnotating || (effectiveMode === 'model_3d' && IMAGE_SLOTS.filter((s) => !!slotValue(s)).length === 0)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{jobId ? 'Generando 3D…' : 'Generando…'}</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Genera</>
                  )}
                </button>

                {/* Modifica (canvas) — only when source image exists */}
                {canvasBaseUrl && !MODEL_SLOTS.includes(selectedSlot) && (
                  <button
                    onClick={() => setShowCanvas(true)}
                    disabled={isGenerating || isAnnotating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Modifica
                  </button>
                )}

                {/* Crea da zero — toggle, only for image slots */}
                {!MODEL_SLOTS.includes(selectedSlot) && (
                  <button
                    onClick={() => {
                      const next = !forceFromScratch;
                      setForceFromScratch(next);
                      if (next) setShowPromptInput(true);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors border ${
                      forceFromScratch
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    {forceFromScratch ? 'Da zero attivo' : 'Crea da zero'}
                  </button>
                )}

                {/* Upload button */}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={MODEL_SLOTS.includes(selectedSlot) ? '.glb,.gltf' : 'image/*'}
                  multiple={!MODEL_SLOTS.includes(selectedSlot)}
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading || isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 rounded-lg font-medium transition-colors"
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Caricamento…</>
                  ) : (
                    <><Upload className="w-4 h-4" />Carica</>
                  )}
                </button>
              </div>
            </div>

            {/* Preview section */}
            <div className="p-6 flex-1 flex flex-col min-h-0 overflow-y-auto">

              {/* Edit queue indicator */}
              {editQueue.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                  <Play className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-xs text-violet-700 font-medium">In coda: {editQueue.length}</span>
                  <div className="flex gap-1 ml-1">
                    {editQueue.slice(0, 5).map((q, i) => (
                      <img key={i} src={q.preview_url} alt="" className="w-7 h-7 rounded object-cover border border-violet-200" />
                    ))}
                    {editQueue.length > 5 && (
                      <span className="w-7 h-7 rounded bg-violet-100 text-violet-600 text-xs flex items-center justify-center font-medium">
                        +{editQueue.length - 5}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditQueue([])}
                    className="ml-auto text-violet-400 hover:text-violet-600 transition-colors"
                    title="Svuota coda"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Image area */}
              {isAnnotating ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                  <p className="text-sm text-violet-600 font-medium">Invio annotazione all'AI…</p>
                </div>
              ) : staged ? (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {staged.isLocal ? 'Immagine caricata' : 'Anteprima generata'}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                    {effectiveMode === 'model_3d' ? (
                      <div className="flex items-center justify-center h-40 text-gray-500 text-sm gap-2">
                        <Box className="w-5 h-5" />
                        Modello 3D pronto — usa "Salva" per applicarlo allo slot
                      </div>
                    ) : (
                      <img src={staged.preview_url} alt="Preview" className="w-full max-h-64 object-contain" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {!staged.isLocal && (
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isAnnotating}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-4 h-4" />Rigenera
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={isSaving || (staged.isLocal && !staged.localFile)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Applica allo slot
                    </button>
                    <button
                      onClick={handleDiscard}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />Scarta
                    </button>
                  </div>
                </>
              ) : slotHasSavedModel ? (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Modello corrente</p>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 mb-4 flex flex-col items-center justify-center p-2 min-h-[500px]">
                    <div className="w-full h-full max-w-full">
                      <ModelCard
                        src={currentSlotUrl!}
                        label={version.version_name || "Anteprima Modello"}
                        fileType="glb"
                        pieceType={piece?.type}
                        versionId={version.id}
                        inlineViewer={true}
                        onEdit={async (file) => {
                          try {
                            await piecesApi.uploadSlotImage(piece.id, version.id, selectedSlot, file);
                            queryClient.invalidateQueries({ queryKey: ['pieces'] });
                          } catch (e) {
                            console.error(e);
                            alert('Errore durante il salvataggio del modello.');
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={handleDiscardSlot}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />Rimuovi dallo slot
                    </button>
                  </div>
                </>
              ) : slotHasSavedImage ? (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Immagine corrente</p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                    <img
                      src={currentSlotUrl!}
                      alt="Immagine corrente"
                      className="w-full max-h-64 object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={handleDiscardSlot}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />Rimuovi dallo slot
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                  <Sparkles className="w-10 h-10 text-gray-200" />
                  <p className="text-sm text-center">
                    {isGenerating
                      ? 'Generazione in corso…'
                      : forceFromScratch
                      ? 'Inserisci un prompt e premi Genera'
                      : "Scegli uno stile e premi Genera per creare un'immagine"}
                  </p>
                  {isGenerating && <Loader2 className="w-5 h-5 animate-spin text-violet-400" />}
                </div>
              )}

              {/* Cronologia — always visible */}
              <div className="mt-auto pt-4">
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cronologia</p>
                  {history.length > 0 && (
                    <div className="flex items-center gap-1">
                      {isMultiSelectMode && selectedHistoryUrls.size > 0 && (
                        <button
                          onClick={handleEnqueueSelected}
                          className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded text-xs font-medium transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Metti in coda ({selectedHistoryUrls.size})
                        </button>
                      )}
                      <button
                        onClick={() => { setIsMultiSelectMode((v) => !v); setSelectedHistoryUrls(new Set()); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border ${
                          isMultiSelectMode
                            ? 'bg-gray-100 text-gray-600 border-gray-300'
                            : 'bg-white text-gray-400 border-gray-200 hover:text-violet-600 hover:border-violet-300'
                        }`}
                      >
                        {isMultiSelectMode ? <XCircle className="w-3 h-3" /> : <ListChecks className="w-3 h-3" />}
                        {isMultiSelectMode ? 'Annulla' : 'Seleziona'}
                      </button>
                    </div>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="text-xs text-gray-300 italic">Nessuna immagine nella cronologia</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {history.map((item, idx) => {
                      const isSelected = selectedHistoryUrls.has(item.preview_url);
                      return (
                        <button
                          key={item.id || idx}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              setSelectedHistoryUrls((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.preview_url)) next.delete(item.preview_url);
                                else next.add(item.preview_url);
                                return next;
                              });
                            } else {
                              handleRestoreFromHistory(item);
                            }
                          }}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors relative shrink-0 ${
                            isMultiSelectMode
                              ? isSelected
                                ? 'border-violet-500 ring-2 ring-violet-300'
                                : 'border-transparent hover:border-violet-300'
                              : 'border-transparent hover:border-violet-400'
                          }`}
                          title={item.isLocal ? 'Immagine caricata' : 'Generazione precedente'}
                        >
                          <img src={item.preview_url} alt="Cronologia" className="w-full h-full object-cover" />
                          {/* Selection overlay */}
                          {isMultiSelectMode && isSelected && (
                            <span className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-violet-700 drop-shadow" />
                            </span>
                          )}
                          {item.isLocal && !isSelected && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-blue-400 rounded-tl-sm flex items-center justify-center">
                              <Upload className="w-2 h-2 text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Drawing canvas overlay */}
      {showCanvas && canvasBaseUrl && (
        <DrawingCanvas
          baseImageUrl={canvasBaseUrl}
          onApplyDirectly={handleCanvasApply}
          onCancel={() => setShowCanvas(false)}
        />
      )}
    </>
  );
}
