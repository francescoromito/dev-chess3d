# PowerShell Quick API Test Reference for Image Editing Endpoints
# Windows Users - Save as API_TEST_REFERENCE.ps1

# Configuration
$TOKEN = "YOUR_TOKEN_HERE"
$BASE_URL = "http://localhost:8000/api/ai"
$IMAGE_URL = "https://fal.ai/YOUR_IMAGE_URL"  # Replace with actual URL from upload

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# ============================================
# 1. UPLOAD IMAGE
# ============================================
Write-Host "1️⃣ Upload Image to FAL AI" -ForegroundColor Green

$imagePath = "C:\path\to\your\image.png"  # Change this path
$form = @{
    image_file = Get-Item -Path $imagePath
}

$uploadResponse = Invoke-RestMethod -Uri "$BASE_URL/upload" `
    -Method POST `
    -Headers @{"Authorization" = "Bearer $TOKEN"} `
    -Form $form

Write-Host "Upload Response:" -ForegroundColor Cyan
$uploadResponse | ConvertTo-Json

$uploadedImageUrl = $uploadResponse.url
Write-Host "Uploaded URL: $uploadedImageUrl" -ForegroundColor Yellow

# ============================================
# 2. ROTATE 90° CLOCKWISE
# ============================================
Write-Host "`n2️⃣ Rotate 90° Clockwise" -ForegroundColor Green

$editPayload = @{
    image_url = $IMAGE_URL
    edit_type = "rotate_90_cw"
    num_images = 1
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/edit" `
    -Method POST `
    -Headers $headers `
    -Body $editPayload

Write-Host "Response:" -ForegroundColor Cyan
$response | ConvertTo-Json

# ============================================
# 3. ROTATE 90° COUNTER-CLOCKWISE
# ============================================
Write-Host "`n3️⃣ Rotate 90° Counter-Clockwise" -ForegroundColor Green

$editPayload = @{
    image_url = $IMAGE_URL
    edit_type = "rotate_90_ccw"
    num_images = 1
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/edit" `
    -Method POST `
    -Headers $headers `
    -Body $editPayload

Write-Host "Response:" -ForegroundColor Cyan
$response | ConvertTo-Json

# ============================================
# 4. GENERATE BACK VIEW
# ============================================
Write-Host "`n4️⃣ Generate Back View" -ForegroundColor Green

$editPayload = @{
    image_url = $IMAGE_URL
    edit_type = "back_view"
    num_images = 2
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/edit" `
    -Method POST `
    -Headers $headers `
    -Body $editPayload

Write-Host "Response:" -ForegroundColor Cyan
$response | ConvertTo-Json

# ============================================
# 5. CUSTOM EDIT (GENERIC)
# ============================================
Write-Host "`n5️⃣ Custom Edit (Generic)" -ForegroundColor Green

$editPayload = @{
    image_url = $IMAGE_URL
    edit_type = "generic_edit"
    custom_prompt = "Make the chess piece gold with reflective highlights"
    num_images = 1
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/edit" `
    -Method POST `
    -Headers $headers `
    -Body $editPayload

Write-Host "Response:" -ForegroundColor Cyan
$response | ConvertTo-Json

# ============================================
# HELPER FUNCTION: Test All Edits
# ============================================
function Test-AllEdits {
    param(
        [string]$ImageUrl = $IMAGE_URL,
        [string]$Token = $TOKEN
    )
    
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    
    $editTypes = @("rotate_90_cw", "rotate_90_ccw", "back_view")
    
    foreach ($editType in $editTypes) {
        Write-Host "`nTesting: $editType" -ForegroundColor Green
        
        $payload = @{
            image_url = $ImageUrl
            edit_type = $editType
            num_images = 1
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$($BASE_URL)/edit" `
                -Method POST `
                -Headers $headers `
                -Body $payload
            
            Write-Host "✅ Success - Request ID: $($response.request_id)" -ForegroundColor Green
            Write-Host "Generated Images: $($response.num_generated)" -ForegroundColor Cyan
        } catch {
            Write-Host "❌ Error: $_" -ForegroundColor Red
        }
    }
}

# ============================================
# USAGE EXAMPLES
# ============================================

# Uncomment to run tests:
# Test-AllEdits -ImageUrl $uploadedImageUrl -Token $TOKEN

Write-Host "`n" -ForegroundColor Gray
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Gray
Write-Host "║  Edit Types Available:                                    ║" -ForegroundColor Gray
Write-Host "║  • rotate_90_cw      - Rotate 90° clockwise              ║" -ForegroundColor Gray
Write-Host "║  • rotate_90_ccw     - Rotate 90° counter-clockwise      ║" -ForegroundColor Gray
Write-Host "║  • back_view         - Generate back view                ║" -ForegroundColor Gray
Write-Host "║  • generic_edit      - Custom prompt (requires custom)   ║" -ForegroundColor Gray
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Gray

Write-Host "`n📝 Notes:" -ForegroundColor Yellow
Write-Host "  • Replace YOUR_TOKEN_HERE with actual auth token"
Write-Host "  • Replace image path in upload section"
Write-Host "  • Replace YOUR_IMAGE_URL with actual FAL AI URL"
Write-Host "  • All requests require valid authentication"
Write-Host "  • Credits are deducted immediately"
Write-Host "  • Edits typically take 10-30 seconds"
