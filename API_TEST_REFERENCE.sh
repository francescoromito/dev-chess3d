#!/bin/bash
# Quick API Test Reference for Image Editing Endpoints

# ============================================
# 1. UPLOAD IMAGE
# ============================================
echo "1️⃣ Upload Image to FAL AI"
curl -X POST http://localhost:8000/api/ai/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image_file=@/path/to/image.png"

# Expected Response:
# {
#   "url": "https://fal.ai/...",
#   "filename": "image.png",
#   "content_type": "image/png"
# }

# ============================================
# 2. ROTATE 90° CLOCKWISE
# ============================================
echo "2️⃣ Rotate 90° Clockwise"
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/YOUR_IMAGE_URL",
    "edit_type": "rotate_90_cw",
    "num_images": 1
  }'

# ============================================
# 3. ROTATE 90° COUNTER-CLOCKWISE
# ============================================
echo "3️⃣ Rotate 90° Counter-Clockwise"
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/YOUR_IMAGE_URL",
    "edit_type": "rotate_90_ccw",
    "num_images": 1
  }'

# ============================================
# 4. GENERATE BACK VIEW
# ============================================
echo "4️⃣ Generate Back View"
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/YOUR_IMAGE_URL",
    "edit_type": "back_view",
    "num_images": 1
  }'

# ============================================
# 5. CUSTOM EDIT
# ============================================
echo "5️⃣ Custom Edit (Generic)"
curl -X POST http://localhost:8000/api/ai/edit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://fal.ai/YOUR_IMAGE_URL",
    "edit_type": "generic_edit",
    "custom_prompt": "Make the chess piece gold with reflective highlights",
    "num_images": 1
  }'

# ============================================
# EXPECTED RESPONSE (for all edit endpoints)
# ============================================
# {
#   "images": [
#     {
#       "url": "https://fal.ai/edited_image_url",
#       "content_type": "image/png"
#     }
#   ],
#   "request_id": "req-12345...",
#   "edit_type": "rotate_90_cw",
#   "num_generated": 1
# }

# ============================================
# ERROR RESPONSES
# ============================================

# Missing custom_prompt for generic_edit:
# {
#   "detail": "custom_prompt is required for generic_edit type"
# }

# Invalid edit_type:
# {
#   "detail": "Invalid edit_type. Must be one of: rotate_90_cw, rotate_90_ccw, back_view, generic_edit"
# }

# Insufficient credits:
# {
#   "detail": "Insufficient credits. Required: 0.04, Available: 0.02"
# }

# Timeout:
# {
#   "detail": "Image editing timed out after 180 seconds"
# }

# ============================================
# NOTES
# ============================================
# Replace YOUR_TOKEN_HERE with actual auth token
# Replace YOUR_IMAGE_URL with actual FAL AI image URL (from upload response)
# All requests require valid authentication
# Credits are deducted immediately upon submission
# Edit operations typically take 10-30 seconds to complete
