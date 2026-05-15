/**
 * Dashboard (Home) Page Component
 * Shows grid of chess sets with Create and Import cards
 */
import { useState, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Calendar, Swords, Loader2, Box } from 'lucide-react';
import { chessSetsApi, collectionsApi, getFileUrl } from '../services/api';
import CreateCollectionModal from '../components/CreateCollectionModal';
import CollectionDetailModal from '../components/CollectionDetailModal';
import { ChessPieceIcon } from '../components/ChessPieceIcon';
import type { CreateChessSetRequest } from '../types';
import CreateSetModal from '../components/CreateSetModal';
import { Trash2 as TrashIcon, Edit3 as EditIcon, Check as CheckIcon, X as XIcon } from 'lucide-react';

// Small per-collection card component (contains edit & delete at card level)
function CollectionCard({ col, onOpen, onRefresh }: { col: any; onOpen: () => void; onRefresh: () => void; }) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(col.name || '');
  const [description, setDescription] = useState(col.description || '');
  const [isBusy, setIsBusy] = useState(false);

  const handleSave = async (e: MouseEvent) => {
    e.stopPropagation();
    setIsBusy(true);
    try {
      await collectionsApi.update(col.id, { name, description });
      setEditMode(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Sei sicuro di voler cancellare la collezione?')) return;
    setIsBusy(true);
    try {
      await collectionsApi.delete(col.id);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="group bg-white rounded-2xl shadow-sm border-2 border-slate-100 hover:shadow-lg hover:border-violet-300 transition-all text-left overflow-hidden flex flex-col hover:-translate-y-1">
      <div onClick={() => onOpen()} className="p-6 border-b border-slate-100 cursor-pointer flex flex-col min-h-[140px]">
        {editMode ? (
          <div>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:ring-2 focus:ring-violet-500 focus:outline-none" onClick={e => e.stopPropagation()} />
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none" rows={2} onClick={e => e.stopPropagation()} />
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-slate-900 group-hover:text-violet-600 mb-2 transition-colors line-clamp-1">{col.name}</h3>
            <p className="text-slate-500 text-sm line-clamp-2 min-h-[40px]">
              {col.description || <span className="opacity-0">-</span>}
            </p>
            <div className="text-sm font-medium text-slate-400 mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
              <span>{col.sets?.length || 0} scacchiere</span>
            </div>
          </>
        )}
      </div>

      <div className="p-3 bg-slate-50/50 flex items-center justify-end gap-2 flex-grow">
        {editMode ? (
          <>
            <button onClick={handleSave} disabled={isBusy} className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors" title="Salva" onMouseDown={e => e.stopPropagation()}><CheckIcon className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); setEditMode(false); setName(col.name); setDescription(col.description); }} className="p-2 rounded-lg border-2 border-slate-200 hover:bg-slate-100 transition-colors" title="Annulla"><XIcon className="w-4 h-4 text-slate-600" /></button>
          </>
        ) : (
          <>
            <button onClick={(e) => { e.stopPropagation(); setEditMode(true); }} className="p-2 text-slate-400 rounded-lg hover:bg-violet-100 hover:text-violet-600 transition-colors" title="Modifica"><EditIcon className="w-4 h-4" /></button>
            <button onClick={handleDelete} className="p-2 text-slate-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors" title="Elimina" onMouseDown={e => e.stopPropagation()}><TrashIcon className="w-4 h-4" /></button>
          </>
        )}
      </div>
    </div>
  );
}

// Helper to get favorite version or first version
const getFavoriteVersion = (versions: any[] | undefined) => {
  if (!versions || versions.length === 0) return undefined;
  const favorite = versions.find(v => v.is_favorite);
  return favorite || versions[0];
};

function PieceThumbnail({ imageSrc, pieceType }: { imageSrc: string | null; pieceType: string }) {
  const [hasError, setHasError] = useState(false);
  if (!imageSrc || hasError) {
    return <ChessPieceIcon type={pieceType} className="w-6 h-6" />;
  }
  return (
    <img
      src={imageSrc}
      alt={pieceType}
      className="w-full h-full object-contain"
      onError={() => setHasError(true)}
    />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sets' | 'collections'>('sets');
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  
  // Import set from ZIP
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importConflictModal, setImportConflictModal] = useState<{
    open: boolean;
    existingName: string;
    suggestedName: string;
    zipFile: File | null;
    customName: string;
    errorMessage: string;
  }>({ open: false, existingName: '', suggestedName: '', zipFile: null, customName: '', errorMessage: '' });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  // Fetch all chess sets
  const { data: sets, isLoading, error } = useQuery({
    queryKey: ['chess-sets'],
    queryFn: chessSetsApi.getAll,
  });

  // Create chess set mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateChessSetRequest) => chessSetsApi.create(data),
    onSuccess: (createdSet) => {
      // Invalidate list and close modal, then navigate to the newly created set page
      queryClient.invalidateQueries({ queryKey: ['chess-sets'] });
      setIsModalOpen(false);
      try {
        if (createdSet && (createdSet as any).id) {
          navigate(`/sets/${(createdSet as any).id}`);
        }
      } catch (e) {
        // ignore navigation errors
      }
    },
  });

  const handleCreateSet = (data: CreateChessSetRequest) => {
    createMutation.mutate(data);
  };

  // Handle import set from ZIP
  const handleImportSetClick = () => {
    importInputRef.current?.click();
  };

  const handleImportSetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input so the same file can be selected again
    e.target.value = '';
    
    await importSetFromZip(file);
  };

  const importSetFromZip = async (file: File, customName?: string) => {
    setIsImporting(true);
    setImportConflictModal(prev => ({ ...prev, errorMessage: '' }));
    try {
      const createdSet = await chessSetsApi.importSetFromZip(file, customName);
      queryClient.invalidateQueries({ queryKey: ['chess-sets'] });
      setImportConflictModal({ open: false, existingName: '', suggestedName: '', zipFile: null, customName: '', errorMessage: '' });
      // Navigate to the newly imported set
      if (createdSet && createdSet.id) {
        navigate(`/sets/${createdSet.id}`);
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Name conflict - show modal or update error message if modal already open
        const detail = err.response.data?.detail;
        if (importConflictModal.open) {
          // Modal is already open, show error message
          setImportConflictModal(prev => ({
            ...prev,
            errorMessage: `Il nome "${customName}" esiste già. Scegli un altro nome.`
          }));
        } else {
          // First conflict, open modal
          setImportConflictModal({
            open: true,
            existingName: detail?.existing_name || '',
            suggestedName: detail?.suggested_name || '',
            zipFile: file,
            customName: detail?.suggested_name || '',
            errorMessage: ''
          });
        }
      } else if (err.response?.status === 400) {
        // Invalid ZIP structure
        const detail = err.response.data?.detail;
        const message = typeof detail === 'object' ? detail.message : (detail || 'Struttura ZIP non valida');
        alert(`Errore: ${message}`);
      } else {
        alert('Errore durante l\'importazione del set');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleConflictSubmit = () => {
    const name = importConflictModal.customName.trim();
    if (!name) {
      setImportConflictModal(prev => ({ ...prev, errorMessage: 'Inserisci un nome valido' }));
      return;
    }
    if (importConflictModal.zipFile) {
      importSetFromZip(importConflictModal.zipFile, name);
    }
  };

  const handleConflictCancel = () => {
    setImportConflictModal({ open: false, existingName: '', suggestedName: '', zipFile: null, customName: '', errorMessage: '' });
  };

  useEffect(() => {
    if (activeTab === 'collections') {
      collectionsApi.getAll().then(data => setCollections(data || [])).catch(() => setCollections([]));
    }
  }, [activeTab]);

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-gray-500 animate-spin" />
          <p className="mt-4 text-gray-700 text-lg">Sto caricando le scacchiere, attendere...</p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[200px] animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500 italic">Se la pagina non si sbloccasse da sola, prova ad aggiornare la pagina dopo qualche secondo — a volte il server sta preparando i file.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Le tue Scacchiere</h2>
          <p className="mt-2 text-slate-500 font-medium">Gestisci i design delle tue scacchiere e i modelli 3D</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('sets')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'sets' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Scacchiere</button>
          <button onClick={() => setActiveTab('collections')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'collections' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Collezioni</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'collections' ? (
          <>
            <button
              onClick={() => setIsCollectionModalOpen(true)}
              className="group relative bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-500 hover:bg-violet-50/30 transition-colors flex flex-col items-center justify-center min-h-[200px] cursor-pointer"
            >
              <Plus className="w-10 h-10 text-slate-400 group-hover:text-violet-500 mb-3 transition-colors" />
              <h3 className="text-lg font-semibold text-slate-700 group-hover:text-violet-600 transition-colors">Crea Collezione</h3>
              <p className="text-sm text-slate-500 mt-1">Raggruppa più scacchiere</p>
            </button>

            {collections.map(col => (
              <CollectionCard key={col.id} col={col} onOpen={() => { setSelectedCollectionId(col.id); setDetailModalOpen(true); }} onRefresh={() => collectionsApi.getAll().then(d => setCollections(d || [])).catch(() => {})} />
            ))}
          </>
        ) : (
          <>
            <button
              onClick={() => setIsModalOpen(true)}
              className="group relative bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-500 hover:bg-violet-50/30 transition-colors flex flex-col items-center justify-center min-h-[200px] cursor-pointer"
            >
              <Plus className="w-10 h-10 text-slate-400 group-hover:text-violet-500 mb-3 transition-colors" />
              <h3 className="text-lg font-semibold text-slate-700 group-hover:text-violet-600 transition-colors">Crea Scacchiera</h3>
              <p className="text-sm text-slate-500 mt-1">Nuovo progetto</p>
            </button>

            <button
              onClick={() => navigate('/game/setup')}
              className="group relative bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/30 transition-colors flex flex-col items-center justify-center min-h-[200px] cursor-pointer"
            >
              <Swords className="w-10 h-10 text-slate-400 group-hover:text-teal-500 mb-3 transition-colors" />
              <h3 className="text-lg font-semibold text-slate-700 group-hover:text-teal-600 transition-colors">Gioca 1 vs 1</h3>
              <p className="text-sm text-slate-500 mt-1">Partita Locale</p>
            </button>

            <button
              onClick={handleImportSetClick}
              disabled={isImporting}
              className="group relative bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 transition-colors flex flex-col items-center justify-center min-h-[200px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <Loader2 className="w-10 h-10 text-indigo-500 mb-3 animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 mb-3 transition-colors" />
              )}
              <h3 className="text-lg font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                {isImporting ? 'Importazione...' : 'Carica Scacchiera'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Importa da ZIP</p>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportSetFile}
              className="hidden"
            />

            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100 min-h-[200px] animate-pulse">
                    <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                ))}
              </>
            ) : (
              sets?.map((set) => (
                <button
                  key={set.id}
                  onClick={() => navigate(`/sets/${set.id}`)}
                  className="group bg-white rounded-2xl shadow-sm border-2 border-slate-100 hover:shadow-lg hover:border-violet-300 transition-all text-left overflow-hidden flex flex-col hover:-translate-y-1"
                >
                  <div className="p-6 border-b border-slate-100 flex flex-col min-h-[140px]">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-violet-600 mb-2 transition-colors line-clamp-1">{set.name}</h3>
                    <p className="text-slate-500 text-sm line-clamp-2 min-h-[40px]">
                      {set.description || <span className="opacity-0">-</span>}
                    </p>
                    <div className="flex items-center text-sm text-slate-400 mt-auto pt-2"><Calendar className="w-4 h-4 mr-1" />{new Date(set.created_at).toLocaleDateString('it-IT')}</div>
                  </div>

                  <div className="p-4 grid grid-cols-3 grid-rows-2 gap-3 flex-grow bg-slate-50/50">
                    {set.pieces.map((piece) => {
                      const favoriteVersion = getFavoriteVersion(piece.versions);
                      const imageSrc = favoriteVersion?.img_front ? getFileUrl(favoriteVersion.img_front) : null;
                      const completionPercentage = favoriteVersion?.completion_percentage || 0;
                      const isComplete = favoriteVersion?.is_complete || false;
                      const has3DModel = !!favoriteVersion?.model_glb;

                      return (
                        <div key={piece.id} className="aspect-square bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center relative group-hover:border-violet-200 transition-colors">
                          <PieceThumbnail imageSrc={imageSrc} pieceType={piece.type} />

                          {has3DModel && (
                            <div className="absolute top-1.5 left-1.5 flex items-center justify-center pointer-events-none" title="Modello 3D pronto">
                              <Box className="w-4 h-4 text-violet-400 drop-shadow-sm group-hover:text-violet-500 transition-colors" strokeWidth={2.5} />
                            </div>
                          )}

                          <div className="absolute bottom-1 right-1">
                            {isComplete ? (
                              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </div>
                            ) : (
                              <svg className="w-8 h-8" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="35" fill="white" />
                                <circle cx="50" cy="50" r="35" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                <circle cx="50" cy="50" r="35" fill="none" stroke={completionPercentage > 50 ? "#8b5cf6" : "#c4b5fd"} strokeWidth="12" strokeDasharray={`${2 * Math.PI * 35}`} strokeDashoffset={`${2 * Math.PI * 35 * (1 - completionPercentage / 100)}`} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 0.3s ease' }} />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>

      {/* Create Set Modal */}
      <CreateSetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSet}
        isLoading={createMutation.isPending}
      />
      <CreateCollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onCreated={() => {
          // refresh collections list
          collectionsApi.getAll().then(data => setCollections(data || [])).catch(() => {});
        }}
      />
      {selectedCollectionId && (
        <CollectionDetailModal
          collectionId={selectedCollectionId}
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedCollectionId(null);
            collectionsApi.getAll().then(data => setCollections(data || [])).catch(() => {});
          }}
          onChanged={() => collectionsApi.getAll().then(data => setCollections(data || [])).catch(() => {})}
        />
      )}

      {/* Import Conflict Modal */}
      {importConflictModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nome già esistente</h3>
            <p className="text-gray-600 mb-4">
              Una scacchiera con il nome <strong>"{importConflictModal.existingName}"</strong> esiste già.
            </p>
            <p className="text-gray-600 mb-2">Inserisci un nuovo nome per la scacchiera:</p>
            <input
              type="text"
              value={importConflictModal.customName}
              onChange={(e) => setImportConflictModal(prev => ({ ...prev, customName: e.target.value, errorMessage: '' }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConflictSubmit(); }}
              placeholder="Nome scacchiera"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${importConflictModal.errorMessage ? 'border-red-500' : 'border-gray-300'}`}
              autoFocus
            />
            {importConflictModal.errorMessage && (
              <p className="text-red-500 text-sm mt-1">{importConflictModal.errorMessage}</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleConflictCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                onClick={handleConflictSubmit}
                disabled={isImporting || !importConflictModal.customName.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                Importa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
