# 🧪 Testing Guide

## Manual Testing Flow

### 1. Test Backend API (via Swagger UI)

Apri http://localhost:8000/docs

#### Test 1: Creare un Chess Set

```json
POST /api/sets

Request Body:
{
  "name": "Set Classico Staunton",
  "description": "Design tradizionale stile Staunton per tornei"
}

Expected Response: 201 Created
{
  "id": 1,
  "name": "Set Classico Staunton",
  "description": "Design tradizionale stile Staunton per tornei",
  "created_at": "2024-12-02T...",
  "pieces": [
    {"id": 1, "set_id": 1, "type": "King"},
    {"id": 2, "set_id": 1, "type": "Queen"},
    {"id": 3, "set_id": 1, "type": "Rook"},
    {"id": 4, "set_id": 1, "type": "Bishop"},
    {"id": 5, "set_id": 1, "type": "Knight"},
    {"id": 6, "set_id": 1, "type": "Pawn"}
  ]
}
```

✅ Verifica che vengano creati automaticamente 6 pezzi

#### Test 2: Ottenere tutti i Set

```json
GET /api/sets

Expected Response: 200 OK
[
  {
    "id": 1,
    "name": "Set Classico Staunton",
    "description": "Design tradizionale stile Staunton per tornei",
    "created_at": "2024-12-02T..."
  }
]
```

#### Test 3: Ottenere dettaglio Set con Pezzi

```json
GET /api/sets/1

Expected Response: 200 OK
{
  "id": 1,
  "name": "Set Classico Staunton",
  "description": "...",
  "created_at": "...",
  "pieces": [...]  // Array con 6 pezzi
}
```

#### Test 4: Creare una Versione con Upload

```
POST /api/pieces/1/versions

Form Data:
- version_name: "v1.0 - Bozza iniziale"
- img_front: [file.jpg]
- img_side_r: [file.jpg]
- img_side_l: [file.jpg]
- model_glb: [file.glb]
- model_stl: [file.stl]

Expected Response: 201 Created
{
  "id": 1,
  "piece_id": 1,
  "version_name": "v1.0 - Bozza iniziale",
  "img_front": "piece_1/img_front_file.jpg",
  "img_side_r": "piece_1/img_side_r_file.jpg",
  "img_side_l": "piece_1/img_side_l_file.jpg",
  "model_glb": "piece_1/model_glb_file.glb",
  "model_stl": "piece_1/model_stl_file.stl",
  "created_at": "2024-12-02T..."
}
```

✅ Verifica che i file siano salvati in `uploads/piece_1/`

#### Test 5: Accedere ai File

```
GET /uploads/piece_1/img_front_file.jpg

Expected: L'immagine viene visualizzata/scaricata
```

### 2. Test Frontend UI

Apri http://localhost:5173

#### Test Flow Completo:

1. **Dashboard**
   - [ ] La pagina mostra le card "Crea Scacchiera" e "Carica Scacchiera"
   - [ ] Eventuali set esistenti sono visualizzati come card

2. **Creare un Set**
   - [ ] Clicca su "Crea Scacchiera"
   - [ ] Il modale si apre
   - [ ] Inserisci nome: "Il Mio Primo Set"
   - [ ] Inserisci descrizione: "Test di creazione"
   - [ ] Clicca "Crea Set"
   - [ ] Il modale si chiude
   - [ ] La nuova card appare nella dashboard

3. **Visualizzare i Pezzi**
   - [ ] Clicca sulla card del set appena creato
   - [ ] La pagina mostra 6 card con icone (Re, Regina, Torre, Alfiere, Cavallo, Pedone)
   - [ ] Il titolo mostra il nome del set

4. **Gestire Versioni**
   - [ ] Clicca su un pezzo (es. "Re")
   - [ ] La pagina mostra "Nessuna versione ancora"
   - [ ] Clicca "Nuova Versione"
   - [ ] Il modale si apre con i campi upload

5. **Caricare File**
   - [ ] Inserisci nome versione: "v1.0"
   - [ ] Carica un'immagine per "Fronte"
   - [ ] Carica un'immagine per "Destra"
   - [ ] Carica un'immagine per "Sinistra"
   - [ ] (Opzionale) Carica file .glb
   - [ ] (Opzionale) Carica file .stl
   - [ ] Clicca "Crea Versione"
   - [ ] La versione appare nella lista
   - [ ] Le immagini sono visualizzate
   - [ ] I link per scaricare GLB/STL funzionano

6. **Navigazione**
   - [ ] Il pulsante "Torna indietro" funziona
   - [ ] Il pulsante "Torna alla dashboard" funziona

### 3. Test di Persistenza

1. **Stop e Restart**
   ```powershell
   docker-compose down
   docker-compose up
   ```
   - [ ] I set creati sono ancora presenti
   - [ ] Le versioni sono ancora visibili
   - [ ] I file caricati sono ancora accessibili

2. **Verifica File System**
   ```powershell
   # Controlla che i file esistano
   ls uploads/piece_*/
   
   # Controlla il database
   ls data/chess.db
   ```

### 4. Test di Error Handling

#### Backend:
- [ ] GET /api/sets/999 → 404 Not Found
- [ ] POST /api/pieces/999/versions → 404 Not Found
- [ ] POST /api/sets con body vuoto → 422 Validation Error

#### Frontend:
- [ ] Tentare di creare set senza nome → Bottone disabilitato
- [ ] Tentare di creare versione senza nome → Bottone disabilitato

### 5. Test di Performance

- [ ] La dashboard carica velocemente (<1s)
- [ ] L'upload di file grandi (<50MB) funziona
- [ ] L'hot-reload funziona (modifica un file e salva)

## Automated Testing (Future)

```bash
# Backend tests (pytest)
cd backend
pytest tests/

# Frontend tests (vitest)
cd frontend
npm run test
```

## Load Testing (Future)

```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:8000/api/sets
```

## Security Checklist (Production)

- [ ] CORS configurato con origini specifiche
- [ ] File upload limitato per dimensione
- [ ] File upload limitato per tipo (whitelist)
- [ ] Rate limiting sugli endpoint
- [ ] Autenticazione implementata
- [ ] HTTPS abilitato
- [ ] SQL injection prevention (SQLModel lo gestisce)
- [ ] XSS prevention (React lo gestisce)

## Acceptance Criteria ✅

L'applicazione è pronta quando:

1. ✅ Un utente può creare una scacchiera
2. ✅ Vengono generati automaticamente 6 pezzi
3. ✅ Un utente può creare versioni per ogni pezzo
4. ✅ Un utente può caricare 3 immagini + 2 modelli 3D
5. ✅ I file caricati sono visualizzabili/scaricabili
6. ✅ I dati persistono dopo il restart
7. ✅ L'interfaccia è responsive e intuitiva
8. ✅ L'hot-reload funziona per sviluppo rapido

---

Happy Testing! 🧪✨
