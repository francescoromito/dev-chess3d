# 🎨 Image Editing Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  (React/TypeScript Components - To Be Implemented)               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌─────────┐          ┌──────────┐
   │ UPLOAD  │          │ EDIT     │
   │ IMAGE   │          │ IMAGE    │
   └────┬────┘          └────┬─────┘
        │                    │
        │ POST /api/ai/      │ POST /api/ai/
        │     upload         │     edit
        │                    │
        └────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  BACKEND API LAYER                     │
    │  /backend/app/api/ai_generation.py     │
    │                                        │
    │  • upload_image_endpoint()             │
    │  • edit_image()                        │
    │  • generate_images()                   │
    │  • edit_images()                       │
    │  • get_status()                        │
    └────────────┬─────────────────┬─────────┘
                 │                 │
        ┌────────▼─┐      ┌────────▼────────┐
        │ JINJA2   │      │ HELPER FUNCS    │
        │ TEMPLATES│      │                 │
        │          │      │ • upload_image()│
        │ rotate_  │      │ • load_prompt() │
        │ 90_cw    │      │ • render_prompt │
        │ rotate_  │      │ • edit_images() │
        │ 90_ccw   │      │                 │
        │ back_    │      └────────┬────────┘
        │ view     │               │
        │ generic_ │               │
        │ edit     │               │
        └────────┬─┘               │
                 │                 │
                 └────────┬────────┘
                          │
                 ┌────────▼──────────┐
                 │ DATABASE          │
                 │                   │
                 │ • User Credits    │
                 │ • Prices          │
                 │ • Auth System     │
                 └───────────────────┘
                          │
                 ┌────────▼──────────┐
                 │ FAL AI SERVICE    │
                 │                   │
                 │ • nano-banana     │
                 │ • nano-banana/    │
                 │   edit            │
                 │ • File Storage    │
                 └───────────────────┘
```

---

## Data Flow - Image Upload

```
Client                   Backend                      FAL AI
  │                        │                           │
  ├─── POST /upload ───────>│                           │
  │    image_file           │                           │
  │                         ├─ validate file ─>│        │
  │                         │  (type, size)    │        │
  │                         │                  <────────┤ upload_image()
  │                         │  (upload via     │        │
  │                         │   fal_client)    <────────┤
  │                         │<─ URL ────────────>│       │
  │<─ 200 OK ───────────────┤  {"url": "..."}  │        │
  │  {"url": "..."}         │                   │        │
  │                         │                   │        │
```

---

## Data Flow - Image Editing

```
Client                  Backend                  FAL AI
  │                       │                       │
  ├─ POST /edit ─────────>│                       │
  │  {image_url,          │                       │
  │   edit_type}          │ Load template         │
  │                       ├─ /prompts/ ────>│     │
  │                       │  (Jinja2)       │     │
  │                       │              <──┤     │
  │                       │  Render prompt  │     │
  │                       │                 │     │
  │                       ├─ Check credits ─>DB  │
  │                       │               <──┤    │
  │                       │  Deduct credits     │
  │                       │                     │
  │                       ├─ edit_images() ────>│
  │                       │  (submit request) <──┤
  │                       │  request_id,         │
  │                       │  status_url          │
  │                       │                      │
  │                       ├─ poll status ──────>│
  │                       │  (every 2s)      <──┤
  │                       │                      │
  │<─ 200 OK ─────────────┤  (when COMPLETED)   │
  │  {images, etc}        │  Fetch results  ────>│
  │                       │  Return URLs    <────┤
  │                       │                      │
```

---

## File Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── ai_generation.py          [MAIN FILE - 546 lines]
│   │   │   ├── upload_image()        [Helper]
│   │   │   ├── load_prompt_template() [Helper]
│   │   │   ├── render_prompt_template() [Helper]
│   │   │   ├── edit_images()         [Helper]
│   │   │   ├── upload_image_endpoint() [Endpoint]
│   │   │   ├── edit_image()          [Endpoint]
│   │   │   └── generate_image()      [Existing]
│   │   │
│   │   ├── auth.py                   [Uses: get_current_user]
│   │   ├── pieces.py
│   │   ├── sets.py
│   │   └── ...
│   │
│   ├── prompts/                      [NEW DIRECTORY]
│   │   ├── __init__.py
│   │   ├── rotate_90_cw.jinja
│   │   ├── rotate_90_ccw.jinja
│   │   ├── back_view.jinja
│   │   └── generic_edit.jinja
│   │
│   ├── models.py                     [Uses: User, Price]
│   ├── database.py
│   └── main.py
│
└── requirements.txt                  [Updated with 3 packages]
```

---

## Dependency Graph

```
┌─────────────────────────────────────┐
│  Python Standard Library            │
│  • pathlib                          │
│  • traceback                        │
│  • base64, json, time, os           │
└─────────┬───────────────────────────┘
          │
    ┌─────▼────────────────────┐
    │  External Packages       │
    │                          │
    │  FastAPI (existing) ─────┼──> APIRouter, HTTPException
    │  SQLModel (existing) ────┼──> Session, select
    │  Requests (existing) ────┼──> HTTP requests
    │                          │
    │  ✨ NEW Packages ✨      │
    │  Jinja2 ────────────────>│ Template rendering
    │  Pillow ────────────────>│ Image processing  
    │  fal-client ────────────>│ FAL AI SDK
    └─────────────────────────┘
```

---

## API Endpoints

### Upload Endpoint
```
POST /api/ai/upload

Request:
  Content-Type: multipart/form-data
  Authorization: Bearer TOKEN
  Body: image_file (binary)

Response:
  200 OK
  {
    "url": "https://fal.ai/...",
    "filename": "...",
    "content_type": "image/png"
  }

Errors:
  400 - Invalid file type
  401 - Not authenticated
  500 - Upload failed
```

### Edit Endpoint
```
POST /api/ai/edit

Request:
  Content-Type: application/json
  Authorization: Bearer TOKEN
  Body:
  {
    "image_url": "https://fal.ai/...",
    "edit_type": "rotate_90_cw|rotate_90_ccw|back_view|generic_edit",
    "custom_prompt": "..." (only for generic_edit),
    "num_images": 1-4
  }

Response:
  200 OK
  {
    "images": [
      {
        "url": "https://fal.ai/...",
        "content_type": "image/png"
      }
    ],
    "request_id": "req-...",
    "edit_type": "rotate_90_cw",
    "num_generated": 1
  }

Errors:
  400 - Invalid parameters
  402 - Insufficient credits
  500 - Processing failed
  504 - Timeout
```

---

## Request/Response Models

```python
# Upload Request
multipart/form-data {
  image_file: File (JPEG, PNG, WebP, GIF)
}

# Upload Response
{
  url: str
  filename: str
  content_type: str
}

# Edit Request
{
  image_url: str           # Required
  edit_type: str           # Required (4 options)
  custom_prompt: str|None  # Required for generic_edit
  num_images: int          # 1-4, default 1
}

# Edit Response
{
  images: [
    {
      url: str
      content_type: str
    }
  ]
  request_id: str
  edit_type: str
  num_generated: int
}
```

---

## Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. Login (existing)
       │ POST /api/auth/login
       │
       ▼
    ┌──────────────────┐
    │ Get JWT Token    │
    │ (stored in app)  │
    └────────┬─────────┘
             │
             │ 2. API Request with Auth
             │ Authorization: Bearer TOKEN
             │
             ▼
    ┌──────────────────────────────┐
    │ get_current_user()           │
    │ • Verify token               │
    │ • Extract user info          │
    │ • Check permissions          │
    └────────┬─────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Endpoint Handler             │
    │ • Uses current_user          │
    │ • Deducts credits            │
    │ • Logs activity              │
    └──────────────────────────────┘
```

---

## Template System

### Template Files Location
```
backend/app/prompts/
```

### Template Processing
```
User Request
  │
  ├─ edit_type = "generic_edit"?
  │  ├─ Yes: Load generic_edit.jinja
  │  │        Render with custom_prompt
  │  └─ No: Load {edit_type}.jinja
  │         Render (no variables)
  │
  ▼
Final Prompt String
  │
  ▼
Submit to FAL AI
```

### Example Template Usage
```python
# Static template (rotate_90_cw.jinja)
prompt = load_prompt_template("rotate_90_cw.jinja")
# Result: "Ruota l'immagine del pezzo..."

# Dynamic template (generic_edit.jinja)
prompt = render_prompt_template(
    "generic_edit.jinja",
    custom_prompt="Make it gold"
)
# Result: "Make it gold Mantieni il pezzo di scacchi..."
```

---

## Credit System Integration

```
User Request
  │
  ▼
Get Price Entry (from DB)
  ├─ Not found? Create default
  └─ Found? Use existing price
  │
  ▼
Calculate Cost = price_per_image × num_images
  │
  ▼
Check user.credits >= cost
  ├─ No: Return 402 (Insufficient Credits)
  └─ Yes: Continue
       │
       ▼
    Deduct credits BEFORE request
       (prevents double-spending)
       │
       ▼
    Submit to FAL AI
       │
       ├─ Success: All good
       └─ Failure: Credits already deducted
              (this is intentional)
```

---

## Error Handling Strategy

```
Request Validation
  ├─ Check file type/size (upload)
  ├─ Check parameters (edit)
  ├─ Check authentication
  └─ Check authorization
       │
       ├─ Failed ──> 400 (Bad Request)
       └─ Success ──> Continue
                       │
                       ▼
           Business Logic
               ├─ Check credits
               ├─ Load templates
               ├─ Submit request
               └─ Poll status
                    │
                    ├─ Failed ──> 500+ (Server Error)
                    └─ Success ──> Continue
                                   │
                                   ▼
                            Return Results
                            200 OK
```

---

## Performance Considerations

```
Operation          Time      Notes
─────────────────────────────────────────────
Upload            < 1s      Direct to FAL
Edit submission   < 1s      Queue request
Edit processing   10-30s    AI model inference
Status polling    2s/poll   Up to 180s max
Total flow        ~15-35s   From user perspective
```

---

Made with ❤️ for Chess 3D
