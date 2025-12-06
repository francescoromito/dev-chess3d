/**
 * Set Detail Page Component
 * Shows the 6 pieces of a chess set
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Grid3X3, Copy, Download } from 'lucide-react';
import { chessSetsApi, getFileUrl } from '../services/api';
import { ChessPieceIcon } from '../components/ChessPieceIcon';
import EditEntityModal from '../components/EditEntityModal';
import ChessboardViewer from '../components/ChessboardViewer';
import { PieceType } from '../types';
import type { PieceVersion } from '../types';

const pieceLabels = {
  [PieceType.KING]: 'Re',
  [PieceType.QUEEN]: 'Regina',
  [PieceType.ROOK]: 'Torre',
  [PieceType.BISHOP]: 'Alfiere',
  [PieceType.KNIGHT]: 'Cavallo',
  [PieceType.PAWN]: 'Pedone',
};

// Helper to get favorite version from a piece
const getFavoriteVersion = (versions: PieceVersion[] | undefined): PieceVersion | undefined => {
  if (!versions || versions.length === 0) return undefined;
  const favorite = versions.find(v => v.is_favorite);
  return favorite || versions[0]; // Return first if no favorite
};

export default function SetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();

  const { data: set, isLoading, error } = useQuery({
    queryKey: ['chess-set', setId],
    queryFn: () => chessSetsApi.getById(Number(setId)),
    enabled: !!setId,
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitialName, setEditInitialName] = useState<string | null>(null);
  const [editInitialDesc, setEditInitialDesc] = useState<string | null>(null);
  const [isChessboardOpen, setIsChessboardOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const openEditModal = () => {
    setEditInitialName(set?.name ?? null);
    setEditInitialDesc(set?.description ?? null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (data: { name?: string; description?: string }) => {
    try {
      await chessSetsApi.update(Number(setId), data);
      setIsEditOpen(false);
      // refresh
      window.location.reload();
    } catch (e) {
      alert("Errore nell'aggiornamento del set");
    }
  };

  const handleDeleteSet = async () => {
    if (!confirm('Sei sicuro di voler cancellare questa scacchiera e tutte le sue versioni?')) return;
    try {
      await chessSetsApi.delete(Number(setId));
      navigate('/');
    } catch (e) {
      alert('Errore nella cancellazione del set');
    }
  };

  const handleDuplicateSet = async () => {
    try {
      const newSet = await chessSetsApi.duplicate(Number(setId));
      navigate(`/sets/${newSet.id}`);
    } catch (e) {
      alert('Errore nella duplicazione del set');
    }
  };

  const handleDownloadSet = async () => {
    if (isDownloading || !setId) return;
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      const result = await chessSetsApi.downloadSetZip(
        Number(setId),
        (p) => setDownloadProgress(p)
      );
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `chess_set_${setId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Errore durante il download della scacchiera');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-700">Sto caricando i modelli, attendere prego...</p>
        <div className="mt-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500 italic">
          Se la schermata non si sblocca da sola, prova ad aggiornare la pagina fra qualche secondo.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group"
      >
        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        Torna alla dashboard
      </button>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{set?.name}</h2>
          {set?.description && (
            <p className="mt-2 text-gray-600">{set.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsChessboardOpen(true)} 
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Grid3X3 className="w-4 h-4" />
            Visualizza Scacchiera
          </button>
          <button 
            onClick={handleDuplicateSet} 
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            <Copy className="w-4 h-4" />
            Duplica
          </button>
          <button onClick={openEditModal} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">Modifica</button>
          <button 
            onClick={handleDownloadSet} 
            disabled={isDownloading}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? `${downloadProgress}%` : 'Scarica'}
          </button>
          <button onClick={handleDeleteSet} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700">Elimina</button>
        </div>
      </div>
      <EditEntityModal
        isOpen={isEditOpen}
        title="Modifica Scacchiera"
        initialName={editInitialName}
        initialDescription={editInitialDesc}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {/* Chessboard 3D Viewer */}
      {set && (
        <ChessboardViewer
          isOpen={isChessboardOpen}
          onClose={() => setIsChessboardOpen(false)}
          pieces={set.pieces}
          setName={set.name}
        />
      )}

      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800">Pezzi</h3>
        <p className="text-gray-600 text-sm">
          Clicca su un pezzo per gestire le versioni
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {set?.pieces.map((piece) => {
          const label = pieceLabels[piece.type];
          const favoriteVersion = getFavoriteVersion(piece.versions);
          const hasPreviewImage = favoriteVersion?.img_front;
          const isComplete = favoriteVersion?.is_complete;
          const completionPercentage = favoriteVersion?.completion_percentage || 0;

          return (
            <button
              key={piece.id}
              onClick={() => navigate(`/pieces/${piece.id}`)}
              className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all overflow-hidden relative"
            >
              {/* Preview Image or Icon */}
              <div className="aspect-square relative">
                {hasPreviewImage ? (
                  <img
                    src={getFileUrl(favoriteVersion.img_front) || ''}
                    alt={label}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <ChessPieceIcon type={piece.type} className="w-16 h-16" />
                  </div>
                )}
                
                {/* Completion Badge */}
                {favoriteVersion && (
                  <div className="absolute top-2 right-2">
                    {isComplete ? (
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xs font-bold text-white">{completionPercentage}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* No version indicator */}
                {!favoriteVersion && piece.versions?.length === 0 && (
                  <div className="absolute top-2 right-2">
                    <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white">0</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Label */}
              <div className="p-3 bg-white border-t">
                      <div className="flex items-center justify-center gap-2">
                        <ChessPieceIcon type={piece.type} className="w-4 h-4" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                          {piece.name || label}
                        </span>
                      </div>
                      {favoriteVersion && (
                        <p className="text-xs text-gray-500 text-center mt-1 truncate">
                          {favoriteVersion.version_name}
                        </p>
                      )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
