/**
 * Chess Piece Icon Component
 * Loads SVG icons from assets folder
 */

const pieceIcons: Record<string, string> = {
  King: '/src/assets/chess-pieces/king.svg',
  Queen: '/src/assets/chess-pieces/queen.svg',
  Rook: '/src/assets/chess-pieces/rook.svg',
  Bishop: '/src/assets/chess-pieces/bishop.svg',
  Knight: '/src/assets/chess-pieces/knight.svg',
  Pawn: '/src/assets/chess-pieces/pawn.svg',
};

interface ChessPieceIconProps {
  type: string;
  className?: string;
}

export function ChessPieceIcon({ type, className = 'w-6 h-6' }: ChessPieceIconProps) {
  const iconPath = pieceIcons[type];
  
  if (!iconPath) {
    return <div className={`${className} bg-gray-300 rounded`} />;
  }

  return (
    <img
      src={iconPath}
      alt={type}
      className={`${className} text-gray-400`}
      style={{ filter: 'invert(60%) sepia(0%) saturate(0%)' }}
    />
  );
}

export default ChessPieceIcon;
