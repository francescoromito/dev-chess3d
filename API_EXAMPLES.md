# 📡 API Examples - PowerShell

Esempi di chiamate API usando PowerShell (Windows).

## Prerequisites

Assicurati che l'applicazione sia in esecuzione:
```powershell
docker-compose up
```

## 1. Health Check

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

## 2. Creare un Chess Set

```powershell
$body = @{
    name = "Set Medievale"
    description = "Scacchiera ispirata al medioevo"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/sets" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## 3. Ottenere tutti i Set

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/sets" -Method Get
```

## 4. Ottenere un Set specifico

```powershell
$setId = 1
Invoke-RestMethod -Uri "http://localhost:8000/api/sets/$setId" -Method Get
```

## 5. Upload di una Versione con File

```powershell
# Percorsi ai file (modifica questi percorsi)
$imgFront = "C:\Users\franc\Desktop\test_images\king_front.jpg"
$imgSideR = "C:\Users\franc\Desktop\test_images\king_right.jpg"
$imgSideL = "C:\Users\franc\Desktop\test_images\king_left.jpg"
$modelGlb = "C:\Users\franc\Desktop\test_models\king.glb"
$modelStl = "C:\Users\franc\Desktop\test_models\king.stl"

# Crea multipart form
$pieceId = 1
$form = @{
    version_name = "v1.0 - Versione Finale"
}

# Aggiungi i file (solo quelli che esistono)
if (Test-Path $imgFront) {
    $form.img_front = Get-Item -Path $imgFront
}
if (Test-Path $imgSideR) {
    $form.img_side_r = Get-Item -Path $imgSideR
}
if (Test-Path $imgSideL) {
    $form.img_side_l = Get-Item -Path $imgSideL
}
if (Test-Path $modelGlb) {
    $form.model_glb = Get-Item -Path $modelGlb
}
if (Test-Path $modelStl) {
    $form.model_stl = Get-Item -Path $modelStl
}

# Invia la richiesta
Invoke-RestMethod -Uri "http://localhost:8000/api/pieces/$pieceId/versions" `
    -Method Post `
    -Form $form
```

## 6. Ottenere le Versioni di un Pezzo

```powershell
$pieceId = 1
Invoke-RestMethod -Uri "http://localhost:8000/api/pieces/$pieceId/versions" -Method Get
```

## 7. Ottenere Dettaglio Pezzo

```powershell
$pieceId = 1
Invoke-RestMethod -Uri "http://localhost:8000/api/pieces/$pieceId" -Method Get
```

## 8. Eliminare un Set

```powershell
$setId = 1
Invoke-RestMethod -Uri "http://localhost:8000/api/sets/$setId" -Method Delete
```

## 9. Scaricare un File Caricato

```powershell
$filePath = "piece_1/img_front_test.jpg"
Invoke-WebRequest -Uri "http://localhost:8000/uploads/$filePath" `
    -OutFile "C:\Users\franc\Desktop\downloaded_image.jpg"
```

## 10. Test Completo - Script Automatico

```powershell
# Script per testare il flusso completo

Write-Host "🎯 Starting API Test Flow..." -ForegroundColor Cyan

# 1. Creare un set
Write-Host "`n1️⃣ Creating chess set..." -ForegroundColor Yellow
$newSet = @{
    name = "Test Set $(Get-Date -Format 'HHmmss')"
    description = "Set di test automatico"
} | ConvertTo-Json

$set = Invoke-RestMethod -Uri "http://localhost:8000/api/sets" `
    -Method Post `
    -ContentType "application/json" `
    -Body $newSet

Write-Host "✅ Created set with ID: $($set.id)" -ForegroundColor Green
Write-Host "   Name: $($set.name)" -ForegroundColor Gray
Write-Host "   Pieces: $($set.pieces.Count)" -ForegroundColor Gray

# 2. Verificare i pezzi
Write-Host "`n2️⃣ Verifying pieces..." -ForegroundColor Yellow
foreach ($piece in $set.pieces) {
    Write-Host "   - $($piece.type) (ID: $($piece.id))" -ForegroundColor Gray
}

# 3. Ottenere tutti i set
Write-Host "`n3️⃣ Getting all sets..." -ForegroundColor Yellow
$allSets = Invoke-RestMethod -Uri "http://localhost:8000/api/sets" -Method Get
Write-Host "✅ Total sets: $($allSets.Count)" -ForegroundColor Green

# 4. Ottenere dettaglio set
Write-Host "`n4️⃣ Getting set details..." -ForegroundColor Yellow
$details = Invoke-RestMethod -Uri "http://localhost:8000/api/sets/$($set.id)" -Method Get
Write-Host "✅ Retrieved set: $($details.name)" -ForegroundColor Green

# 5. Creare una versione (senza file)
Write-Host "`n5️⃣ Creating version for King piece..." -ForegroundColor Yellow
$kingPiece = $set.pieces | Where-Object { $_.type -eq "King" } | Select-Object -First 1

$versionForm = @{
    version_name = "Test Version $(Get-Date -Format 'HHmmss')"
}

$version = Invoke-RestMethod -Uri "http://localhost:8000/api/pieces/$($kingPiece.id)/versions" `
    -Method Post `
    -Form $versionForm

Write-Host "✅ Created version: $($version.version_name)" -ForegroundColor Green
Write-Host "   Version ID: $($version.id)" -ForegroundColor Gray

# 6. Ottenere versioni del pezzo
Write-Host "`n6️⃣ Getting piece versions..." -ForegroundColor Yellow
$versions = Invoke-RestMethod -Uri "http://localhost:8000/api/pieces/$($kingPiece.id)/versions" -Method Get
Write-Host "✅ Total versions: $($versions.Count)" -ForegroundColor Green

Write-Host "`n✨ Test completed successfully!" -ForegroundColor Green
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   - Created set ID: $($set.id)" -ForegroundColor Gray
Write-Host "   - Pieces created: $($set.pieces.Count)" -ForegroundColor Gray
Write-Host "   - Version created for: $($kingPiece.type)" -ForegroundColor Gray
```

## Esempi con curl (se disponibile su Windows)

### Creare Set
```bash
curl -X POST "http://localhost:8000/api/sets" \
  -H "Content-Type: application/json" \
  -d '{"name":"Set Moderno","description":"Design contemporaneo"}'
```

### Upload con File
```bash
curl -X POST "http://localhost:8000/api/pieces/1/versions" \
  -F "version_name=v1.0" \
  -F "img_front=@/path/to/image.jpg" \
  -F "model_glb=@/path/to/model.glb"
```

### Get con Pretty Print
```bash
curl "http://localhost:8000/api/sets" | python -m json.tool
```

## Note

- Tutti gli endpoint sono documentati in modo interattivo su: http://localhost:8000/docs
- Usa Swagger UI per testare direttamente dal browser
- Per file upload di grandi dimensioni, considera di aumentare i timeout
- Le risposte sono in formato JSON con UTF-8 encoding

---

💡 **Tip**: Salva questi script in file `.ps1` per riutilizzarli facilmente!
