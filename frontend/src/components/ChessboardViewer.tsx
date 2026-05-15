/**
 * Chessboard 3D Viewer Component
 * Displays an 8x8 chessboard with chess pieces from a set
 */
import { Suspense, useMemo, useState, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { X } from 'lucide-react';
import type { ChessPieceWithVersions } from '../types';
import sizePresetsConfig from '../config/sizePresets.json';

interface ChessboardViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: ChessPieceWithVersions[];
  setName: string;
}

type PresetKey = 'small' | 'medium' | 'large' | 'custom';

interface SizeOption {
  key: PresetKey;
  label: string;
  sizeCm: number;
}

const sizeOptions: SizeOption[] = [
  { key: 'small', label: sizePresetsConfig.presets.small.label, sizeCm: sizePresetsConfig.presets.small.baseSizeCm },
  { key: 'custom', label: 'Custom', sizeCm: 0 },
];

interface ChessboardViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: ChessPieceWithVersions[];
  setName: string;
}

// Create a chessboard texture with labels
function createChessboardTexture(): THREE.CanvasTexture {
  const squareSize = 128; // Higher resolution
  const borderSize = 64; // Half a square size for border
  const boardSize = squareSize * 8;
  const totalSize = boardSize + (borderSize * 2);
  
  const canvas = document.createElement('canvas');
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d')!;
  
  // Fill background (border color)
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, 0, totalSize, totalSize);
  
  // Draw Board
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isWhite = (row + col) % 2 === 0;
      ctx.fillStyle = isWhite ? '#f0d9b5' : '#b58863';
      ctx.fillRect(
        borderSize + col * squareSize, 
        borderSize + row * squareSize, 
        squareSize, 
        squareSize
      );
    }
  }

  // Draw Labels
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 40px sans-serif'; // Larger font for higher resolution
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Draw Files (a-h) at top and bottom
  files.forEach((file, i) => {
    const x = borderSize + i * squareSize + squareSize / 2;
    // Top
    ctx.fillText(file, x, borderSize / 2);
    // Bottom
    ctx.fillText(file, x, totalSize - borderSize / 2);
  });

  // Draw Ranks (1-8) at left and right
  ranks.forEach((rank, i) => {
    const y = borderSize + i * squareSize + squareSize / 2;
    // Left
    ctx.fillText(rank, borderSize / 2, y);
    // Right
    ctx.fillText(rank, totalSize - borderSize / 2, y);
  });

  // Draw inner border line
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 4;
  ctx.strokeRect(borderSize, borderSize, boardSize, boardSize);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// API base URL for constructing full model URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to get the best model URL from a piece (prefer GLB over STL)
function getModelInfo(pieces: ChessPieceWithVersions[], pieceType: string): { url: string; type: 'glb' | 'stl' } | null {
  const piece = pieces.find(p => p.type.toLowerCase() === pieceType.toLowerCase());
  if (!piece || piece.versions.length === 0) return null;
  
  // Get the favorite version, or the first version
  const version = piece.versions.find(v => v.is_favorite) || piece.versions[0];
  
  // Helper to build full URL
  const buildUrl = (path: string): string => {
    if (path.startsWith('http')) return path;
    // Add /uploads/ prefix if path doesn't already have it
    if (path.startsWith('/uploads/')) return `${API_BASE_URL}${path}`;
    if (path.startsWith('/')) return `${API_BASE_URL}/uploads${path}`;
    if (path.startsWith('uploads/')) return `${API_BASE_URL}/${path}`;
    return `${API_BASE_URL}/uploads/${path}`;
  };
  
  // Prefer GLB over STL
  if (version.model_glb) {
    return { url: buildUrl(version.model_glb), type: 'glb' };
  }
  if (version.model_stl) {
    return { url: buildUrl(version.model_stl), type: 'stl' };
  }
  return null;
}

// Convert chess notation (file, rank) to 3D position
// Board is centered at origin, each square is squareSizeCm units
// a1 is bottom-left (white's perspective), h8 is top-right
function squareToPosition(file: string, rank: number, squareSizeCm: number): [number, number, number] {
  const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
  const rankIndex = rank - 1; // 0-7
  
  // Board center is at origin
  // With squareSizeCm per square, board goes from -4*squareSizeCm to +4*squareSizeCm
  const x = (-3.5 + fileIndex) * squareSizeCm;
  const z = (3.5 - rankIndex) * squareSizeCm; // Rank 1 is at positive z, Rank 8 is at negative z
  const y = 0.05; // Slightly above the board surface
  
  return [x, y, z];
}

// Error boundary wrapper for piece loading
class PieceErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error loading chess piece:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

// Component to load and display an STL model on the board
function STLPiece({ url, position, scale = 1, rotationY = 0 }: { url: string; position: [number, number, number]; scale?: number; rotationY?: number }) {
  const geometry = useLoader(STLLoader, url);
  
  // Center the geometry
  const centeredGeometry = useMemo(() => {
    const geo = geometry.clone();
    geo.computeBoundingBox();
    geo.center();
    
    // Get the height to position correctly on the board
    const height = geo.boundingBox ? geo.boundingBox.max.y - geo.boundingBox.min.y : 1;
    // Translate so bottom sits at y=0
    geo.translate(0, height / 2, 0);
    
    return geo;
  }, [geometry]);
  
  return (
    <mesh geometry={centeredGeometry} position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]}>
      <meshStandardMaterial color="#e8e8e8" metalness={0.2} roughness={0.5} />
    </mesh>
  );
}

// Component to load and display a GLB model on the board
function GLBPiece({ url, position, scale = 1, rotationY = 0 }: { url: string; position: [number, number, number]; scale?: number; rotationY?: number }) {
  const { scene } = useGLTF(url);
  
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    
    // Calculate bounding box to position correctly
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Offset so bottom sits at y=0
    cloned.position.y = -box.min.y;
    cloned.position.x = -center.x;
    cloned.position.z = -center.z;
    
    return cloned;
  }, [scene]);
  
  return (
    <group position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Component to render a chess piece at a specific square
function ChessPiece({ 
  modelInfo, 
  file, 
  rank,
  scale = 0.5,
  rotationY = 0,
  squareSizeCm = 1
}: { 
  modelInfo: { url: string; type: 'glb' | 'stl' }; 
  file: string; 
  rank: number;
  scale?: number;
  rotationY?: number;
  squareSizeCm?: number;
}) {
  const position = squareToPosition(file, rank, squareSizeCm);
  
  return (
    <PieceErrorBoundary>
      <Suspense fallback={null}>
        {modelInfo.type === 'glb' ? (
          <GLBPiece url={modelInfo.url} position={position} scale={scale} rotationY={rotationY} />
        ) : (
          <STLPiece url={modelInfo.url} position={position} scale={scale} rotationY={rotationY} />
        )}
      </Suspense>
    </PieceErrorBoundary>
  );
}

// Main chessboard scene
interface ChessboardSceneProps {
  squareSizeCm: number;
  pieces: ChessPieceWithVersions[];
  showEnemyPieces: boolean;
}

function ChessboardScene({ squareSizeCm, pieces, showEnemyPieces }: ChessboardSceneProps) {
  const texture = useMemo(() => createChessboardTexture(), []);

  // Get the piece models
  const rookModel = getModelInfo(pieces, 'rook');
  const knightModel = getModelInfo(pieces, 'knight');
  const bishopModel = getModelInfo(pieces, 'bishop');
  const queenModel = getModelInfo(pieces, 'queen');
  const kingModel = getModelInfo(pieces, 'king');
  const pawnModel = getModelInfo(pieces, 'pawn');
  
  // Debug: log pieces and model info
  console.log('ChessboardScene pieces:', pieces);
  console.log('Rook model info:', rookModel);
  console.log('Knight model info:', knightModel);
  console.log('Bishop model info:', bishopModel);
  console.log('Queen model info:', queenModel);
  console.log('King model info:', kingModel);
  console.log('Pawn model info:', pawnModel);

  // Files for pawns (a-h)
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Board dimensions based on squareSizeCm
  // 8 squares + 0.5 square border on each side = 9 squares total
  const boardSizeUnits = 9 * squareSizeCm;
  const frameSizeUnits = 9.2 * squareSizeCm;
  const frameHeight = 0.1 * squareSizeCm;

  return (
    <group>
      {/* Board frame - positioned at origin */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[frameSizeUnits, frameHeight, frameSizeUnits]} />
        <meshBasicMaterial color="#5c3d2e" />
      </mesh>

      {/* Chessboard surface - on top of the frame */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, frameHeight / 2 + 0.01, 0]}>
        <planeGeometry args={[boardSizeUnits, boardSizeUnits]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* === WHITE PIECES === */}
      {/* White Rook on a1 (left) - rotated 180° to face inward */}
      {rookModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={rookModel} file="a" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Knight on b1 (left) - rotated 180° to face inward */}
      {knightModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={knightModel} file="b" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Bishop on c1 (dark square) - rotated 180° to face inward */}
      {bishopModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={bishopModel} file="c" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Queen on d1 - rotated 180° to face inward */}
      {queenModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={queenModel} file="d" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White King on e1 - rotated 180° to face inward */}
      {kingModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={kingModel} file="e" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Bishop on f1 (light square) - rotated 180° to face inward */}
      {bishopModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={bishopModel} file="f" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Knight on g1 (right) - rotated 180° to face inward */}
      {knightModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={knightModel} file="g" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* White Rook on h1 (right) - rotated 180° to face inward */}
      {rookModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={rookModel} file="h" rank={1} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}

      {/* White Pawns on rank 2 */}
      {pawnModel && files.map((file) => (
        <Suspense key={`white-pawn-${file}`} fallback={null}>
          <ChessPiece modelInfo={pawnModel} file={file} rank={2} scale={1} rotationY={Math.PI} squareSizeCm={squareSizeCm} />
        </Suspense>
      ))}

      {/* === BLACK PIECES (enemy) === */}
      {/* Black Pawns on rank 7 */}
      {showEnemyPieces && pawnModel && files.map((file) => (
        <Suspense key={`black-pawn-${file}`} fallback={null}>
          <ChessPiece modelInfo={pawnModel} file={file} rank={7} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      ))}

      {/* Black Rook on a8 (left) - facing inward */}
      {showEnemyPieces && rookModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={rookModel} file="a" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Knight on b8 (left) - facing inward */}
      {showEnemyPieces && knightModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={knightModel} file="b" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Bishop on c8 (light square) - facing inward */}
      {showEnemyPieces && bishopModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={bishopModel} file="c" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Queen on d8 - facing inward */}
      {showEnemyPieces && queenModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={queenModel} file="d" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black King on e8 - facing inward */}
      {showEnemyPieces && kingModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={kingModel} file="e" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Bishop on f8 (dark square) - facing inward */}
      {showEnemyPieces && bishopModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={bishopModel} file="f" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Knight on g8 (right) - facing inward */}
      {showEnemyPieces && knightModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={knightModel} file="g" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
      {/* Black Rook on h8 (right) - facing inward */}
      {showEnemyPieces && rookModel && (
        <Suspense fallback={null}>
          <ChessPiece modelInfo={rookModel} file="h" rank={8} scale={1} rotationY={0} squareSizeCm={squareSizeCm} />
        </Suspense>
      )}
    </group>
  );
}

export default function ChessboardViewer({ isOpen, onClose, pieces, setName }: ChessboardViewerProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('small');
  const [customSize, setCustomSize] = useState<number>(4);
  const [showEnemyPieces, setShowEnemyPieces] = useState<boolean>(true);
  
  // Calculate the actual square size in cm
  const squareSizeCm = selectedPreset === 'custom' 
    ? customSize 
    : sizeOptions.find(o => o.key === selectedPreset)?.sizeCm || 3.5;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl h-[85vh] bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <span className="text-2xl">♟️</span>
            <span className="text-white font-medium">{setName} - Scacchiera</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Size Controls */}
        <div className="absolute top-16 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3">
          <p className="text-slate-300 text-xs mb-2">Lato casella (cm):</p>
          <div className="flex gap-1 flex-wrap">
            {sizeOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setSelectedPreset(option.key)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedPreset === option.key
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {option.key === 'custom' ? option.label : `${option.label} (${option.sizeCm})`}
              </button>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="15"
                step="0.5"
                value={customSize}
                onChange={(e) => setCustomSize(parseFloat(e.target.value) || 1)}
                className="w-16 px-2 py-1 text-xs bg-slate-800 text-white rounded border border-slate-600 focus:border-amber-500 focus:outline-none"
              />
              <span className="text-slate-400 text-xs">cm</span>
            </div>
          )}
          <p className="text-slate-500 text-[10px] mt-1">
            Scacchiera: {(squareSizeCm * 8).toFixed(1)} × {(squareSizeCm * 8).toFixed(1)} cm
          </p>
          
          {/* Enemy Pieces Toggle */}
          <div className="mt-3 pt-2 border-t border-slate-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEnemyPieces}
                onChange={(e) => setShowEnemyPieces(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-600 focus:ring-amber-500 focus:ring-offset-0"
              />
              <span className="text-slate-300 text-xs">Mostra pezzi nemici</span>
            </label>
          </div>
        </div>

        {/* 3D Canvas */}
        <div className="w-full h-full">
          <Canvas camera={{ position: [0, 8, 8], fov: 50 }} shadows>
            <color attach="background" args={['#1e293b']} />
            
            {/* Enhanced lighting setup - stronger for dark piece visibility */}
            <ambientLight intensity={0.6} />
            
            {/* Main directional light - warm tone */}
            <directionalLight 
              position={[8, 15, 10]} 
              intensity={1.4} 
              castShadow
              shadow-mapSize={[1024, 1024]}
              color="#fff8f0"
            />
            
            {/* Strong fill light from opposite side */}
            <directionalLight position={[-10, 12, -8]} intensity={0.8} color="#f0f5ff" />
            
            {/* Additional fill from front */}
            <directionalLight position={[0, 10, 15]} intensity={0.5} />
            
            {/* Point lights for soft highlights - increased */}
            <pointLight position={[12, 10, 12]} intensity={0.8} color="#fffaf0" />
            <pointLight position={[-12, 10, -12]} intensity={0.6} color="#f0faff" />
            <pointLight position={[12, 10, -12]} intensity={0.5} color="#ffffff" />
            <pointLight position={[-12, 10, 12]} intensity={0.5} color="#ffffff" />
            
            {/* Top spotlight for even coverage */}
            <spotLight 
              position={[0, 25, 0]} 
              angle={0.9} 
              penumbra={1} 
              intensity={1.0}
            />
            
            {/* Hemisphere light for natural feel - great for dark objects */}
            <hemisphereLight args={['#ffffff', '#444444', 0.5]} />
            
            <Suspense fallback={null}>
              <ChessboardScene squareSizeCm={squareSizeCm} pieces={pieces} showEnemyPieces={showEnemyPieces} />
            </Suspense>
            
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={100}
            />
          </Canvas>
        </div>
        {/* Controls hint */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-center text-slate-400 text-sm">
            🖱️ <span className="text-slate-300">Ruota:</span> click + trascina | 
            <span className="text-slate-300"> Zoom:</span> scroll | 
            <span className="text-slate-300"> Pan:</span> click destro + trascina
          </p>
        </div>
      </div>
    </div>
  );
}
