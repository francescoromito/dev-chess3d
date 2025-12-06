# AIImageEditor Component

## Descrizione
Componente riutilizzabile per la generazione e modifica di immagini tramite AI. Fornisce un'interfaccia quasi a schermo intero con:
- Caricamento multiplo di immagini
- Selezione delle immagini da includere nel prompt
- Area preview centrale
- Barra di input in fondo per descrivere generazione/modifiche

## Utilizzo

```tsx
import AIImageEditor from './components/AIImageEditor';

function MyComponent() {
  const [editorOpen, setEditorOpen] = useState(false);
  
  const handleGenerate = (prompt: string, selectedImages: File[]) => {
    console.log('Generate with:', prompt, selectedImages);
    // Implementare chiamata backend qui
  };

  return (
    <>
      <button onClick={() => setEditorOpen(true)}>
        Apri Editor AI
      </button>
      
      <AIImageEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onGenerate={handleGenerate}
        initialImage={myImageFile} // Opzionale
      />
    </>
  );
}
```

## Props

- `isOpen: boolean` - Controlla visibilità del modal
- `onClose: () => void` - Callback quando l'editor viene chiuso
- `onGenerate?: (prompt: string, selectedImages: File[]) => void` - Callback quando l'utente clicca "Genera"
- `initialImage?: File` - Immagine iniziale opzionale da caricare all'apertura

## Features

✅ Sessione isolata (stato pulito alla chiusura)
✅ Upload multiplo di immagini
✅ Selezione immagini da includere nel prompt
✅ Textarea per prompt con supporto Ctrl+Enter
✅ Preview gestione immagini caricate
✅ Rimozione immagini individuale
✅ Layout responsive e accessibile

## TODO (Backend Integration)

- [ ] Implementare chiamata API per generazione immagini
- [ ] Gestire risposta e mostrare immagine generata nell'area preview
- [ ] Permettere salvataggio/download immagine generata
- [ ] Aggiungere history delle generazioni nella sessione
- [ ] Implementare editing/variazioni di immagini esistenti
