import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { chessSetsApi, collectionsApi } from '../services/api';
import type { ChessSetWithPieces } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateCollectionModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availableSets, setAvailableSets] = useState<ChessSetWithPieces[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    chessSetsApi.getAll().then(data => setAvailableSets(data || [])).catch(() => setAvailableSets([]));
  }, [isOpen]);

  const toggleSet = (id: number) => {
    setSelectedSetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const created = await collectionsApi.create({ name, description });
      const id = created.id;
      // attach selected sets
      await Promise.all(selectedSetIds.map(sid => collectionsApi.addSet(id, sid)));
      setName(''); setDescription(''); setSelectedSetIds([]);
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      console.error('Error creating collection', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Crea Collezione</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isLoading}><X className="w-6 h-6"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scegli Scacchiere da aggiungere</label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded p-2">
              {availableSets.map(s => (
                <label key={s.id} className={`p-2 border rounded flex items-center gap-2 cursor-pointer ${selectedSetIds.includes(s.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
                  <input type="checkbox" checked={selectedSetIds.includes(s.id)} onChange={() => toggleSet(s.id)} />
                  <div className="text-sm">{s.name}</div>
                </label>
              ))}
              {availableSets.length === 0 && <div className="text-gray-500 text-sm">Nessuna scacchiera disponibile</div>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded" disabled={isLoading}>Annulla</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded" disabled={isLoading || !name.trim()}>{isLoading ? 'Creando...' : 'Crea Collezione'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
