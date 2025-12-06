import { useEffect, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collectionsApi, chessSetsApi, getFileUrl } from '../services/api';
import type { ChessSetWithPieces } from '../types';
import { ChessPieceIcon } from './ChessPieceIcon';

interface Props {
  collectionId: number;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void; // called after update/delete
}

export default function CollectionDetailModal({ collectionId, isOpen, onClose, onChanged }: Props) {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any | null>(null);
  const [availableSets, setAvailableSets] = useState<ChessSetWithPieces[]>([]);
  // loading state intentionally unused visually for now
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
  if (!isOpen) return;
    Promise.all([
      collectionsApi.getById(collectionId),
      chessSetsApi.getAll()
    ]).then(([col, sets]) => {
      setCollection(col);
      setAvailableSets(sets || []);
    }).catch((e) => console.error(e));
  }, [isOpen, collectionId]);

  const handleRemoveSet = async (setId: number) => {
    if (!collection) return;
    try {
      await collectionsApi.removeSet(collection.id, setId);
      const refreshed = await collectionsApi.getById(collection.id);
      // if collection becomes empty, delete it automatically
      if (!refreshed.sets || refreshed.sets.length === 0) {
        await collectionsApi.delete(collection.id);
        onClose();
        if (onChanged) onChanged();
        return;
      }
      setCollection(refreshed);
      if (onChanged) onChanged();
    } catch (e) {
      console.error(e);
    } finally {
    }
  };

  const handleAddSet = async (setId: number) => {
    if (!collection) return;
    try {
      await collectionsApi.addSet(collection.id, setId);
      const refreshed = await collectionsApi.getById(collection.id);
      setCollection(refreshed);
      setShowPicker(false);
      if (onChanged) onChanged();
    } catch (e) {
      console.error(e);
    } finally {
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => onClose()} />

      <div className="relative bg-white w-[90%] max-w-5xl h-[85vh] rounded-lg shadow-xl overflow-auto z-60">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-semibold">{collection?.name || 'Collezione'}</h3>
            {collection && <div className="text-sm text-gray-500">{collection.sets?.length || 0} scacchiere</div>}
          </div>
          <div>
            <button onClick={() => onClose()} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {/* First small card: add new set */}
            <div className="flex items-center justify-center">
              <button onClick={() => setShowPicker(!showPicker)} className="w-28 h-32 border-2 border-dashed rounded flex flex-col items-center justify-center text-gray-500 hover:border-blue-400">
                <Plus className="w-6 h-6 mb-1" />
                <div className="text-sm">Aggiungi</div>
              </button>
            </div>

            {/* Render current sets as cards */}
            {(collection?.sets || []).map((s: any) => (
              <div key={s.id} className="relative w-full h-32 border rounded p-2 flex flex-col cursor-pointer" onClick={() => navigate(`/sets/${s.id}`)}>
                <button onClick={(e) => { e.stopPropagation(); handleRemoveSet(s.id); }} className="absolute top-1 right-1 p-1 rounded bg-white hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    {s.pieces[0] ? (
                      s.pieces[0].versions[0]?.img_front ? <img src={getFileUrl(s.pieces[0].versions[0].img_front) as string} className="w-full h-full object-contain" /> : <ChessPieceIcon type={s.pieces[0].type} className="w-6 h-6" />
                    ) : <div className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-gray-500">{s.pieces.length} pezzi</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Picker: show available sets not already in collection */}
          {showPicker && (
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Scegli scacchiere da aggiungere</h4>
              <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {availableSets.filter(s => !(collection?.sets || []).some((cs: any) => cs.id === s.id)).map(s => (
                  <div key={s.id} className="border rounded p-2 flex flex-col cursor-pointer hover:shadow" onClick={() => handleAddSet(s.id)}>
                    <div className="w-full h-24 bg-gray-50 rounded mb-2 flex items-center justify-center">
                      {s.pieces[0] ? (
                        s.pieces[0].versions[0]?.img_front ? <img src={getFileUrl(s.pieces[0].versions[0].img_front) as string} className="w-full h-full object-contain" /> : <ChessPieceIcon type={s.pieces[0].type} className="w-6 h-6" />
                      ) : <div className="w-6 h-6" />}
                    </div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.pieces.length} pezzi</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
