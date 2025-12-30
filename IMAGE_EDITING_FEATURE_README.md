# 🎨 Image Editing Feature - Complete Implementation

## Overview
Added comprehensive AI-powered image editing capabilities to the Chess 3D API. Users can now upload chess piece images and apply predefined or custom edits using AI models.

## What's New

### ✨ New API Endpoints

#### 1. **POST /api/ai/upload**
Upload images to FAL AI storage for use in editing operations.

**Request:**
```bash
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image_file=@piece.png"
```

**Response:**
```json
{
  "url": "https://fal.ai/...",
  "filename": "piece.png",
  "content_type": "image/png"
}
```

---

#### 2. **POST /api/ai/edit**
Edit chess piece images using AI with predefined or custom prompts.

**Request:**
```json
{
  "image_url": "https://fal.ai/...",
  "edit_type": "rotate_90_cw",
  "custom_prompt": null,
  "num_images": 1
}
```

**Edit Types Available:**
- `rotate_90_cw` - Rotate 90° clockwise
- `rotate_90_ccw` - Rotate 90° counter-clockwise
- `back_view` - Generate back view of piece
- `generic_edit` - Apply custom prompt (requires `custom_prompt` field)

**Response:**
```json
{
  "images": [
    {
      "url": "https://fal.ai/...",
      "content_type": "image/png"
    }
  ],
  "request_id": "req-123...",
  "edit_type": "rotate_90_cw",
  "num_generated": 1
}
```

---

### 📁 New Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── ai_generation.py          ← UPDATED with new functions & endpoints
│   │   ├── auth.py
│   │   ├── chess_engine.py
│   │   ├── collections.py
│   │   ├── pieces.py
│   │   ├── prices.py
│   │   └── sets.py
│   │
│   ├── prompts/                      ← NEW: Jinja2 templates directory
│   │   ├── __init__.py
│   │   ├── rotate_90_cw.jinja        ← Clockwise rotation prompt
│   │   ├── rotate_90_ccw.jinja       ← Counter-clockwise rotation prompt
│   │   ├── back_view.jinja           ← Back view generation prompt
│   │   └── generic_edit.jinja        ← Custom prompt template (with variables)
│   │
│   ├── database.py
│   ├── main.py
│   └── models.py
│
├── requirements.txt                  ← UPDATED with new dependencies
└── test_image_editing_api.py        ← NEW: Example test script
```

---

### 🔧 Dependencies Added

```txt
jinja2==3.1.2        # Template rendering
pillow==10.1.0       # Image processing  
fal-client==0.3.1    # FAL AI client library
```

---

### 🧠 New Helper Functions

All helpers are in `backend/app/api/ai_generation.py`:

```python
# Upload image to FAL AI
upload_image(image_data: bytes) -> str

# Load Jinja2 prompt template
load_prompt_template(template_name: str) -> str

# Render template with variables
render_prompt_template(template_name: str, **kwargs) -> str

# Submit edit request to FAL AI
edit_images(model_name, prompt, images, num_images) -> (request_id, status_url)
```

---

## Usage Examples

### 📱 Frontend Integration (TypeScript/React)

```typescript
// 1. Upload image
const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image_file', file);
  
  const response = await fetch('/api/ai/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  return response.json(); // { url, filename, content_type }
};

// 2. Edit image
const editImage = async (imageUrl: string, editType: string) => {
  const response = await fetch('/api/ai/edit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_url: imageUrl,
      edit_type: editType,
      num_images: 1
    })
  });
  
  return response.json(); // { images: [...], request_id, edit_type, num_generated }
};

// 3. Use in component
const handleRotateClockwise = async (file: File) => {
  const { url } = await uploadImage(file);
  const { images } = await editImage(url, 'rotate_90_cw');
  return images[0].url; // Use edited image
};
```

### 🐚 Shell/Curl Examples

**Upload:**
```bash
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "image_file=@bishop.png"
```

**Rotate 90° CW:**
```bash
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/...",
    "edit_type": "rotate_90_cw",
    "num_images": 1
  }'
```

**Custom Edit:**
```bash
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/...",
    "edit_type": "generic_edit",
    "custom_prompt": "Make the piece shine with metallic highlights",
    "num_images": 1
  }'
```

---

## 📋 Prompt Templates

Templates are in `backend/app/prompts/` as Jinja2 files:

### `rotate_90_cw.jinja`
```jinja
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso orario (verso destra).
Mantieni lo stesso stile, illuminazione e sfondo.
```

### `rotate_90_ccw.jinja`
```jinja
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso antiorario (verso sinistra).
Mantieni lo stesso stile, illuminazione e sfondo.
```

### `back_view.jinja`
```jinja
Genera una vista posteriore dello stesso pezzo di scacchi.
Mostra il retro del pezzo mantenendo lo stesso stile, illuminazione, materiale e sfondo.
```

### `generic_edit.jinja`
```jinja
{{ custom_prompt }} Mantieni il pezzo di scacchi come soggetto principale.
Usa lo stesso stile, illuminazione e sfondo dell'immagine originale se possibile.
```

### ✏️ Customizing Templates

Edit any `.jinja` file to change prompts. For `generic_edit.jinja`, use `{{ custom_prompt }}` to inject user input.

---

## 🔌 Integration Checklist

- [x] Backend endpoints implemented
- [x] Prompt templates created  
- [x] Helper functions created
- [x] Dependencies added to `requirements.txt`
- [x] Error handling and validation
- [x] Credit deduction logic
- [x] API documentation
- [x] Test script provided
- [ ] Frontend components (next step)
- [ ] Unit tests
- [ ] Integration tests

---

## 🚀 Testing

### Manual Test Script

```bash
cd backend/
python test_image_editing_api.py
```

Note: Update `AUTH_TOKEN` and `sample_url` in the script first.

### cURL Tests

See examples above in "Usage Examples" section.

---

## 📚 Full Documentation

See **[AI_IMAGE_EDITING_API.md](AI_IMAGE_EDITING_API.md)** for complete API documentation including:
- Request/response schemas
- All error codes and messages
- Detailed parameter descriptions
- Complete workflow examples
- Frontend integration guide

---

## 🔐 Security Considerations

- ✅ Endpoints require authentication (Bearer token)
- ✅ Credit validation before processing
- ✅ File type validation on upload
- ✅ Input validation on all parameters
- ✅ Error messages don't expose sensitive data

---

## 📊 Cost Management

- Each edit uses FAL AI credits based on model pricing
- Default: ~$0.039 per image
- Credits deducted immediately upon request submission
- Configurable via `Price` model in database

---

## 🐛 Troubleshooting

### "Prompts directory not found"
- Ensure `/backend/app/prompts/` directory exists
- Check that template files are present

### "FAL_KEY not configured"
- Add `FAL_KEY` environment variable to `.env` or docker-compose

### "Insufficient credits"
- User needs more credits in database
- Can be added via admin API or directly

### "Unsupported model_name"
- Edit endpoint only supports `fal-ai/nano-banana/edit`
- Don't use other models for editing

---

## 🔄 Next Steps

1. **Frontend Components** - Create React components to use these endpoints
2. **Advanced Templates** - Add more prompt templates for specific edits
3. **Batch Operations** - Support editing multiple images at once
4. **Webhooks** - Async notifications when edits complete
5. **Analytics** - Track usage and costs per user

---

## 📝 Related Documentation

- [AI_IMAGE_EDITING_API.md](AI_IMAGE_EDITING_API.md) - Complete API reference
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - Implementation summary
- [backend/test_image_editing_api.py](backend/test_image_editing_api.py) - Test examples

---

## 💡 Key Design Decisions

1. **Jinja2 Templates** - Easy to modify prompts without code changes
2. **Predefined Edit Types** - Common operations covered with one-click access
3. **Generic Edit Support** - Flexibility for custom prompts
4. **Helper Functions** - Reusable, testable, maintainable code
5. **Immediate Credit Deduction** - Prevents double-spending on retries
6. **Synchronous Response** - Client doesn't need to poll; they get results

---

Made with ❤️ for Chess 3D project
