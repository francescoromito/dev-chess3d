import { useState, FormEvent, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditEntityModalProps {
  isOpen: boolean;
  title?: string;
  initialName?: string | null;
  initialDescription?: string | null;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (data: { name?: string; description?: string }) => void;
}

export default function EditEntityModal({
  isOpen,
  title = 'Modifica',
  initialName = '',
  initialDescription = '',
  isLoading = false,
  onClose,
  onSubmit,
}: EditEntityModalProps) {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');

  // sync when opened with new initials using useEffect
  useEffect(() => {
    if (isOpen) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name?.trim() || undefined, description: description?.trim() || undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isLoading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name ?? ''}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded" disabled={isLoading}>
              Annulla
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={isLoading}>
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
