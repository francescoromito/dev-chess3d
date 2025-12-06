# 🎨 Set di Scacchi Base (Seed Data)

Questa cartella contiene i set di scacchi predefiniti che vengono caricati automaticamente al primo avvio dell'applicazione. Tutti i set qui contenuti verranno aggiunti alla collezione **"Set Base"**.

## 📁 Struttura delle Cartelle

Ogni sottocartella rappresenta un set di scacchi e deve seguire questa struttura:

```
seeds/
├── README.md                    # Questo file
├── NomeSet1/                    # Cartella del primo set
│   ├── description.txt          # (opzionale) Descrizione del set
│   ├── King_NomeSet1/           # Cartella per il Re
│   │   └── VersionName/         # Cartella per ogni versione
│   │       ├── description.json # Metadati della versione
│   │       ├── images/          # Immagini del pezzo
│   │       │   ├── front.png
│   │       │   ├── back.png
│   │       │   ├── left.png
│   │       │   └── right.png
│   │       └── 3d/              # Modelli 3D
│   │           ├── stl_model.stl
│   │           └── glb_model.glb
│   ├── Queen_NomeSet1/
│   ├── Rook_NomeSet1/
│   ├── Bishop_NomeSet1/
│   ├── Knight_NomeSet1/
│   └── Pawn_NomeSet1/
└── NomeSet2/
    └── ...
```

## 🔧 Come Aggiungere un Nuovo Set di Default

### Metodo 1: Da un Export esistente (Consigliato)

1. **Esporta il set** dall'applicazione usando il pulsante "Download ZIP"
2. **Estrai il contenuto** del file ZIP
3. **Copia la cartella estratta** in `backend/seeds/`
4. **Rebuilda Docker**: `docker compose build backend`
5. **Elimina il volume** del database (per reset): `docker compose down -v`
6. **Riavvia**: `docker compose up`

### Metodo 2: Creazione Manuale

1. **Crea una cartella** con il nome del set (es: `Medievale`)
2. **Crea le sottocartelle** per ogni tipo di pezzo:
   - `King_Medievale/`
   - `Queen_Medievale/`
   - `Rook_Medievale/`
   - `Bishop_Medievale/`
   - `Knight_Medievale/`
   - `Pawn_Medievale/`
3. **Per ogni pezzo**, crea una cartella per ogni versione:
   - `King_Medievale/Versione Base/`
4. **Aggiungi i file** nella cartella della versione:
   - `images/front.png`, `images/back.png`, ecc.
   - `3d/stl_model.stl`, `3d/glb_model.glb`
   - `description.json` (opzionale)

## 📝 Formato del file description.json

```json
{
  "piece_type": "king",
  "piece_name": null,
  "piece_description": null,
  "version_name": "Versione Base",
  "version_created": "2024-01-01T00:00:00"
}
```

## 📝 Formato del file description.txt (nella root del set)

Contiene semplicemente la descrizione testuale del set, es:
```
Set di scacchi in stile medievale con dettagli elaborati.
```

## 🔄 Come Aggiornare i Set di Default

1. **Modifica i file** nella cartella del set desiderato
2. **Rebuilda Docker**: `docker compose build backend`
3. **Per applicare i cambiamenti a un database esistente:**
   - Elimina il volume: `docker compose down -v`
   - Riavvia: `docker compose up`
   
   ⚠️ **Attenzione**: Questo eliminerà tutti i dati esistenti!

## 🗑️ Come Rimuovere un Set di Default

1. **Elimina la cartella** del set da `backend/seeds/`
2. **Rebuilda Docker**: `docker compose build backend`

## ⚙️ Note Tecniche

- I set vengono caricati **solo se il database è vuoto** (primo avvio)
- La collezione **"Set Base"** viene creata automaticamente se non esiste
- I nomi delle cartelle dei pezzi devono iniziare con il tipo di pezzo in inglese:
  - `King`, `Queen`, `Rook`, `Bishop`, `Knight`, `Pawn`
- Le immagini accettate: `.png`, `.jpg`, `.jpeg`, `.webp`
- I modelli 3D accettati: `.stl`, `.glb`, `.gltf`

## 📦 Esempio Minimo

Per un set con solo un pezzo (il Re) con una sola versione senza file:

```
seeds/
└── SetMinimo/
    └── King_SetMinimo/
        └── Base/
            └── description.json
```

Contenuto di `description.json`:
```json
{
  "version_name": "Base"
}
```

I set di default verranno comunque creati con tutti e 6 i tipi di pezzi, anche se alcune cartelle sono vuote.
