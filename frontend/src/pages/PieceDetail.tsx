/**
 * Piece Detail Page Component
 * Shows versions of a piece and allows creating new versions
 */
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Image, Box, Star, CheckCircle, Upload, Download } from 'lucide-react';
import { piecesApi, getFileUrl } from '../services/api';
import type { CreateVersionRequest } from '../types';
import CreateVersionModal from '../components/CreateVersionModal';
import EditEntityModal from '../components/EditEntityModal';
import ImageCard from '../components/ImageCard';
import ModelCard from '../components/ModelCard';
import ImagePlaceholder from '../components/ImagePlaceholder';
import ModelPlaceholder from '../components/ModelPlaceholder';

export default function PieceDetail() {
  const { pieceId } = useParams<{ pieceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editVersionId, setEditVersionId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // State for import name conflict modal
  const [importConflictModal, setImportConflictModal] = useState<{
    isOpen: boolean;
    zipFile: File | null;
    suggestedName: string;
    existingName: string;
  }>({
    isOpen: false,
    zipFile: null,
    suggestedName: '',
    existingName: '',
  });
  const [importCustomName, setImportCustomName] = useState('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);

  const { data: piece, isLoading, error } = useQuery({
    queryKey: ['piece', pieceId],
    queryFn: () => piecesApi.getById(Number(pieceId)),
    enabled: !!pieceId,
  });

  const createVersionMutation = useMutation({
    mutationFn: (data: CreateVersionRequest) =>
      piecesApi.createVersion(Number(pieceId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
      setIsModalOpen(false);
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ versionId, data }: { versionId: number; data: { [key: string]: File } }) => {
      console.log('updateVersionMutation called:', versionId, data);
      return piecesApi.updateVersion(versionId, data);
    },
    onSuccess: (result) => {
      console.log('updateVersionMutation success - full result:', JSON.stringify(result, null, 2));
      console.log('model_stl path:', result?.model_stl);
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
    onError: (error) => {
      console.error('updateVersionMutation error:', error);
    },
  });

  const setFavoriteMutation = useMutation({
    mutationFn: (versionId: number) => piecesApi.setFavorite(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: number) => piecesApi.deleteVersion(versionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['piece', pieceId] }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: ({ versionId, field }: { versionId: number; field: string }) => piecesApi.deleteVersionFile(versionId, field),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['piece', pieceId] }),
  });

  const importVersionMutation = useMutation({
    mutationFn: ({ zipFile, customName }: { zipFile: File; customName?: string }) => 
      piecesApi.importVersionFromZip(Number(pieceId), zipFile, customName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
      setIsImporting(false);
      setImportConflictModal({ isOpen: false, zipFile: null, suggestedName: '', existingName: '' });
      setImportCustomName('');
    },
    onError: (error: any) => {
      setIsImporting(false);
      // Check if it's a 409 conflict error
      if (error?.response?.status === 409 && error?.response?.data?.detail) {
        const detail = error.response.data.detail;
        setImportConflictModal({
          isOpen: true,
          zipFile: importConflictModal.zipFile,
          suggestedName: detail.suggested_name || '',
          existingName: detail.existing_name || '',
        });
        setImportCustomName(detail.suggested_name || '');
      } else {
        alert('Errore durante l\'importazione della versione');
      }
    },
  });

  const handleImportZip = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsImporting(true);
      // Store the file in case we need it for the conflict modal
      setImportConflictModal(prev => ({ ...prev, zipFile: file }));
      importVersionMutation.mutate({ zipFile: file });
    }
    // Reset input value to allow re-selecting the same file
    event.target.value = '';
  };

  const handleImportWithCustomName = () => {
    if (importConflictModal.zipFile && importCustomName.trim()) {
      setIsImporting(true);
      importVersionMutation.mutate({ 
        zipFile: importConflictModal.zipFile, 
        customName: importCustomName.trim() 
      });
    }
  };

  const closeImportConflictModal = () => {
    setImportConflictModal({ isOpen: false, zipFile: null, suggestedName: '', existingName: '' });
    setImportCustomName('');
  };

  const handleDownloadAllVersions = async () => {
    if (isDownloadingAll || !pieceId) return;
    try {
      setIsDownloadingAll(true);
      setDownloadAllProgress(0);
      const result = await piecesApi.downloadAllVersionsZip(
        Number(pieceId),
        (p) => setDownloadAllProgress(p)
      );
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `piece_${pieceId}_all_versions.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Errore durante il download delle versioni');
    } finally {
      setIsDownloadingAll(false);
      setDownloadAllProgress(0);
    }
  };

  const handleCreateVersion = (data: CreateVersionRequest) => {
    createVersionMutation.mutate(data);
  };

  const handleFileChange = (versionId: number, fieldName: string, file: File) => {
    updateVersionMutation.mutate({ 
      versionId, 
      data: { [fieldName]: file } 
    });
  };

  const handleSetFavorite = (versionId: number) => {
    setFavoriteMutation.mutate(versionId);
  };

  const handleEditVersionSubmit = async (data: { name?: string; description?: string }) => {
    if (!editVersionId) return;
    try {
      await piecesApi.updateVersionMetadata(editVersionId, {
        version_name: data.name,
        version_description: data.description,
      });
      setEditVersionId(null);
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    } catch (e) {
      alert('Errore nell\'aggiornamento della versione');
    }
  };

  // Sort versions: favorite first, then by creation date
  const sortedVersions = piece?.versions?.slice().sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Errore nel caricamento del pezzo</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group"
      >
        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        Torna indietro
      </button>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{piece?.name || piece?.type}</h2>
          {piece?.description ? (
            <p className="mt-2 text-gray-600">{piece.description}</p>
          ) : (
            <p className="mt-2 text-gray-600">Gestisci le versioni di questo pezzo</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Version editing moved to individual version cards */}
        </div>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuova Versione
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip"
          onChange={handleImportZip}
          className="hidden"
        />
        <button
          onClick={() => importInputRef.current?.click()}
          disabled={isImporting}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-5 h-5 mr-2" />
          {isImporting ? 'Importando...' : 'Importa da ZIP'}
        </button>
        {sortedVersions && sortedVersions.length > 0 && (
          <button
            onClick={handleDownloadAllVersions}
            disabled={isDownloadingAll}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5 mr-2" />
            {isDownloadingAll ? `Scaricando ${downloadAllProgress}%` : 'Scarica tutte le versioni'}
          </button>
        )}
      </div>

      {/* Versions List */}
      {sortedVersions && sortedVersions.length > 0 ? (
        <div className="space-y-6">
          {sortedVersions.map((version) => (
            <div
              key={version.id}
              className={`bg-white p-6 rounded-lg shadow-sm border-2 ${
                version.is_favorite ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-gray-200'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Favorite Button */}
                  <button
                    onClick={() => handleSetFavorite(version.id)}
                    className={`p-2 rounded-full transition-colors ${
                      version.is_favorite
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-gray-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                    }`}
                    title={version.is_favorite ? 'Versione preferita' : 'Imposta come preferita'}
                  >
                    <Star className={`w-5 h-5 ${version.is_favorite ? 'fill-yellow-500' : ''}`} />
                  </button>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      {version.version_name}
                      {version.is_favorite && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                          Preferita
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Creato il {new Date(version.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>

                {/* Completion Badge */}
                <div className="flex items-center">
                  {version.is_complete ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-full">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Completo</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 rounded-full">
                      <div className="w-8 h-8 rounded-full border-4 border-orange-300 flex items-center justify-center">
                        <span className="text-xs font-bold">{version.completion_percentage}%</span>
                      </div>
                      <span className="text-sm font-medium">In corso</span>
                    </div>
                  )}
                </div>

                {/* Delete Version Button */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditVersionId(version.id)}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Modifica Versione
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Confermi la cancellazione di questa versione e dei suoi file?')) return;
                      deleteVersionMutation.mutate(version.id);
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Elimina versione
                  </button>
                  <button
                    onClick={async () => {
                      if (downloadingId) return;
                      try {
                        setDownloadingId(version.id);
                        setDownloadProgress(0);
                        const result = await piecesApi.downloadVersionZipWithProgress(
                          version.id,
                          (p) => setDownloadProgress(p)
                        );
                        const blob = result.blob;
                        const suggested = result.filename;
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // Prefer server-provided filename, fallback to version_{id}.zip
                        a.download = suggested || `version_${version.id}.zip`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (e) {
                        alert('Errore durante il download della versione');
                      } finally {
                        setDownloadingId(null);
                        setDownloadProgress(0);
                      }
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    disabled={!!downloadingId}
                  >
                    {downloadingId === version.id ? `Scaricando ${downloadProgress}%` : 'Scarica ZIP'}
                  </button>
                </div>
              </div>

              {/* Images as Clickable Cards with Edit */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Image className="w-4 h-4 mr-2" />
                  Immagini (clicca per ingrandire e modificare)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {version.img_front ? (
                    <ImageCard
                      src={getFileUrl(version.img_front) || ''}
                      alt="Front view"
                      label="Fronte"
                      fieldName="img_front"
                      onImageChange={(field, file) => handleFileChange(version.id, field, file)}
                      onRemove={() => { if (confirm('Rimuovere immagine Fronte?')) deleteFileMutation.mutate({ versionId: version.id, field: 'img_front' }); }}
                    />
                  ) : (
                    <ImagePlaceholder label="Fronte" onUpload={(file) => handleFileChange(version.id, 'img_front', file)} accept="image/*" />
                  )}
                  {version.img_back ? (
                    <ImageCard
                      src={getFileUrl(version.img_back) || ''}
                      alt="Back view"
                      label="Retro"
                      fieldName="img_back"
                      onImageChange={(field, file) => handleFileChange(version.id, field, file)}
                      onRemove={() => { if (confirm('Rimuovere immagine Retro?')) deleteFileMutation.mutate({ versionId: version.id, field: 'img_back' }); }}
                    />
                  ) : (
                    <ImagePlaceholder label="Retro" onUpload={(file) => handleFileChange(version.id, 'img_back', file)} accept="image/*" />
                  )}
                  {version.img_side_r ? (
                    <ImageCard
                      src={getFileUrl(version.img_side_r) || ''}
                      alt="Right view"
                      label="Destra"
                      fieldName="img_side_r"
                      onImageChange={(field, file) => handleFileChange(version.id, field, file)}
                      onRemove={() => { if (confirm('Rimuovere immagine Destra?')) deleteFileMutation.mutate({ versionId: version.id, field: 'img_side_r' }); }}
                    />
                  ) : (
                    <ImagePlaceholder label="Destra" onUpload={(file) => handleFileChange(version.id, 'img_side_r', file)} accept="image/*" />
                  )}
                  {version.img_side_l ? (
                    <ImageCard
                      src={getFileUrl(version.img_side_l) || ''}
                      alt="Left view"
                      label="Sinistra"
                      fieldName="img_side_l"
                      onImageChange={(field, file) => handleFileChange(version.id, field, file)}
                      onRemove={() => { if (confirm('Rimuovere immagine Sinistra?')) deleteFileMutation.mutate({ versionId: version.id, field: 'img_side_l' }); }}
                    />
                  ) : (
                    <ImagePlaceholder label="Sinistra" onUpload={(file) => handleFileChange(version.id, 'img_side_l', file)} accept="image/*" />
                  )}
                </div>
              </div>

              {/* 3D Models as Clickable Cards with 3D Viewer */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Box className="w-4 h-4 mr-2" />
                  Modelli 3D (clicca per visualizzare in 3D e modificare)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {version.model_glb ? (
                    <ModelCard
                      src={getFileUrl(version.model_glb) || ''}
                      label="Modello GLB"
                      fileType="glb"
                      versionId={version.id}
                      onEdit={(file) => handleFileChange(version.id, 'model_glb', file)}
                      onRemove={() => { if (confirm('Rimuovere modello GLB?')) deleteFileMutation.mutate({ versionId: version.id, field: 'model_glb' }); }}
                      pieceType={piece?.type?.toLowerCase()}
                    />
                  ) : (
                    <ModelPlaceholder label="GLB" onUpload={(file) => handleFileChange(version.id, 'model_glb', file)} accept=".glb,.gltf" />
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">
            Nessuna versione ancora. Crea la prima versione per questo pezzo.
          </p>
        </div>
      )}

      <CreateVersionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateVersion}
        isLoading={createVersionMutation.isPending}
      />
      {editVersionId && sortedVersions && sortedVersions.length > 0 && (
        <EditEntityModal
          isOpen={!!editVersionId}
          title="Modifica Versione"
          initialName={sortedVersions.find(v => v.id === editVersionId)?.version_name ?? ''}
          initialDescription={sortedVersions.find(v => v.id === editVersionId)?.version_description ?? ''}
          onClose={() => setEditVersionId(null)}
          onSubmit={handleEditVersionSubmit}
        />
      )}

      {/* Import Name Conflict Modal */}
      {importConflictModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Nome versione già esistente
            </h3>
            <p className="text-gray-600 mb-4">
              Una versione con il nome "<span className="font-medium">{importConflictModal.existingName}</span>" esiste già.
              Inserisci un nuovo nome per la versione importata:
            </p>
            <input
              type="text"
              value={importCustomName}
              onChange={(e) => setImportCustomName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              placeholder="Nome versione"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && importCustomName.trim()) {
                  handleImportWithCustomName();
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={closeImportConflictModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleImportWithCustomName}
                disabled={!importCustomName.trim() || isImporting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importando...' : 'Importa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
