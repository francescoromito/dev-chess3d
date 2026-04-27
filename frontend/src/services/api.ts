/**
 * API Service for Chess Set Design Manager
 */
import axios from 'axios';
import type {
  ChessSetWithPieces,
  ChessPieceWithVersions,
  PieceVersion,
  CreateChessSetRequest,
  CreateVersionRequest,
  StagedFile,
  AIJob,
  SlotField,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Chess Sets
export const chessSetsApi = {
  /**
   * Get all chess sets
   */
  getAll: async (): Promise<ChessSetWithPieces[]> => {
    const response = await api.get<ChessSetWithPieces[]>('/sets');
    return response.data;
  },

  /**
   * Get a specific chess set with its pieces
   */
  getById: async (id: number): Promise<ChessSetWithPieces> => {
    const response = await api.get<ChessSetWithPieces>(`/sets/${id}`);
    return response.data;
  },

  /**
   * Create a new chess set (automatically creates 6 piece types)
   */
  create: async (data: CreateChessSetRequest): Promise<ChessSetWithPieces> => {
    const response = await api.post<ChessSetWithPieces>('/sets', data);
    return response.data;
  },

  /**
   * Update a chess set (name/description)
   */
  update: async (id: number, data: { name?: string; description?: string }): Promise<ChessSetWithPieces> => {
    const response = await api.patch<ChessSetWithPieces>(`/sets/${id}`, data);
    return response.data;
  },

  /**
   * Delete a chess set
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/sets/${id}`);
  },

  /**
   * Duplicate a chess set
   */
  duplicate: async (id: number): Promise<ChessSetWithPieces> => {
    const response = await api.post<ChessSetWithPieces>(`/sets/${id}/duplicate`);
    return response.data;
  },

  /**
   * Download entire chess set as ZIP
   */
  downloadSetZip: async (
    setId: number,
    onProgress?: (percent: number) => void
  ): Promise<{ blob: Blob; filename?: string }> => {
    const response = await api.get(`/sets/${setId}/download`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent: any) => {
        try {
          if (onProgress && progressEvent.lengthComputable && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(percent);
          }
        } catch (e) {
          // ignore progress errors
        }
      },
    });
    const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
    let filename: string | undefined;
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''")?"?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    return { blob: response.data as Blob, filename };
  },

  /**
   * Import a chess set from a ZIP file
   * @param zipFile The ZIP file to import
   * @param customSetName Optional custom name to override the ZIP filename
   */
  importSetFromZip: async (zipFile: File, customSetName?: string): Promise<ChessSetWithPieces> => {
    const formData = new FormData();
    formData.append('zip_file', zipFile);
    if (customSetName) {
      formData.append('custom_set_name', customSetName);
    }
    
    const response = await api.post<ChessSetWithPieces>(
      '/sets/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};

// Collections API
export const collectionsApi = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/collections');
    return response.data;
  },

  create: async (data: { name: string; description?: string }): Promise<any> => {
    const response = await api.post<any>('/collections', data);
    return response.data;
  },

  addSet: async (collectionId: number, setId: number): Promise<void> => {
    await api.post(`/collections/${collectionId}/sets/${setId}`);
  },

  removeSet: async (collectionId: number, setId: number): Promise<void> => {
    await api.delete(`/collections/${collectionId}/sets/${setId}`);
  }
  ,
  getById: async (id: number): Promise<any> => {
    const response = await api.get<any>(`/collections/${id}`);
    return response.data;
  },
  update: async (id: number, data: { name: string; description?: string }): Promise<any> => {
    const response = await api.put<any>(`/collections/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/collections/${id}`);
  }
};

// Pieces and Versions
export const piecesApi = {
  /**
   * Get a specific piece with all its versions
   */
  getById: async (id: number): Promise<ChessPieceWithVersions> => {
    const response = await api.get<ChessPieceWithVersions>(`/pieces/${id}`);
    return response.data;
  },

  /**
   * Get all versions for a specific piece
   */
  getVersions: async (pieceId: number): Promise<PieceVersion[]> => {
    const response = await api.get<PieceVersion[]>(`/pieces/${pieceId}/versions`);
    return response.data;
  },

  /**
   * Create a new version for a piece with file uploads
   */
  createVersion: async (
    pieceId: number,
    data: CreateVersionRequest
  ): Promise<PieceVersion> => {
    const formData = new FormData();
    formData.append('version_name', data.version_name);

    if (data.img_front) formData.append('img_front', data.img_front);
    if (data.img_back) formData.append('img_back', data.img_back);
    if (data.img_side_r) formData.append('img_side_r', data.img_side_r);
    if (data.img_side_l) formData.append('img_side_l', data.img_side_l);
    if (data.model_glb) formData.append('model_glb', data.model_glb);
    if (data.model_stl) formData.append('model_stl', data.model_stl);

    const response = await api.post<PieceVersion>(
      `/pieces/${pieceId}/versions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Download a version as ZIP (returns blob + filename if provided by server)
   */
  downloadVersionZip: async (versionId: number): Promise<{ blob: Blob; filename?: string }> => {
    const response = await api.get(`/pieces/versions/${versionId}/download`, {
      responseType: 'blob',
    });
    const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
    let filename: string | undefined;
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''")?"?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    return { blob: response.data as Blob, filename };
  },

  /**
   * Download all versions of a piece as a single ZIP
   */
  downloadAllVersionsZip: async (
    pieceId: number,
    onProgress?: (percent: number) => void
  ): Promise<{ blob: Blob; filename?: string }> => {
    const response = await api.get(`/pieces/${pieceId}/download-all`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent: any) => {
        try {
          if (onProgress && progressEvent.lengthComputable && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(percent);
          }
        } catch (e) {
          // ignore progress errors
        }
      },
    });
    const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
    let filename: string | undefined;
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''")?"?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    return { blob: response.data as Blob, filename };
  },

  /**
   * Download a version as ZIP with progress callback.
   * onProgress will be called with a percentage number (0-100) when lengthComputable.
   */
  downloadVersionZipWithProgress: async (
    versionId: number,
    onProgress?: (percent: number) => void
  ): Promise<{ blob: Blob; filename?: string }> => {
    const response = await api.get(`/pieces/versions/${versionId}/download`, {
      responseType: 'blob',
      // progress event type from axios; use any to avoid strict typing issues here
      onDownloadProgress: (progressEvent: any) => {
        try {
          if (onProgress && progressEvent.lengthComputable && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(percent);
          }
        } catch (e) {
          // ignore progress errors
        }
      },
    });
    const cd = response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition']);
    let filename: string | undefined;
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''")?"?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    return { blob: response.data as Blob, filename };
  },

  /**
   * Update an existing version with new files
   */
  updateVersion: async (
    versionId: number,
    data: { [key: string]: File | string }
  ): Promise<PieceVersion> => {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await api.put<PieceVersion>(
      `/pieces/versions/${versionId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Set a version as the favorite for its piece
   */
  setFavorite: async (versionId: number): Promise<PieceVersion> => {
    const response = await api.put<PieceVersion>(
      `/pieces/versions/${versionId}/favorite`
    );
    return response.data;
  },

  /**
   * Update version name and description (metadata only, no files)
   */
  updateVersionMetadata: async (
    versionId: number,
    data: { version_name?: string; version_description?: string }
  ): Promise<PieceVersion> => {
    const formData = new FormData();
    if (data.version_name) formData.append('version_name', data.version_name);
    if (data.version_description) formData.append('version_description', data.version_description);
    const response = await api.patch<PieceVersion>(
      `/pieces/versions/${versionId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
  /**
   * Delete a piece version
   */
  deleteVersion: async (versionId: number): Promise<void> => {
    await api.delete(`/pieces/versions/${versionId}`);
  },

  /**
   * Remove a single file from a version (field must be one of img_front, img_back, img_side_r, img_side_l, model_glb, model_stl)
   */
  deleteVersionFile: async (versionId: number, field: string): Promise<PieceVersion> => {
    const response = await api.delete<PieceVersion>(`/pieces/versions/${versionId}/file`, { params: { field } });
    return response.data;
  },

  /**
   * Download a version's GLB converted to STL by the backend (preserves GLB dimensions).
   * Returns the STL as a Blob plus the suggested filename from the server.
   */
  downloadVersionAsStl: async (versionId: number): Promise<{ blob: Blob; filename: string }> => {
    const response = await api.get(`/pieces/versions/${versionId}/download-as-stl`, {
      responseType: 'blob',
    });
    const cd: string | undefined =
      response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
    let filename = 'model.stl';
    if (cd) {
      const match = cd.match(/filename\*?=(?:UTF-8''")?"?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }
    return { blob: response.data as Blob, filename };
  },

  /**
   * Update a chess piece (name/description)
   */
  updatePiece: async (pieceId: number, data: { name?: string; description?: string }): Promise<ChessPieceWithVersions> => {
    const response = await api.patch<ChessPieceWithVersions>(`/pieces/${pieceId}`, data);
    return response.data;
  },

  /**
   * Import a version from a ZIP file
   * @param customVersionName Optional custom name to override the one from the ZIP
   */
  importVersionFromZip: async (pieceId: number, zipFile: File, customVersionName?: string): Promise<PieceVersion> => {
    const formData = new FormData();
    formData.append('zip_file', zipFile);
    if (customVersionName) {
      formData.append('custom_version_name', customVersionName);
    }
    
    const response = await api.post<PieceVersion>(
      `/pieces/${pieceId}/versions/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};

// Chess Engine API
export interface MoveDetail {
  uci: string;
  san: string;
  from_sq: string;
  to_sq: string;
  is_capture: boolean;
  is_check: boolean;
}

export interface LegalMovesResponse {
  turn: 'white' | 'black';
  legal_moves: MoveDetail[];
  count: number;
}

export interface BestMoveResponse {
  best_move_uci: string | null;
  fen_after: string | null;
  depth_used: number;
}

export interface GameStateResponse {
  is_checkmate: boolean;
  is_stalemate: boolean;
  is_check: boolean;
  is_game_over: boolean;
  winner: 'white' | 'black' | null;
  turn: 'white' | 'black';
}

export const chessEngineApi = {
  /**
   * Get legal moves for a position, optionally for a specific square
   */
  getLegalMoves: async (fen: string, square?: string): Promise<LegalMovesResponse> => {
    const response = await api.post<LegalMovesResponse>('/chess/rules/legal-moves', { fen, square });
    return response.data;
  },

  /**
   * Get the best move for a position based on ELO
   */
  getBestMove: async (fen: string, elo: number = 1200): Promise<BestMoveResponse> => {
    const response = await api.post<BestMoveResponse>('/chess/engine/best-move', { fen, elo });
    return response.data;
  },

  /**
   * Get the current game state (check, checkmate, stalemate)
   */
  getGameState: async (fen: string): Promise<GameStateResponse> => {
    const response = await api.post<GameStateResponse>('/chess/rules/game-state', { fen });
    return response.data;
  },
};

/**
 * Get the full URL for an uploaded file
 * Adds a cache-busting timestamp to force reload after updates
 */
export const getFileUrl = (relativePath: string | null): string | null => {
  if (!relativePath) return null;
  // Add timestamp to prevent caching issues when file is updated
  return `${API_BASE_URL}/uploads/${relativePath}?t=${Date.now()}`;
};

// ---------------------------------------------------------------------------
// AI Generation API
// ---------------------------------------------------------------------------

export const aiApi = {
  /**
   * Generate an image from a text prompt (text → image).
   * Returns a StagedFile with a preview URL.
   */
  generateImage: async (params: {
    prompt: string;
    style_preset?: string;
    piece_type?: string;
  }): Promise<StagedFile> => {
    const response = await api.post<StagedFile>('/ai/generate-image', params);
    return response.data;
  },

  /**
   * Edit/refine an image using a new prompt (img2img).
   * Provide either staged_id (in-flight staged image) or source_url (already-saved URL).
   */
  editImage: async (params: {
    prompt: string;
    staged_id?: string;
    source_url?: string;
  }): Promise<StagedFile> => {
    const response = await api.post<StagedFile>('/ai/edit-image', params);
    return response.data;
  },

  /**
   * Send an annotated/drawn-upon image + prompt to the AI for editing.
   * The imageBlob should be a PNG composite of the base image + user drawings.
   */
  annotatedEdit: async (imageBlob: Blob, prompt: string): Promise<StagedFile> => {
    const formData = new FormData();
    formData.append('image', imageBlob, 'annotation.png');
    formData.append('prompt', prompt);
    const response = await api.post<StagedFile>('/ai/annotated-edit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Generate a rotated view (back / left / right) from a reference image.
   * Provide either a staged_id (in-progress front image) or a source_url (saved URL).
   */
  generateView: async (params: {
    angle: 'back' | 'left' | 'right';
    staged_id?: string;
    source_url?: string;
  }): Promise<StagedFile> => {
    const response = await api.post<StagedFile>('/ai/generate-view', params);
    return response.data;
  },

  /**
   * Start an async 3D model generation job from 1–4 reference image URLs.
   * Returns a job_id — poll with pollJob() until status === 'completed'.
   */
  generate3D: async (image_urls: string[]): Promise<{ job_id: string; status: string }> => {
    const response = await api.post<{ job_id: string; status: string }>('/ai/generate-3d', { image_urls });
    return response.data;
  },

  /**
   * Poll the status of an async generation job (e.g. 3D model generation).
   */
  pollJob: async (job_id: string): Promise<AIJob> => {
    const response = await api.get<AIJob>(`/ai/jobs/${job_id}`);
    return response.data;
  },

  /**
   * Confirm a staged file: download and persist it into the specified version slot.
   */
  confirmStaged: async (
    staged_id: string,
    version_id: number,
    field_name: SlotField,
  ): Promise<PieceVersion> => {
    const response = await api.post<PieceVersion>(`/ai/confirm/${staged_id}`, {
      version_id,
      field_name,
    });
    return response.data;
  },

  /**
   * Discard a staged file without saving.
   */
  discardStaged: async (staged_id: string): Promise<void> => {
    await api.delete(`/ai/staged/${staged_id}`);
  },
};
