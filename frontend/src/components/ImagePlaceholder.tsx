/**
 * Image Placeholder Component
 * Shows a +Carica button for uploading an image when not present
 */
import { useRef } from 'react';
import { Plus } from 'lucide-react';

interface ImagePlaceholderProps {
  label: string;
  onUpload: (file: File) => void;
  accept?: string;
}

export default function ImagePlaceholder({ label, onUpload, accept = 'image/*' }: ImagePlaceholderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 relative">
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
