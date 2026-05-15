const fs = require('fs');
let s = fs.readFileSync('src/components/PlayableChessboard.tsx', 'utf8');

const replacement = \unction getModelInfo(pieces: ChessPieceWithVersions[], pieceType: string): { url: string; type: 'glb' } | null {
    const piece = pieces.find(p => p.type.toLowerCase() === pieceType.toLowerCase());
    if (!piece || piece.versions.length === 0) return null;
    const version = piece.versions.find(v => v.is_favorite) || piece.versions[0];
    
    const buildUrl = (path: string): string => {
      if (path.startsWith('http')) return path;
      if (path.startsWith('/uploads/')) return \\\\\\\\\\\\;
      if (path.startsWith('/')) return \\\\\\/uploads\\\\\\;
      if (path.startsWith('uploads/')) return \\\\\\/\\\\\\;
      return \\\\\\/uploads/\\\\\\;
    };
    
    if (version.model_glb) return { url: buildUrl(version.model_glb), type: 'glb' as const };
    return null;
}
\;

s = s.replace(/function getModelInfo[\s\S]*?(?=function squareToPosition)/, replacement);
fs.writeFileSync('src/components/PlayableChessboard.tsx', s);
