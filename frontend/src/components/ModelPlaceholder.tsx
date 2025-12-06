/**
 * Model Placeholder Component
 * Shows a +Carica button for uploading a 3D model when not present
 */
import { useRef } from 'react';
import { Plus, Box } from 'lucide-react';

interface ModelPlaceholderProps {
  label: string;
  onUpload: (file: File) => void;
  accept?: string;
}

export default function ModelPlaceholder({ label, onUpload, accept = '.glb,.gltf,.stl' }: ModelPlaceholderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 relative">
      <Box className="w-8 h-8 text-gray-400 mb-2" />
      <span className="text-gray-400 text-sm mb-2">{label}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
      >
        <Plus className="w-4 h-4" />
        Carica
      </button>
    </div>
  );
}
