# AI Image Generation Setup

## Panoramica

Il sistema integra la generazione di immagini AI tramite l'API FAL.ai per creare e modificare immagini dei pezzi degli scacchi.

## Configurazione

### 1. Ottenere una FAL API Key

1. Registrati su [FAL.ai](https://fal.ai)
2. Vai al dashboard e crea una nuova API key
3. Copia la chiave API

### 2. Configurare le Variabili d'Ambiente

Aggiungi la seguente variabile al file `.env` nella root del progetto:

```env
FAL_KEY=your_fal_api_key_here
```

### 3. Riavviare Docker

Dopo aver configurato la chiave API, riavvia i container Docker:

```bash
docker compose down
docker compose up -d
```

## Utilizzo

### Frontend - AI Image Editor

L'editor AI è accessibile quando si crea una nuova versione di un pezzo:

1. Nella pagina di dettaglio di un pezzo, clicca "Nuova Versione"
2. Per ogni immagine (Fronte, Retro, Destra, Sinistra), clicca sul pulsante "Genera con AI 🤖"
3. Si aprirà l'editor AI dove puoi:
   - **Caricare immagini di riferimento** (max 5): usa il pulsante "Carica Immagini" e seleziona fino a 5 immagini come riferimento
   - **Selezionare modello**: attualmente disponibile solo "Nano Banana (Fast)"
   - **Scegliere numero di varianti**: da 1 a 4 immagini generate
   - **Scrivere prompt**: descrivi l'immagine desiderata (es. "Un cavallo degli scacchi in stile moderno con dettagli dorati")
   - **Generare**: clicca "Genera" o premi Ctrl+Enter

4. Le immagini generate appariranno nell'area centrale
5. La prima immagine generata verrà automaticamente impostata nel campo corrente
6. Chiudi l'editor per continuare la creazione della versione

### Backend Endpoint

**POST** `/api/ai/generate`

Request body:
```json
{
  "prompt": "Un cavallo degli scacchi in stile moderno",
  "model_name": "fal-ai/nano-banana",
  "num_images": 2
}
```

Response:
```json
{
  "images": [
    {
      "url": "https://...",
      "content_type": "image/png"
    },
    {
      "url": "https://...",
      "content_type": "image/png"
    }
  ],
  "request_id": "...",
  "model_used": "fal-ai/nano-banana",
  "num_generated": 2
}
```

## Modelli Disponibili

Attualmente supportato:
- **fal-ai/nano-banana**: Generazione veloce, qualità base, ideale per prototipi

## Limiti e Note

- **Timeout**: La generazione ha un timeout di 120 secondi
- **Numero immagini**: Puoi generare da 1 a 4 varianti per richiesta
- **Immagini di riferimento**: Puoi selezionare fino a 5 immagini come riferimento (feature in sviluppo lato backend)
- **Formato output**: PNG 1:1 aspect ratio
- **Tempo di generazione**: Tipicamente 10-30 secondi

## Troubleshooting

### "FAL_KEY not configured"
Assicurati che la variabile `FAL_KEY` sia presente nel file `.env` e riavvia i container.

### "Image generation timed out"
La generazione può richiedere fino a 2 minuti. Se continui a vedere timeout:
- Verifica la tua connessione internet
- Controlla lo stato del servizio FAL.ai
- Prova con un prompt più semplice

### Errori di rate limiting
FAL.ai ha limiti di rate. Consulta il tuo piano su fal.ai per i dettagli.

## Sviluppi Futuri

- [ ] Supporto per image-to-image (usare immagini di riferimento selezionate)
- [ ] Più modelli AI (FLUX, Stable Diffusion, ecc.)
- [ ] Editor avanzato (inpainting, outpainting, upscaling)
- [ ] Salvataggio di prompt e template
- [ ] Cronologia generazioni per utente
