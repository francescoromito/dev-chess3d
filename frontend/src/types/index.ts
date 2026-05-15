/**
 * TypeScript types for Chess Set Design Manager
 */

export enum PieceType {
  KING = "King",
  QUEEN = "Queen",
  ROOK = "Rook",
  BISHOP = "Bishop",
  KNIGHT = "Knight",
  PAWN = "Pawn",
}

export interface ChessSet {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  is_seeded: boolean;
}

export interface ChessSetWithPieces extends ChessSet {
  pieces: ChessPieceWithVersions[];
}

export interface ChessPiece {
  id: number;
  set_id: number;
  type: PieceType;
  name?: string | null;
  description?: string | null;
}

export interface ChessPieceWithVersions extends ChessPiece {
  versions: PieceVersion[];
}

export interface PieceVersion {
  id: number;
  piece_id: number;
  version_name: string;
  version_description?: string | null;
  img_front: string | null;
  img_back: string | null;
  img_side_r: string | null;
  img_side_l: string | null;
  model_glb: string | null;
  created_at: string;
  is_favorite: boolean;
  completion_percentage: number;
  is_complete: boolean;
}

export interface CreateChessSetRequest {
  name: string;
  description?: string;
}

export interface CreateVersionRequest {
  version_name: string;
  description?: string;
  img_front?: File;
  img_back?: File;
  img_side_r?: File;
  img_side_l?: File;
  model_glb?: File;
}

// Collections
export interface Collection {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// AI Generation types
// ---------------------------------------------------------------------------

export type ImageSlotField = 'img_front' | 'img_back' | 'img_side_r' | 'img_side_l';
export type ModelSlotField = 'model_glb';
export type SlotField = ImageSlotField | ModelSlotField;

export const SLOT_LABELS: Record<SlotField, string> = {
  img_front: 'Fronte',
  img_back: 'Retro',
  img_side_r: 'Destra',
  img_side_l: 'Sinistra',
  model_glb: 'Modello 3D',
};

export interface StagedFile {
  id: string;
  preview_url: string;
}

export type AIJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AIJob {
  id: string;
  status: AIJobStatus;
  output_url: string | null;
  staged_id?: string | null;
}

export interface StylePreset {
  id: string;
  label: string;
  emoji: string;
  promptSuffix: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'wood',     label: 'Wood',     emoji: '🪵', promptSuffix: 'carved wooden chess piece, wood grain texture, warm brown tones, studio lighting' },
  { id: 'marble',   label: 'Marble',   emoji: '🤍', promptSuffix: 'white marble chess piece, polished smooth stone, classical sculpture style, soft lighting' },
  { id: 'stone',    label: 'Stone',    emoji: '🪨', promptSuffix: 'rough grey stone chess piece, aged texture, medieval style, dramatic lighting' },
  { id: 'gold',     label: 'Gold',     emoji: '✨', promptSuffix: 'golden chess piece, shiny polished metal, ornate decoration, luxury feel' },
  { id: 'crystal',  label: 'Crystal',  emoji: '💎', promptSuffix: 'crystal glass chess piece, transparent with light refractions, elegant and delicate' },
  { id: 'obsidian', label: 'Obsidian', emoji: '⬛', promptSuffix: 'obsidian dark chess piece, glossy volcanic stone, dramatic dark atmosphere' },
];


