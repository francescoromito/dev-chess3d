/**
 * Piece Detail Page Component
 * Shows versions of a piece and allows creating new versions
 */
import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Image, Star, CheckCircle, Upload, Download, Sparkles, Trash2 } from 'lucide-react';
import { piecesApi, getFileUrl } from '../services/api';
import type { PieceVersion, SlotField } from '../types';
import { SLOT_LABELS } from '../types';
import EditEntityModal from '../components/EditEntityModal';
import ModelCard from '../components/ModelCard';
import ModelPlaceholder from '../components/ModelPlaceholder';
import AIStudioModal from '../components/AIStudioModal';

export default function PieceDetail() {
  const { pieceId } = useParams<{ pieceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editVersionId, setEditVersionId] = useState<number | null>(null);
  const [aiStudioVersion, setAiStudioVersion] = useState<PieceVersion | null>(null);
  const [aiStudioSlot, setAiStudioSlot] = useState<SlotField | undefined>(undefined);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [newVersionError, setNewVersionError] = useState<string | null>(null);
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

  const openAIStudio = (version: PieceVersion, slot?: SlotField) => {
    setAiStudioSlot(slot);
    setAiStudioVersion(version);
  };

  const handleCreateAndOpenAIStudio = async () => {
    if (!newVersionName.trim()) {
      setNewVersionError('Inserisci un nome per la versione');
      return;
    }
    setIsCreatingVersion(true);
    setNewVersionError(null);
    try {
      const version = await piecesApi.createVersion(Number(pieceId), { version_name: newVersionName.trim() });
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
      setShowNewVersionDialog(false);
      setAiStudioVersion(version);
    } catch (e: any) {
      setNewVersionError(e?.response?.data?.detail ?? 'Errore durante la creazione');
    } finally {
      setIsCreatingVersion(false);
    }
  };

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

  useEffect(() => {
    if (piece?.versions && piece.versions.length === 1) {
      const singleVersion = piece.versions[0];
      if (!singleVersion.is_favorite && !setFavoriteMutation.isPending) {
        setFavoriteMutation.mutate(singleVersion.id);
      }
    }
  }, [piece?.versions, setFavoriteMutation]);

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
          onClick={() => {
            setNewVersionName('');
            setNewVersionError(null);
            setShowNewVersionDialog(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Sparkles className="w-5 h-5 mr-2" />
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

                {/* Completion Badge & Delete Button */}
                <div className="flex items-center gap-4">
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

                  {/* Delete Version Button */}
                  <button
                    onClick={() => {
                      if (confirm('Sei sicuro di voler eliminare l\'intera versione? Tutte le immagini e il modello andranno persi.')) {
                        deleteVersionMutation.mutate(version.id);
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="Elimina questa versione"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* AI Studio Slot Map — compact integrated view */}
              <div className="mt-4">
                <div className="flex items-center mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Viste Immagine e Modello 3D</p>
                </div>

                {/* 5 slots grid */}
                <div className="grid grid-cols-5 gap-3">
                  {(['img_front', 'img_back', 'img_side_r', 'img_side_l'] as SlotField[]).map((slot) => {
                    const url = version[slot as keyof PieceVersion] as string | null;
                    const fileInputId = `upload-${version.id}-${slot}`;
                    return (
                      <div key={slot} className="relative group">
                        <button
                          onClick={() => openAIStudio(version, slot)}
                          className="w-full aspect-square rounded-xl border-2 border-slate-200 hover:border-violet-400 overflow-hidden bg-slate-900 flex flex-col items-center justify-center transition-all hover:scale-[1.02] hover:shadow-lg"
                          title={`Apri AI Studio — ${SLOT_LABELS[slot]}`}
                        >
                          {url ? (
                            <>
                              <img
                                src={getFileUrl(url) || ''}
                                alt={SLOT_LABELS[slot]}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                crossOrigin="anonymous"
                              />
                            </>
                          ) : (
                            <>
                              <Image className="w-6 h-6 text-slate-300 mb-1" />
                              <span className="text-xs text-slate-400 text-center px-1 leading-tight">{SLOT_LABELS[slot]}</span>
                            </>
                          )}
                        </button>
                        
                        {url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`Rimuovere l'immagine di ${SLOT_LABELS[slot]}?`)) deleteFileMutation.mutate({ versionId: version.id, field: slot }); }}
                            title="Rimuovi"
                            className="absolute top-2 right-2 z-20 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 hover:bg-red-600 transition-colors backdrop-blur-[2px] opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                        )}

                        {/* Label + status below */}
                        <div className="flex items-center gap-1 mt-1 px-0.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${url ? 'bg-green-400' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500 truncate flex-1">{SLOT_LABELS[slot]}</span>
                          {/* Upload icon on hover */}
                          <label htmlFor={fileInputId} className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-3.5 h-3.5 text-gray-400 hover:text-violet-600" />
                          </label>
                          <input
                            id={fileInputId}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileChange(version.id, slot, file);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 5th slot: 3D Model */}
                  <div className="relative group">
                    <div className="w-full aspect-square rounded-xl relative">
                      {version.model_glb ? (
                        <ModelCard
                          src={getFileUrl(version.model_glb) || ''}
                          label={SLOT_LABELS['model_glb']}
                          fileType="glb"
                          versionId={version.id}
                          onEdit={(file) => handleFileChange(version.id, 'model_glb', file)}
                          onRemove={() => { if (confirm('Rimuovere il modello 3D?')) deleteFileMutation.mutate({ versionId: version.id, field: 'model_glb' }); }}
                          pieceType={piece?.type?.toLowerCase()}
                        />
                      ) : (
                        <ModelPlaceholder label={SLOT_LABELS['model_glb']} onUpload={(file) => handleFileChange(version.id, 'model_glb', file)} accept=".glb,.gltf" />
                      )}
                    </div>
                    {/* Status under 3D Model slot */}
                    <div className="flex items-center gap-1 mt-1 px-0.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${version.model_glb ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-500 truncate flex-1">Modello 3D</span>
                      {/* Upload icon on hover */}
                      <label htmlFor={`upload-${version.id}-model_glb`} className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-3.5 h-3.5 text-gray-400 hover:text-violet-600" />
                      </label>
                      <input
                        id={`upload-${version.id}-model_glb`}
                        type="file"
                        accept=".glb,.gltf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(version.id, 'model_glb', file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-b from-violet-50 to-white rounded-2xl border-2 border-dashed border-violet-200">
          <Sparkles className="w-12 h-12 text-violet-300 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold text-lg mb-1">Nessuna versione ancora</p>
          <p className="text-gray-400 text-sm mb-6">Usa l'AI per dare vita a questo pezzo — immagina lo stile e genera l'immagine in un click</p>
          <button
            onClick={() => {
              setNewVersionName('');
              setNewVersionError(null);
              setShowNewVersionDialog(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors shadow-md"
          >
            <Sparkles className="w-5 h-5" />
            Nuova Versione
          </button>
        </div>
      )}

      {showNewVersionDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              Nuova versione
            </h3>
            <p className="text-sm text-gray-500 mb-4">Dai un nome alla versione, poi si apre AI Studio.</p>
            <input
              type="text"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
              placeholder="es. Stile medievale"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndOpenAIStudio(); }}
            />
            {newVersionError && <p className="text-red-500 text-sm mb-3">{newVersionError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewVersionDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateAndOpenAIStudio}
                disabled={isCreatingVersion || !newVersionName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                {isCreatingVersion ? 'Creando...' : 'Crea e apri AI Studio'}
              </button>
            </div>
          </div>
        </div>
      )}
      {aiStudioVersion && piece && (
        <AIStudioModal
          isOpen={!!aiStudioVersion}
          onClose={() => { setAiStudioVersion(null); setAiStudioSlot(undefined); }}
          piece={piece}
          version={piece.versions?.find(v => v.id === aiStudioVersion.id) ?? aiStudioVersion}
          defaultSlot={aiStudioSlot}
          onDeleteVersion={() => {
            deleteVersionMutation.mutate(aiStudioVersion.id);
            setAiStudioVersion(null);
            setAiStudioSlot(undefined);
          }}
        />
      )}
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
