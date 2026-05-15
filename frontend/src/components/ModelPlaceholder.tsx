/**
 * Model Placeholder Component
 * Shows a +Carica button for uploading a 3D model when not present
 */
import { useRef } from 'react';
import { Box } from 'lucide-react';

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
    <>
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
        className="w-full h-full rounded-xl border-2 border-slate-200 hover:border-violet-400 overflow-hidden bg-slate-900 flex flex-col items-center justify-center transition-all hover:scale-[1.02] hover:shadow-lg"
        title={`Carica — ${label}`}
      >
        <Box className="w-6 h-6 text-slate-300 mb-1" />
        <span className="text-xs text-slate-400 text-center px-1 leading-tight">{label}</span>
      </button>
    </>
  );
}
