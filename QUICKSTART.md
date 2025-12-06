# 🚀 Chess Set Design Manager - Quick Start Guide

## Prerequisiti

- Docker Desktop installato e avviato
- Porta 8000 (backend) e 5173 (frontend) disponibili

## Avvio Rapido

### 1. Avviare l'applicazione

Dalla directory principale del progetto, esegui:

```powershell
docker-compose up --build
```

**Prima esecuzione**: Docker scaricherà le immagini base e installerà tutte le dipendenze. Potrebbe richiedere alcuni minuti.

### 2. Accedere all'applicazione

Dopo l'avvio, l'applicazione sarà disponibile a:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)

### 3. Verificare il funzionamento

1. Apri il browser e vai su http://localhost:5173
2. Dovresti vedere la dashboard con le card "Crea Scacchiera" e "Carica Scacchiera"
3. Clicca su "Crea Scacchiera" per testare la creazione di un nuovo set

## Comandi Utili

### Avviare i servizi
```powershell
docker-compose up
```

### Avviare in background
```powershell
docker-compose up -d
```

### Ricostruire i container (dopo modifiche ai Dockerfile)
```powershell
docker-compose up --build
```

### Fermare i servizi
```powershell
docker-compose down
```

### Vedere i log
```powershell
# Tutti i servizi
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend
```

### Resettare il database
```powershell
# Rimuovi il file del database
rm -r data/

# Riavvia i container
docker-compose up
```

## Struttura dei File

```
chess-design-manager/
├── backend/
│   ├── app/
│   │   ├── api/          # Endpoints REST
│   │   ├── models/       # SQLModel entities
│   │   ├── services/     # Business logic
│   │   ├── database.py   # DB connection
│   │   └── main.py       # FastAPI app
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   ├── types/        # TypeScript types
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── uploads/              # File caricati (persistenti)
├── data/                 # Database SQLite (persistente)
└── docker-compose.yml
```

## Funzionalità

### ✅ Gestione Scacchiere
- Crea nuove scacchiere con nome e descrizione
- Visualizza lista di tutte le scacchiere
- Ogni scacchiera ha automaticamente 6 tipi di pezzi (Re, Regina, Torre, Alfiere, Cavallo, Pedone)

### ✅ Gestione Pezzi
- Visualizza i 6 pezzi di ogni scacchiera
- Accedi al dettaglio di ogni pezzo

### ✅ Versioning
- Crea multiple versioni per ogni pezzo
- Upload di:
  - 3 Immagini (Fronte, Destra, Sinistra)
  - Modello GLB (anteprima 3D)
  - Modello STL (stampa 3D)
- Visualizza cronologia versioni
- Download dei file caricati

## Hot-Reload

Entrambi i servizi supportano l'hot-reload:

- **Backend**: Modifiche ai file Python vengono applicate automaticamente
- **Frontend**: Modifiche ai file React/TS vengono ricaricate nel browser

## Troubleshooting

### Porta già in uso
Se le porte 8000 o 5173 sono già in uso, puoi modificare il file `docker-compose.yml` alla voce `ports`.

### Errore di connessione al backend
Verifica che il backend sia avviato correttamente:
```powershell
docker-compose logs backend
```

### Frontend non si carica
Verifica che le dipendenze siano installate:
```powershell
docker-compose exec frontend npm install
```

### Reset completo
Per un reset completo dell'ambiente:
```powershell
docker-compose down -v
rm -r data/
rm -r uploads/*
docker-compose up --build
```

## Sviluppo

### Installare dipendenze locali (opzionale, per IDE)

Backend:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Frontend:
```powershell
cd frontend
npm install
```

Nota: Non è necessario per l'esecuzione, tutto funziona tramite Docker.

## API Endpoints

### Chess Sets
- `GET /api/sets` - Lista tutti i set
- `POST /api/sets` - Crea nuovo set
- `GET /api/sets/{id}` - Dettaglio set con pezzi
- `DELETE /api/sets/{id}` - Elimina set

### Pieces & Versions
- `GET /api/pieces/{id}` - Dettaglio pezzo con versioni
- `GET /api/pieces/{id}/versions` - Lista versioni del pezzo
- `POST /api/pieces/{id}/versions` - Crea nuova versione (multipart/form-data)

### Static Files
- `GET /uploads/{path}` - Accesso ai file caricati

## Note di Produzione

Per deployment in produzione, considera:

1. **CORS**: Modifica `allow_origins` in `backend/app/main.py`
2. **Database**: Migra da SQLite a PostgreSQL
3. **Storage**: Usa S3 o simili invece del filesystem
4. **Environment Variables**: Usa file `.env` separati per prod
5. **HTTPS**: Configura SSL/TLS
6. **Build Frontend**: Usa `npm run build` e servi i file statici

Buon lavoro! 🎨♟️
