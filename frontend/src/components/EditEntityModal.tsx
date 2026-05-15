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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors" 
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
            <input
              type="text"
              value={name ?? ''}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrizione</label>
            <textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all shadow-sm resize-y"
              rows={4}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm" 
              disabled={isLoading}
            >
              Annulla
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed" 
              disabled={isLoading}
            >
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
