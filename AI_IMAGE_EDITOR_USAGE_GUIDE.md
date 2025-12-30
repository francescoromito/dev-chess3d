# 🎨 AI Image Editor Usage Guide

## Quick Start

### Opening the Editor

```typescript
import AIImageEditor from './components/AIImageEditor';
import { useState } from 'react';

export function MyComponent() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsEditorOpen(true)}>
        Open Image Editor
      </button>
      
      <AIImageEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onGenerate={(files) => {
          console.log('Generated/Edited files:', files);
          // Process the generated/edited images
        }}
      />
    </>
  );
}
```

---

## Mode 1: Generate New Images

### Use Case
User wants to create new chess piece images from scratch using text description.

### How To

1. **Open Editor**
   - Click "Open Image Editor" button
   - AIImageEditor modal opens

2. **Write Prompt**
   - Leave image gallery empty (don't upload)
   - Type in the prompt field: "A wooden knight chess piece with modern design"
   - Adjust "Varianti" (1-4 images)

3. **Click Generate**
   - Button shows "Genera"
   - Click button or press Ctrl+Enter
   - Wait 10-30 seconds for generation

4. **Select Result**
   - Click on one of the generated images
   - Modal shows "Cosa vuoi fare con questa immagine?"
   - Click "Usa Immagine" to apply
   - `onGenerate` callback called with selected File
   - Editor closes

### Example Prompts

```
"A gold chess queen with intricate details"
"Silver bishop piece with medieval style"
"Modern glass rook with metallic reflection"
"Ceramic knight horse in minimalist design"
```

---

## Mode 2: Edit Existing Images

### Use Case
User wants to modify uploaded chess piece images with AI.

### How To

1. **Open Editor**
   - Click "Open Image Editor" button
   - AIImageEditor modal opens

2. **Upload Image(s)**
   - Click "Carica Immagini" button
   - Select one or more image files
   - Images appear in left sidebar gallery

3. **Select Images**
   - Click on image(s) to select (shows selection order badge)
   - Can select up to 5 images
   - Selected images have blue border

4. **Write Editing Prompt**
   - Type editing instruction in prompt field
   - Examples: "Rotate 90 degrees clockwise", "Make it golden", "Add shine"
   - Adjust "Varianti" (number of variations, 1-4)

5. **Click Modify**
   - Button shows "Modifica" when images selected
   - Click button or press Ctrl+Enter
   - Selected images uploaded to FAL
   - Edit request sent to AI model
   - Wait 10-30 seconds for editing

6. **Select Result**
   - Click on one of the edited images
   - Modal shows "Cosa vuoi fare con questa immagine?"
   - **Option A**: Click "Usa Immagine" → Done, editor closes
   - **Option B**: Click "Continua Modifiche" → Image added to stack, ready for more edits

### Example Editing Prompts

```
"Rotate 90 degrees clockwise"
"Rotate 90 degrees counter-clockwise"
"Show the back view of this piece"
"Make it gold with reflections"
"Add purple highlights"
"Change color to silver"
"Make it look more realistic"
"Add a smooth glossy finish"
```

---

## Advanced: Multiple Edit Iterations

The editor supports iterative editing:

```
1. Upload bishop piece image
2. Select image
3. Edit 1: "Rotate 90 degrees"
   ├─ Click "Continua Modifiche"
   └─ Rotated image added to stack
4. Edit 2: "Make it gold"
   ├─ Click "Continua Modifiche"
   └─ Golden rotated image added to stack
5. Edit 3: "Add shine"
   └─ Click "Usa Immagine" → Done!
```

---

## API Calls Made

### Generate Mode

```
1. POST /api/ai/generate
   Request: { prompt, model_name, num_images }
   Response: { images: [...], request_id, model_used, num_generated }

2. fetch() - Download each generated image
3. GET /api/auth/me - Refresh user credits
```

### Edit Mode

```
1. POST /api/ai/upload (for each selected image)
   Request: FormData { image_file }
   Response: { url, filename, content_type }

2. POST /api/ai/edit
   Request: { image_url, edit_type: 'generic_edit', custom_prompt, num_images }
   Response: { images: [...], request_id, edit_type, num_generated }

3. fetch() - Download each edited image
4. GET /api/auth/me - Refresh user credits
```

---

## Callback Handler

### onGenerate Callback

Called when user selects a result image and clicks "Usa Immagine".

```typescript
const handleGenerate = (files: File[]) => {
  // files contains the selected image(s)
  // files[0] = selected File object
  
  // Example: Save to state
  setEditedImage(files[0]);
  
  // Example: Upload to version
  const formData = new FormData();
  formData.append('img_front', files[0]);
  await updateVersion(formData);
  
  // Editor will close automatically
};

<AIImageEditor
  isOpen={isEditorOpen}
  onClose={() => setIsEditorOpen(false)}
  onGenerate={handleGenerate}
/>
```

---

## Component Props

```typescript
interface AIImageEditorProps {
  isOpen: boolean;           // Show/hide editor
  onClose: () => void;       // Called when closing editor
  onGenerate?: (files: File[]) => void;  // Called with result
  initialImage?: File;       // Pre-load image (optional)
}
```

### Examples with Props

```typescript
// Basic usage
<AIImageEditor
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>

// With callback
<AIImageEditor
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onGenerate={(files) => console.log('Got files:', files)}
/>

// With initial image for editing
<AIImageEditor
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onGenerate={handleResult}
  initialImage={currentImage}
/>
```

---

## Error Handling

The component handles errors gracefully:

```typescript
// Insufficient credits
"Crediti insufficienti. Necessari: 0.04, Disponibili: 0.02"

// Invalid prompt
Button disabled if prompt is empty

// API errors
"Operazione fallita. Riprova. Errore: ..."

// All errors shown in alert dialog
```

---

## UI States

### Sidebar - Image Gallery
- **Empty**: Shows placeholder
- **With Images**: Shows grid of thumbnails
- **Selected**: Blue border + order number badge
- **Hover**: Show remove (X) button

### Bottom - Prompt Area
- **Prompt Input**: Shows dynamic placeholder based on context
- **Button Text**: "Genera" (no images) or "Modifica" (images selected)
- **Cost Display**: Shows 💰 cost breakdown
- **Status**: Shows "Elaborando..." during processing

### Center - Preview Area
- **Idle**: Shows placeholder
- **Loading**: Shows spinner
- **Results**: Shows grid of generated/edited images
- **Selection**: Shows large image + action buttons

---

## Tips & Tricks

### ✅ Do's
- ✅ Be specific in prompts ("Rotate 90 clockwise" vs "Rotate it")
- ✅ Use "Continua Modifiche" for iterative editing
- ✅ Check available credits before starting
- ✅ Wait for full processing (10-30 seconds)
- ✅ Select relevant images before editing

### ❌ Don'ts
- ❌ Don't close modal during processing
- ❌ Don't submit empty prompts
- ❌ Don't expect instant results
- ❌ Don't select more than 5 images
- ❌ Don't use if low on credits

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Submit prompt (Generate/Modify) |
| `Escape` | Close editor |
| Click image | Select/deselect |
| Click X | Remove image |

---

## Cost Example

```
Model: fal-ai/nano-banana
Price: 💰 0.039 per image

Examples:
- 1 image: 💰 0.039
- 2 images: 💰 0.078
- 3 images: 💰 0.117
- 4 images: 💰 0.156

Cost shown in editor before submitting
```

---

## Troubleshooting

### "Immagini non caricate"
- Check browser console for errors
- Verify file is valid image (JPG, PNG, WebP)
- Try smaller file size

### "Modifica fallita"
- Check internet connection
- Verify image is valid
- Check user has credits
- Try different prompt

### "Crediti insufficienti"
- Need to add credits
- Each operation costs 💰 0.039 per image
- Check user.credits in dashboard

### Long loading time
- Normal for AI processing (10-30 seconds)
- Don't close modal
- Don't refresh page

---

## Integration Examples

### With Piece Version Editor

```typescript
// In CreateVersionModal or EditVersionModal
const [editorOpen, setEditorOpen] = useState(false);
const [generatedImage, setGeneratedImage] = useState<File | null>(null);

const handleAIGenerate = (files: File[]) => {
  setGeneratedImage(files[0]);
  setImgFront(files[0]); // Set as front image
};

return (
  <>
    <button onClick={() => setEditorOpen(true)}>
      Generate with AI
    </button>
    
    <AIImageEditor
      isOpen={editorOpen}
      onClose={() => setEditorOpen(false)}
      onGenerate={handleAIGenerate}
    />
    
    {generatedImage && (
      <div>
        <img src={URL.createObjectURL(generatedImage)} />
        <p>Ready to save as version</p>
      </div>
    )}
  </>
);
```

---

Made with ❤️ for Chess 3D
