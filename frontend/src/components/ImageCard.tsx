/**
 * Image Card Component
 * Displays an image as a clickable card that opens in a modal with edit option
 */
import { useState, useRef } from 'react';
import { X, ZoomIn, Edit, Trash2, Sparkles } from 'lucide-react';

interface ImageCardProps {
  src: string;
  alt: string;
  label: string;
  fieldName: string;
  onImageChange?: (fieldName: string, file: File) => void;
  onRemove?: () => void;
  onAIEdit?: () => void;
}

export default function ImageCard({ src, alt, label, fieldName, onImageChange, onRemove, onAIEdit }: ImageCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageChange) {
      onImageChange(fieldName, file);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Card - Fixed aspect ratio with proper image containment */}
      <div
        onClick={() => setIsOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
      >
        {/* Remove button overlay */}
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Rimuovi"
            className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-600 hover:text-white" />
          </button>
        )}
        <div className="aspect-square flex items-center justify-center p-2">
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain transition-transform group-hover:scale-105"
          />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-white text-sm font-medium">{label}</p>
        </div>
      </div>

      {/* Modal with Edit Button */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
              {/* Header with label and edit button */}
              <div className="p-3 bg-gray-100 border-b flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <div className="flex items-center gap-2">
                  {onAIEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsOpen(false); onAIEdit(); }}
                      className="inline-flex items-center px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Modifica con AI
                    </button>
                  )}
                  {onImageChange && (
                    <button
                      onClick={handleEditClick}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      Cambia immagine
                    </button>
                  )}
                </div>
              </div>
              
              {/* Image container */}
              <div className="flex items-center justify-center bg-gray-50 p-4">
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
