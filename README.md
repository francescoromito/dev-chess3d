# Chess Set Design Manager 🎨♟️

Applicazione web professionale per gestire file di design per scacchiere (modelli 3D e immagini di riferimento).

## 📋 Panoramica

Questa applicazione permette di:
- Creare e gestire progetti di scacchiere
- Organizzare i 6 pezzi standard (Re, Regina, Torre, Alfiere, Cavallo, Pedone)
- Versionare ogni pezzo con immagini di riferimento e modelli 3D
- Caricare file GLB (anteprima 3D) e STL (stampa 3D)

## 🛠️ Tech Stack

### Backend
- **Python 3.11+** con Type Hints completi
- **FastAPI** - Framework web moderno e veloce
- **SQLModel** - ORM con Pydantic integration
- **SQLite** - Database (facilmente migrabile a PostgreSQL)

### Frontend
- **React 18** con TypeScript
````markdown
# Chess Set Design Manager 🎨♟️

Applicazione web professionale per gestire file di design per scacchiere (modelli 3D e immagini di riferimento).

## 📋 Panoramica

Questa applicazione permette di:
- Creare e gestire progetti di scacchiere
- Organizzare i 6 pezzi standard (Re, Regina, Torre, Alfiere, Cavallo, Pedone)
- Versionare ogni pezzo con immagini di riferimento e modelli 3D
- Caricare file GLB (anteprima 3D) e STL (stampa 3D)

## 🛠️ Tech Stack

### Backend
- **Python 3.11+** con Type Hints completi
- **FastAPI** - Framework web moderno e veloce
- **SQLModel** - ORM con Pydantic integration
- **SQLite** - Database (facilmente migrabile a PostgreSQL)

### Frontend
- **React 18** con TypeScript
- **Vite** - Build tool velocissimo
- **Tailwind CSS** - Utility-first CSS
- **Lucide React** - Icone moderne
- **TanStack Query** - Data fetching e caching
- **React Router** - Navigazione

### Infrastructure
- **Docker & Docker Compose**
- **Hot-reload** abilitato per entrambi i servizi
- **Volume mounting** per persistenza dati

## 🚀 Quick Start

### Requisiti
- Docker Desktop installato e avviato
- Porte 8000 e 5173 disponibili

### Avvio

```powershell
# Clone/scarica il progetto e naviga nella directory
cd "c:\Users\franc\Desktop\codes\food scraper"

# Avvia tutto con un solo comando
docker-compose up --build
```

### Accesso

Dopo qualche minuto (prima installazione), l'applicazione sarà disponibile:

- **🎨 Frontend**: http://localhost:5173
- **🔧 Backend API**: http://localhost:8000
- **📚 API Docs**: http://localhost:8000/docs

Per istruzioni dettagliate, consulta **[QUICKSTART.md](QUICKSTART.md)**

## ✨ Features

- ✅ **Clean Architecture** - Separazione chiara tra layers
- ✅ **Type Safety** - TypeScript nel frontend, Type Hints in Python
- ✅ **Auto-Generation** - 6 pezzi creati automaticamente per ogni set
- ✅ **Versioning System** - Gestione completa delle versioni dei pezzi
- ✅ **File Upload** - Supporto multipart per immagini e modelli 3D
- ✅ **Responsive UI** - Design moderno e mobile-friendly
- ✅ **Hot-Reload** - Sviluppo rapido con ricaricamento automatico
- ✅ **RESTful API** - Endpoints ben strutturati e documentati

## 📁 Struttura del Progetto

```
chess-design-manager/
├── backend/                    # 🐍 Python Backend
│   ├── app/
│   │   ├── api/               # 🌐 REST API Endpoints
│   │   │   ├── sets.py        # Endpoints ChessSet
│   │   │   └── pieces.py      # Endpoints PieceVersion
│   │   ├── models/            # 📊 SQLModel Entities
│   │   │   └── __init__.py    # ChessSet, ChessPiece, PieceVersion
│   │   ├── services/          # 💼 Business Logic
│   │   │   ├── chess_set_service.py
│   │   │   └── piece_version_service.py
│   │   ├── database.py        # 🗄️ DB Connection
│   │   └── main.py            # 🚀 FastAPI App
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # ⚛️ React Frontend
│   ├── src/
│   │   ├── components/        # 🧩 UI Components
│   │   │   ├── CreateSetModal.tsx
│   │   │   └── CreateVersionModal.tsx
│   │   ├── pages/             # 📄 Page Components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── SetDetail.tsx
│   │   │   └── PieceDetail.tsx
│   │   ├── services/          # 🔌 API Client
│   │   │   └── api.ts         # Axios + React Query
│   │   ├── types/             # 📝 TypeScript Types
│   │   │   └── index.ts
│   │   ├── App.tsx            # 🏠 Main App
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── uploads/                    # 📦 File Storage (persistente)
├── data/                       # 💾 SQLite Database (persistente)
├── docker-compose.yml          # 🐳 Docker Orchestration
├── README.md                   # 📖 Questo file
└── QUICKSTART.md              # 🚀 Guida rapida
```

## 📊 Database Schema

```
ChessSet
  ├── id: int (PK)
  ├── name: string
  ├── description: string (optional)
  ├── created_at: datetime
  └── pieces: ChessPiece[] (1-to-many)

ChessPiece
  ├── id: int (PK)
  ├── set_id: int (FK)
  ├── type: PieceType (Enum)
  └── versions: PieceVersion[] (1-to-many)

PieceVersion
  ├── id: int (PK)
  ├── piece_id: int (FK)
  ├── version_name: string
  ├── img_front: string (path)
  ├── img_side_r: string (path)
  ├── img_side_l: string (path)
  ├── model_glb: string (path)
  ├── model_stl: string (path)
  └── created_at: datetime
```

## 🔄 User Flow

1. **Dashboard** → Visualizza tutte le scacchiere + Crea nuova
2. **Set Detail** → Visualizza i 6 pezzi della scacchiera
3. **Piece Detail** → Gestisci versioni del pezzo (upload files)

## 🧪 API Endpoints

### Chess Sets
- `GET /api/sets` - Lista tutti i set
- `POST /api/sets` - Crea nuovo set (+ auto-genera 6 pezzi)
- `GET /api/sets/{id}` - Dettaglio set con pezzi
- `DELETE /api/sets/{id}` - Elimina set

### Pieces & Versions
- `GET /api/pieces/{id}` - Dettaglio pezzo con versioni
- `GET /api/pieces/{id}/versions` - Lista versioni
- `POST /api/pieces/{id}/versions` - Crea versione + upload files

### Static Files
- `GET /uploads/{path}` - Accesso ai file caricati

## 🎯 Prossimi Sviluppi

- [ ] Import/Export di set completi
- [ ] Anteprima 3D integrata (three.js viewer)
- [ ] Ricerca e filtri avanzati
- [ ] Autenticazione utenti
- [ ] Cloud storage (S3/Azure Blob)
- [ ] PostgreSQL per produzione

## 📝 Note Tecniche

- **CORS**: Attualmente configurato per `allow_origins=["*"]` (solo dev)
- **File Storage**: Filesystem locale con volume Docker persistente
- **Database**: SQLite con schema auto-generated da SQLModel
- **Tipizzazione**: 100% type-safe (Python Type Hints + TypeScript)

## 🤝 Contributi

Progetto creato con clean architecture e best practices. Facilmente estendibile e manutenibile.

## 📄 Licenza

Progetto personale - Tutti i diritti riservati

---

Made with ❤️ using FastAPI + React + Docker

```

## Seeding & uploads

- **Comportamento al primo avvio**: alla prima esecuzione dell'app (database vuoto) il backend esegue una procedura di "seeding" che crea i record iniziali (collezione e set di esempio) e copia gli asset di esempio nella cartella `./uploads` presente nella root del progetto.
- **Dove sono i file**: la cartella `./uploads` è montata nella app container come `'/app/uploads'`. I file caricati o copiati durante il seeding finiscono in questa directory sul tuo filesystem locale.
- **Quando il seeding viene rieseguito**: il seeding viene eseguito solo se il database è vuoto (non trova alcun `ChessSet`). Se rimuovi completamente il volume del database, al prossimo `docker compose up` il backend noterà un DB vuoto e lancerà nuovamente il seeding.

### Comandi per resettare DB + uploads (PowerShell)

Esempio sicuro per resettare completamente lo stato (rimuove il volume del DB e cancella i file in `./uploads`):

```powershell
# Ferma e rimuove i container e i volumi
docker compose down -v;

# Cancella tutti i file presenti nella cartella uploads (host)
Remove-Item -Recurse -Force .\uploads\*;

# Ricostruisci e riavvia lo stack (il seed sarà eseguito se il DB è vuoto)
docker compose up -d --build
```

Nota: questi comandi sono distruttivi — esegui un backup prima se vuoi conservare i dati. Per PostgreSQL puoi usare `pg_dump` (se usi la versione con Postgres in produzione) oppure esportare i file manualmente.

### Suggerimento per sviluppo

- Se osservi risposte "vuote" o connessioni chiuse durante il seeding, il motivo può essere il `--reload` usato per il backend in `docker-compose.yml` (uvicorn autoreloader). Se il processo di seeding scrive sotto `/app` (es. `/app/uploads`) il reload può riavviare il server causando richieste interrotte. Per evitare questo comportamento in ambiente di integrazione puoi rimuovere `--reload` dal comando `uvicorn` nel servizio `backend` del `docker-compose.yml`.
