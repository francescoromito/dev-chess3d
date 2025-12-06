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
  model_stl: string | null;
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
  model_stl?: File;
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
