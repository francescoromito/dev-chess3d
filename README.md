<div align="center">

# ♟️ Chess Set Design Manager

<img src="https://img.shields.io/badge/Chess_Set-Design_Manager-8B4513?style=for-the-badge&labelColor=1a1a2e" alt="Chess Set Design Manager"/>

### 🎨 Design • 🤖 AI Generate • 🎮 Play

**La piattaforma definitiva per creare, personalizzare e giocare con set di scacchi unici**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)

[🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [🛠 Tech Stack](#-tech-stack) • [📖 Docs](#-documentation)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎨 Design Your Chess Sets

Crea set di scacchi completamente personalizzati con:
- **4 viste per pezzo** (front, back, left, right)
- **Modelli 3D** in formato STL e GLB
- **Multiple versioni** per ogni pezzo
- **Sistema di preferiti** per le versioni migliori

</td>
<td width="50%">

### 🤖 AI-Powered Generation

Genera immagini di pezzi con intelligenza artificiale:
- **Text-to-Image** con FAL AI
- **Image Editing** con prompt predefiniti
- **Vista posteriore automatica** da immagine frontale
- **Rotazioni intelligenti** (90° CW/CCW)

</td>
</tr>
<tr>
<td width="50%">

### 🖼️ Interactive 3D Viewer

Visualizza i tuoi modelli in un viewer professionale:
- **Supporto STL e GLB/GLTF**
- **Controlli orbit** (ruota, zoom, pan)
- **Illuminazione Stage** professionale
- **Export** modelli modificati

</td>
<td width="50%">

### ♟️ Play Chess vs AI

Gioca partite contro un'AI configurabile:
- **Difficoltà ELO** (0-3000)
- **Drag & Drop** intuitivo
- **Highlight mosse legali**
- **Timer** integrato

</td>
</tr>
<tr>
<td width="50%">

### 📦 Import/Export ZIP

Condividi i tuoi set in formato standardizzato:
- **Export completo** del set con tutte le versioni
- **Import** da file ZIP
- **Struttura organizzata** per pezzo/versione
- **Gestione conflitti** automatica

</td>
<td width="50%">

### 📁 Collections

Organizza i tuoi set in collezioni tematiche:
- **Crea collezioni** personalizzate
- **Aggiungi/rimuovi** set facilmente
- **Condividi** collezioni pubbliche
- **Gestione rapida** dalla dashboard

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Con Docker (Consigliato)

```bash
# 1. Clone
git clone https://github.com/yourusername/chess-set-design-manager.git
cd chess-set-design-manager

# 2. Configura ambiente
cp .env.example .env
# Modifica .env con la tua FAL_KEY per AI

# 3. Avvia
docker-compose up -d

# 🎉 Fatto!
# Frontend: http://localhost:5173
# API Docs: http://localhost:8000/docs
```

### Variabili d'Ambiente

```env
# Database
POSTGRES_USER=chess_user
POSTGRES_PASSWORD=chess_password
POSTGRES_DB=chess_db

# Auth
SECRET_KEY=your_super_secret_key

# AI (ottieni key da https://fal.ai)
FAL_KEY=your_fal_api_key
```

---

## 🛠 Tech Stack

<div align="center">

**Frontend**

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)

**Backend**

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

**DevOps**

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 FRONTEND                              │
│              React + TypeScript + Three.js                  │
│    Dashboard │ 3D Viewer │ AI Editor │ Chess Game           │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                    ⚡ BACKEND                                │
│                 FastAPI + SQLModel                          │
│      Auth │ Sets │ Pieces │ Collections │ AI │ Chess        │
└───────┬─────────────────┬─────────────────┬─────────────────┘
        │                 │                 │
   ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
   │PostgreSQL│      │ Uploads  │     │  FAL AI   │
   │    🗄️    │      │    📁    │     │    🤖     │
   └─────────┘      └──────────┘     └───────────┘
```

---

## 📖 Documentation

Per documentazione tecnica dettagliata, vedi **[README_TECHNICAL.md](README_TECHNICAL.md)**

Include:
- 📋 **API Reference** completa (39 endpoints)
- 🗄️ **Schema database** dettagliato
- 🔄 **Flussi di autenticazione**
- 🧠 **Algoritmo motore scacchi**
- 📦 **Struttura ZIP** import/export

---

## 📂 Project Structure

```
chess-set-design-manager/
├── 🔧 backend/           # FastAPI + Python
│   ├── app/api/          # REST endpoints
│   ├── app/models/       # SQLModel entities
│   ├── app/services/     # Business logic
│   └── app/prompts/      # AI templates
├── 🎨 frontend/          # React + TypeScript
│   ├── src/components/   # UI components
│   ├── src/pages/        # Route pages
│   └── src/services/     # API client
├── 📁 uploads/           # User files
└── 🐳 docker-compose.yml # Orchestration
```

---

## 🤝 Contributing

Le contribuzioni sono benvenute!

1. 🍴 Fork del repository
2. 🌿 Crea un branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit (`git commit -m 'Add amazing feature'`)
4. 📤 Push (`git push origin feature/amazing-feature`)
5. 🔃 Apri una Pull Request

---

## 📄 License

Distribuito sotto licenza **MIT**. Vedi `LICENSE` per maggiori informazioni.

---

## 👨‍💻 About

<div align="center">

**Sviluppato da [Francesco Romito](https://github.com/yourusername)**

*...con un po' di aiuto dai miei amici robotici* 🤖

</div>

Questo progetto è un esperimento di sviluppo **AI-assisted**: io ho avuto le idee (e bevuto il caffè ☕), mentre **Claude**, **GPT** e **Gemini** si sono alternati a scrivere codice, litigare sui punti e virgola, e convincermi che "funziona sul mio computer".

> *Nessuna AI è stata maltrattata durante lo sviluppo. Forse solo un po' stressata.*

---

<div align="center">

### ⭐ Se ti piace questo progetto, lascia una stella!

**Made with ❤️, ☕, and a lot of AI prompts**

</div>
