/**
 * AI Generate Image Modal (compact, single-slot)
 * Opens from a slot's "Genera" button or from ImageCard's "Modifica con AI".
 * Handles all three generation modes: text-to-image, edit, and multiview.
 */
import { useState, useCallback } from 'react';
import {
  X,
  Sparkles,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { aiApi, getFileUrl } from '../services/api';
import type { SlotField, StagedFile, PieceVersion } from '../types';
import { SLOT_LABELS, STYLE_PRESETS } from '../types';

interface AIGenerateImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The version this generation belongs to */
  version: PieceVersion;
  /** Which slot we're targeting */
  slotField: SlotField;
  /** Piece type label (e.g. "bishop") for prompting */
  pieceType: string;
  /** pieceId used to invalidate the query cache on save */
  pieceId: number;
}

type GenerationMode = 'text_to_image' | 'edit' | 'multiview';

function detectMode(slotField: SlotField, version: PieceVersion): GenerationMode {
  const slotValue = version[slotField as keyof PieceVersion] as string | null;
  if (slotValue) return 'edit';
  if (slotField !== 'img_front' && version.img_front) return 'multiview';
  return 'text_to_image';
}

const MODE_LABELS: Record<GenerationMode, string> = {
  text_to_image: 'Genera da testo',
  edit: 'Modifica con AI',
  multiview: 'Genera da vista Fronte',
};

const ANGLE_MAP: Partial<Record<SlotField, 'back' | 'left' | 'right'>> = {
  img_back: 'back',
  img_side_r: 'right',
  img_side_l: 'left',
};

export default function AIGenerateImageModal({
  isOpen,
  onClose,
  version,
  slotField,
  pieceType,
  pieceId,
}: AIGenerateImageModalProps) {
  const queryClient = useQueryClient();
  const mode = detectMode(slotField, version);

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFile | null>(null);
  const [stagedHistory, setStagedHistory] = useState<StagedFile[]>([]);

  const buildPrompt = (): string => {
    const preset = STYLE_PRESETS.find((p) => p.id === selectedPreset);
    const base = customPrompt.trim() || pieceType;
    if (preset) return `${base} chess piece, ${preset.promptSuffix}, isolated on white background`;
    return `${base} chess piece, isolated on white background`;
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedPreset && !customPrompt.trim()) {
      setError('Scegli uno stile o inserisci un prompt');
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      let result: StagedFile;

      if (mode === 'text_to_image') {
        result = await aiApi.generateImage({
          prompt: buildPrompt(),
          style_preset: selectedPreset ?? undefined,
          piece_type: pieceType.toLowerCase(),
        });
      } else if (mode === 'edit') {
        if (staged) {
          if (buildPrompt()) {
            result = await aiApi.editImage({ staged_id: staged.id, prompt: buildPrompt()! });
          } else {
            result = await aiApi.editImage({ staged_id: staged.id, prompt: "" }); // Fallback if undefined
          }
        } else {
          // First edit iteration: generate with context
          result = await aiApi.generateImage({
            prompt: buildPrompt(),
            style_preset: selectedPreset ?? undefined,
            piece_type: pieceType.toLowerCase(),
          });
        }
      } else {
        // multiview
        const angle = ANGLE_MAP[slotField];
        if (!angle) throw new Error('Angolo non supportato per questo slot');
        const frontUrl = getFileUrl(version.img_front) ?? undefined;
        result = await aiApi.generateView({ angle, source_url: frontUrl });
      }

      if (staged) setStagedHistory((h) => [staged, ...h].slice(0, 4));
      setStaged(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Errore durante la generazione');
    } finally {
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slotField, selectedPreset, customPrompt, staged, version, pieceType]);

  const handleSave = async () => {
    if (!staged) return;
    setIsSaving(true);
    setError(null);
    try {
      await aiApi.confirmStaged(staged.id, version.id, slotField);
      queryClient.invalidateQueries({ queryKey: ['piece', String(pieceId)] });
      onClose();
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
  };

  const handleClose = () => {
    if (staged) aiApi.discardStaged(staged.id).catch(() => {});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">Genera con AI</span>
            <span className="text-violet-200">—</span>
            <span className="text-violet-100 text-sm">{SLOT_LABELS[slotField]}</span>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Mode badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
              {MODE_LABELS[mode]}
            </span>
            {mode === 'multiview' && version.img_front && (
              <span className="text-xs text-gray-400">usando Fronte come riferimento</span>
            )}
          </div>

          {/* Reference image (edit / multiview) */}
          {mode === 'edit' && (version[slotField as keyof PieceVersion] as string | null) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Immagine attuale
              </p>
              <img
                src={getFileUrl(version[slotField as keyof PieceVersion] as string) ?? ''}
                alt="current"
                className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-gray-50"
              />
            </div>
          )}
          {mode === 'multiview' && version.img_front && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Vista Fronte (riferimento)
              </p>
              <img
                src={getFileUrl(version.img_front) ?? ''}
                alt="front reference"
                className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-gray-50"
              />
            </div>
          )}

          {/* Style presets */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Stile
            </p>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { setSelectedPreset(preset.id === selectedPreset ? null : preset.id); setError(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedPreset === preset.id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  <span>{preset.emoji}</span>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <button
              onClick={() => setShowPromptInput(!showPromptInput)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showPromptInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Personalizza prompt
            </button>
            {showPromptInput && (
              <textarea
                value={customPrompt}
                onChange={(e) => { setCustomPrompt(e.target.value); setError(null); }}
                placeholder={`Es: ${pieceType} chess piece, baroque style, gold and ivory...`}
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                rows={2}
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {staged ? 'Rigenera' : 'Genera'}</>
            )}
          </button>

          {/* Preview */}
          {staged && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Anteprima
              </p>
              <img
                src={staged.preview_url}
                alt="Preview generata"
                className="w-full rounded-xl border border-gray-200 object-contain max-h-64"
              />

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salva
                </button>
                <button
                  onClick={handleDiscard}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Scarta
                </button>
              </div>

              {/* History thumbnails */}
              {stagedHistory.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Precedenti:</p>
                  <div className="flex gap-2">
                    {stagedHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setStagedHistory((h) => [staged, ...h.filter((x) => x.id !== item.id)].slice(0, 4));
                          setStaged(item);
                        }}
                        className="w-12 h-12 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 transition-colors"
                      >
                        <img src={item.preview_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
