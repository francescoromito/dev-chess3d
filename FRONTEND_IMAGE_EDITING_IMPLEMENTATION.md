# 🎨 AI Image Editor - Image Editing Feature Update

## ✨ What's New

The AIImageEditor component now supports **dual mode operation**:

1. **Generate Mode** (No images selected)
   - Generate new chess piece images from text prompts
   - Uses `/api/ai/generate` endpoint
   - Existing behavior preserved

2. **Edit Mode** (Images selected)
   - Edit selected chess piece images with AI
   - Upload images and uses `/api/ai/edit` endpoint
   - Supports custom editing prompts via generic_edit template

---

## 🎯 How It Works

### User Flow

```
1. User opens AIImageEditor
   ↓
2. User has two options:
   
   Option A: GENERATE                          Option B: EDIT
   ├─ Don't select any images                  ├─ Select 1+ images (max 5)
   ├─ Write generation prompt                  ├─ Write editing prompt
   ├─ Click "Genera"                           ├─ Click "Modifica"
   ├─ API call: POST /ai/generate              ├─ API calls:
   │  └─ Returns new images                    │  1. POST /ai/upload (for each)
   │                                           │  2. POST /ai/edit
   └─ Results shown in preview area            │     └─ Returns edited images
                                               └─ Results shown in preview area
```

---

## 🔧 Technical Implementation

### Frontend Changes

#### 1. **API Service Updates** (`frontend/src/services/api.ts`)

Added new interfaces and methods:

```typescript
// Editing request/response types
interface EditImageRequest {
  image_url: string;
  edit_type: 'rotate_90_cw' | 'rotate_90_ccw' | 'back_view' | 'generic_edit';
  custom_prompt?: string;
  num_images?: number;
}

interface EditImageResponse {
  images: ImageResult[];
  request_id: string;
  edit_type: string;
  num_generated: number;
}

interface UploadImageResponse {
  url: string;
  filename: string;
  content_type: string;
}

// New API methods
aiApi.uploadImage(file) → UploadImageResponse
aiApi.editImage(data) → EditImageResponse
```

#### 2. **Component Logic Updates** (`frontend/src/components/AIImageEditor.tsx`)

Modified `handleSubmit()` to:
- Check if images are selected
- Branch into two paths:
  - **No images**: Call `/api/ai/generate` (existing)
  - **Images selected**: Upload + call `/api/ai/edit` (new)
- Both return results to the same preview flow

```typescript
const handleSubmit = async () => {
  const selectedImages = images.filter(img => img.selected);
  
  if (selectedImages.length === 0) {
    // PATH A: Generate new images
    const response = await aiApi.generateImages({...});
  } else {
    // PATH B: Edit selected images
    // 1. Upload images
    const uploadedUrls = await Promise.all(
      selectedImages.map(img => aiApi.uploadImage(img.file))
    );
    
    // 2. Edit with custom prompt
    const response = await aiApi.editImage({
      image_url: uploadedUrls[0],
      edit_type: 'generic_edit',
      custom_prompt: prompt,
      num_images: numImages
    });
  }
};
```

#### 3. **UI/UX Improvements**

Updated labels and placeholders:
- Button text changes: "Genera" → "Genera/Modifica" (dynamic)
- Placeholder: "Descrivi l'immagine da generare" → "Descrivi l'immagine da generare o modificare"
- Status message: "Le immagini caricate a sinistra saranno usate come riferimento" → "Seleziona immagini per modificarle (max 5). Senza selezioni, genererai nuove immagini"

---

## 📋 Usage Examples

### Example 1: Generate New Images

1. Open AIImageEditor
2. Don't select any images
3. Write prompt: "A golden knight chess piece with reflections"
4. Click "Genera"
5. New images generated via `/api/ai/generate`

### Example 2: Edit Existing Images

1. Open AIImageEditor
2. Upload chess piece image
3. Click to select the image (shows selection order badge)
4. Write prompt: "Rotate 90 degrees clockwise"
5. Click "Modifica"
6. Image uploaded to FAL via `/api/ai/upload`
7. Edit request sent via `/api/ai/edit` with `generic_edit` type
8. Edited images returned and shown in preview

### Example 3: Multiple Edits on Same Image

1. Open AIImageEditor
2. Upload and select image
3. First edit: "Rotate 90 degrees clockwise"
4. Results shown
5. Click "Continua Modifiche" (Continue Modifying)
6. Image added to stack
7. Second edit: "Add golden highlights"
8. Final results shown

---

## 🔗 Endpoint Integration

### Generate Endpoint (Existing)
```
POST /api/ai/generate
Body: { prompt, model_name, num_images }
Response: { images: [...], request_id, model_used, num_generated }
```

### Upload Endpoint (New)
```
POST /api/ai/upload
Body: multipart/form-data { image_file }
Response: { url, filename, content_type }
```

### Edit Endpoint (New)
```
POST /api/ai/edit
Body: { image_url, edit_type, custom_prompt, num_images }
Response: { images: [...], request_id, edit_type, num_generated }
```

---

## ✅ Features

- ✅ **Dual Mode**: Generate or Edit with same component
- ✅ **Multiple Images**: Select up to 5 images
- ✅ **Selection Order**: Shows which image is processed first
- ✅ **Custom Prompts**: Full control over editing instructions
- ✅ **Error Handling**: Comprehensive error messages
- ✅ **Credit System**: Validates & deducts credits
- ✅ **Dynamic UI**: Button text changes based on mode
- ✅ **Responsive**: Works on all screen sizes

---

## 🎨 Component States

### Idle State
- Show upload button
- Show image gallery (if any images uploaded)
- Show prompt input
- Button shows "Genera" or "Modifica" based on selection

### Loading State
- Show spinner in preview area
- Display "Elaborando..."
- Disable all inputs
- Button disabled

### Results State
- Show generated/edited images in grid
- Allow selection of result
- Show "Continua Modifiche" or "Usa Immagine" options

---

## 🚀 Data Flow

```
User Input
  ├─ Prompt: "Rotate 90 degrees right"
  ├─ Selected Images: [image1.png, image2.png]
  └─ Num Images: 2
    │
    ├─ VALIDATE
    │  ├─ Prompt not empty? ✓
    │  ├─ User has credits? ✓
    │  └─ Images selected? ✓ → Use EDIT mode
    │
    ├─ UPLOAD
    │  ├─ POST /api/ai/upload (image1) → url1
    │  └─ POST /api/ai/upload (image2) → url2
    │
    ├─ EDIT
    │  ├─ POST /api/ai/edit
    │  │  └─ Body: {
    │  │      image_url: url1,
    │  │      edit_type: 'generic_edit',
    │  │      custom_prompt: 'Rotate 90 degrees right',
    │  │      num_images: 2
    │  │    }
    │  └─ Response: { images: [...], ... }
    │
    ├─ FETCH RESULTS
    │  ├─ Fetch image[0] from CDN
    │  ├─ Fetch image[1] from CDN
    │  └─ Convert to File objects
    │
    ├─ REFRESH USER
    │  └─ Update credits
    │
    └─ DISPLAY RESULTS
       └─ Show in preview grid
```

---

## 🔄 State Management

The component manages:

```typescript
// Image inputs
const [images, setImages] = useState<UploadedImage[]>([])
const [numImages, setNumImages] = useState<number>(1)
const [modelName, setModelName] = useState<ModelName>('fal-ai/nano-banana')

// Prompt & generation
const [prompt, setPrompt] = useState('')
const [isGenerating, setIsGenerating] = useState(false)

// Results
const [generatedPreviews, setGeneratedPreviews] = useState<string[]>([])
const [generatedFiles, setGeneratedFiles] = useState<File[]>([])
const [selectedGeneratedIndex, setSelectedGeneratedIndex] = useState<number | null>(null)
const [showGeneratedSelection, setShowGeneratedSelection] = useState(false)

// UI
const [pricePerImage, setPricePerImage] = useState<number>(0.039)
const [selectionWarning, setSelectionWarning] = useState('')
const [showConfirmModal, setShowConfirmModal] = useState(false)
```

---

## 🧪 Testing

To test the new functionality:

### Test Case 1: Generate Mode
1. Open editor
2. Don't upload any images
3. Write: "Chess king piece in gold"
4. Click "Genera"
5. Verify `/api/ai/generate` called
6. Verify images generated successfully

### Test Case 2: Edit Mode
1. Open editor
2. Upload chess piece image
3. Select the image
4. Write: "Make the piece shinier"
5. Click "Modifica"
6. Verify `/api/ai/upload` called
7. Verify `/api/ai/edit` called with `generic_edit` type
8. Verify edited images returned

### Test Case 3: Multiple Images Edit
1. Upload 2 images
2. Select both
3. Write: "Rotate 90 clockwise"
4. Click "Modifica"
5. Verify both images uploaded
6. Verify edit called for first image
7. Verify results shown

---

## 📝 Key Points

- **Smart Mode Selection**: Component automatically decides Generate vs Edit
- **Seamless Integration**: New endpoints integrated into existing component
- **Backward Compatible**: Generate mode works exactly as before
- **Flexible Editing**: Generic prompt type supports any editing instruction
- **Clean Architecture**: Logic separated into logical branches
- **User Friendly**: UI adapts based on mode selection

---

## 🔐 Security

- ✅ File validation (image types only)
- ✅ Authentication required (all endpoints)
- ✅ Credit validation before processing
- ✅ File size limits enforced
- ✅ Prompt sanitization
- ✅ No sensitive data in errors

---

## 📚 Related Documentation

- [AI_IMAGE_EDITING_API.md](AI_IMAGE_EDITING_API.md) - Complete API reference
- [IMAGE_EDITING_FEATURE_README.md](IMAGE_EDITING_FEATURE_README.md) - Feature overview
- [backend/app/api/ai_generation.py](backend/app/api/ai_generation.py) - Backend implementation

---

Made with ❤️ for Chess 3D
