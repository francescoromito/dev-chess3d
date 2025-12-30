# 🎨 Image Editing API Documentation

## Overview
This API provides endpoints for AI-powered image editing and generation for chess pieces. It includes predefined edit types with Jinja2 templated prompts and supports custom edits.

## Endpoints

### 1. Upload Image
**POST** `/api/ai/upload`

Upload an image to FAL AI storage and get a URL for use in edit operations.

#### Request
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `image_file` (required): Image file (JPEG, PNG, WebP, GIF)

#### Response
```json
{
  "url": "https://fal.ai/...",
  "filename": "image.png",
  "content_type": "image/png"
}
```

#### Example
```bash
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image_file=@/path/to/image.png"
```

---

### 2. Edit Image
**POST** `/api/ai/edit`

Edit a chess piece image using predefined or custom prompts. Requires a valid image URL.

#### Request Body
```json
{
  "image_url": "https://fal.ai/...",
  "edit_type": "rotate_90_cw",
  "custom_prompt": null,
  "num_images": 1
}
```

#### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | URL of the image to edit |
| `edit_type` | string | Yes | Type of edit to apply |
| `custom_prompt` | string | Only for `generic_edit` | Custom editing instruction |
| `num_images` | integer | No | Number of variations (1-4, default: 1) |

#### Edit Types

##### 1. **rotate_90_cw** - Rotate 90° Clockwise
Rotates the chess piece image 90 degrees clockwise while maintaining style and lighting.

**Template**: `rotate_90_cw.jinja`
```
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso orario (verso destra). 
Mantieni lo stesso stile, illuminazione e sfondo. L'immagine dovrebbe mostrare 
lo stesso pezzo ma visto da un angolo ruotato di 90 gradi verso destra.
```

##### 2. **rotate_90_ccw** - Rotate 90° Counter-Clockwise
Rotates the chess piece image 90 degrees counter-clockwise.

**Template**: `rotate_90_ccw.jinja`
```
Ruota l'immagine del pezzo di scacchi di 90 gradi in senso antiorario (verso sinistra). 
Mantieni lo stesso stile, illuminazione e sfondo. L'immagine dovrebbe mostrare 
lo stesso pezzo ma visto da un angolo ruotato di 90 gradi verso sinistra.
```

##### 3. **back_view** - Generate Back View
Generates a back view of the chess piece.

**Template**: `back_view.jinja`
```
Genera una vista posteriore dello stesso pezzo di scacchi. Mostra il retro del pezzo 
mantenendo lo stesso stile, illuminazione, materiale e sfondo dell'immagine originale.
```

##### 4. **generic_edit** - Custom Edit
Applies a custom edit using a user-provided prompt. **Requires `custom_prompt`**.

**Template**: `generic_edit.jinja`
```
{{ custom_prompt }} Mantieni il pezzo di scacchi come soggetto principale. 
Usa lo stesso stile, illuminazione e sfondo dell'immagine originale se possibile.
```

#### Response
```json
{
  "images": [
    {
      "url": "https://fal.ai/...",
      "content_type": "image/png"
    }
  ],
  "request_id": "abc123...",
  "edit_type": "rotate_90_cw",
  "num_generated": 1
}
```

#### Status Codes
- **200**: Success
- **400**: Invalid request (bad parameters)
- **402**: Insufficient credits
- **500**: Server error
- **502**: External API error
- **504**: Request timeout

#### Examples

**Rotate 90° Clockwise**
```bash
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/path/to/image.png",
    "edit_type": "rotate_90_cw",
    "num_images": 1
  }'
```

**Generate Back View**
```bash
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/path/to/image.png",
    "edit_type": "back_view",
    "num_images": 2
  }'
```

**Custom Edit**
```bash
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/path/to/image.png",
    "edit_type": "generic_edit",
    "custom_prompt": "Change the piece color to gold",
    "num_images": 1
  }'
```

---

## Prompt Templates

Prompt templates are stored in `/backend/app/prompts/` as Jinja2 files:

- `rotate_90_cw.jinja` - Clockwise rotation template
- `rotate_90_ccw.jinja` - Counter-clockwise rotation template
- `back_view.jinja` - Back view template
- `generic_edit.jinja` - Generic edit template (supports variables)

### Customizing Templates

Edit the template files directly to modify prompts. For `generic_edit.jinja`, use `{{ custom_prompt }}` to inject user input.

Example:
```jinja
{{ custom_prompt }} Mantieni il pezzo come soggetto principale.
Usa lo stesso stile se possibile.
```

---

## Usage Workflow

### 1. Upload an Image
```bash
# Upload image and get URL
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image_file=@piece.png"
```

Response:
```json
{
  "url": "https://fal.ai/abc123...",
  "filename": "piece.png",
  "content_type": "image/png"
}
```

### 2. Edit the Image
```bash
# Use the URL from upload response
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/abc123...",
    "edit_type": "rotate_90_cw",
    "num_images": 1
  }'
```

### 3. Use the Edited Image
```json
{
  "images": [
    {
      "url": "https://fal.ai/xyz789..."
    }
  ],
  "request_id": "req123...",
  "edit_type": "rotate_90_cw",
  "num_generated": 1
}
```

---

## Error Handling

### Missing Custom Prompt
```json
{
  "detail": "custom_prompt is required for generic_edit type"
}
```

### Invalid Edit Type
```json
{
  "detail": "Invalid edit_type. Must be one of: rotate_90_cw, rotate_90_ccw, back_view, generic_edit"
}
```

### Insufficient Credits
```json
{
  "detail": "Insufficient credits. Required: 0.04, Available: 0.02"
}
```

### Timeout
```json
{
  "detail": "Image editing timed out after 180 seconds"
}
```

---

## Integration with Frontend

### TypeScript Example

```typescript
// 1. Upload image
const uploadResponse = await fetch('/api/ai/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData // FormData with image_file
});

const { url } = await uploadResponse.json();

// 2. Edit image
const editResponse = await fetch('/api/ai/edit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_url: url,
    edit_type: 'rotate_90_cw',
    num_images: 1
  })
});

const { images } = await editResponse.json();
// Use images[0].url for the edited image
```

---

## Notes

- Images are processed asynchronously and may take 10-30 seconds
- Credits are deducted immediately upon request submission
- Edit requests return HTTP 200 when images are ready (no polling needed from client)
- All images must be in standard formats (JPEG, PNG, WebP, GIF)
