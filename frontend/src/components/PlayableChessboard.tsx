import { Suspense, useMemo, useState, Component, ReactNode, useEffect, useRef } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import type { ChessPieceWithVersions } from '../types';
import { chessEngineApi, type MoveDetail } from '../services/api';

// --- Piece type color mapping for markers ---
const PIECE_MARKER_COLORS: Record<string, { color: string; name: string }> = {
  king: { color: '#ff0000', name: 'Re' },
  queen: { color: '#0066ff', name: 'Regina' },
  rook: { color: '#8B4513', name: 'Torre' },
  bishop: { color: '#9932CC', name: 'Alfiere' },
  knight: { color: '#228B22', name: 'Cavallo' },
  pawn: { color: '#FFD700', name: 'Pedone' },
};

// --- Utilities (duplicated from ChessboardViewer for independence) ---

function createChessboardTexture(): THREE.CanvasTexture {
  const squareSize = 128;
  const borderSize = 64;
  const boardSize = squareSize * 8;
  const totalSize = boardSize + (borderSize * 2);
  
  const canvas = document.createElement('canvas');
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, 0, totalSize, totalSize);
  
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

  ctx.fillStyle = '#333333';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  files.forEach((file, i) => {
    const x = borderSize + i * squareSize + squareSize / 2;
    ctx.fillText(file, x, borderSize / 2);
    ctx.fillText(file, x, totalSize - borderSize / 2);
  });

  ranks.forEach((rank, i) => {
    const y = borderSize + i * squareSize + squareSize / 2;
    ctx.fillText(rank, borderSize / 2, y);
    ctx.fillText(rank, totalSize - borderSize / 2, y);
  });

  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 4;
  ctx.strokeRect(borderSize, borderSize, boardSize, boardSize);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';


function getModelInfo(pieces: ChessPieceWithVersions[], pieceType: string): { url: string; type: 'glb' } | null {
    const piece = pieces.find(p => p.type.toLowerCase() === pieceType.toLowerCase());
    if (!piece || piece.versions.length === 0) return null;
    const version = piece.versions.find(v => v.is_favorite) || piece.versions[0];
    
    const buildUrl = (path: string): string => {
      if (path.startsWith('http')) return path;
      if (path.startsWith('/uploads/')) return `${API_BASE_URL}${path}`;
      if (path.startsWith('/')) return `${API_BASE_URL}/uploads${path}`;
      if (path.startsWith('uploads/')) return `${API_BASE_URL}/${path}`;
      return `${API_BASE_URL}/uploads/${path}`;
    };
    
    if (version.model_glb) return { url: buildUrl(version.model_glb), type: 'glb' as const };
    return null;
}
function squareToPosition(file: string, rank: number, squareSizeCm: number): [number, number, number] {
  const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIndex = rank - 1;
  const x = (-3.5 + fileIndex) * squareSizeCm;
  const z = (3.5 - rankIndex) * squareSizeCm;
  const y = 0.05;
  return [x, y, z];
}

// --- Components ---

class PieceErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Error loading piece:', error); }
  render() { return this.state.hasError ? (this.props.fallback || null) : this.props.children; }
}

function STLPiece({ url, position, scale = 1, rotationY = 0, onClick, isSelected, isCaptureThreat }: any) {
  const geometry = useLoader(STLLoader, url) as THREE.BufferGeometry;
  const centeredGeometry = useMemo(() => {
    const geo = geometry.clone();
    geo.computeBoundingBox();
    geo.center();
    const height = geo.boundingBox ? geo.boundingBox.max.y - geo.boundingBox.min.y : 1;
    geo.translate(0, height / 2, 0);
    return geo;
  }, [geometry]);

  // Determine color based on state
  let color = "#e8e8e8";
  let emissive = "#000000";
  if (isSelected) {
    color = "#ffff00";
    emissive = "#444400";
  } else if (isCaptureThreat) {
    color = "#ff4444";
    emissive = "#440000";
  }
  
  return (
    <mesh 
      geometry={centeredGeometry} 
      position={position} 
      scale={[scale, scale, scale]} 
      rotation={[0, rotationY, 0]}
      onClick={onClick}
    >
      <meshStandardMaterial 
        color={color} 
        metalness={0.2} 
        roughness={0.5} 
        emissive={emissive}
      />
    </mesh>
  );
}

function GLBPiece({ url, position, scale = 1, rotationY = 0, onClick, isSelected, isCaptureThreat }: any) {
  const gltf = useGLTF(url) as any;
  const scene = gltf.scene;
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    
    // Clone materials to ensure each piece instance has its own material
    // This prevents highlighting one piece from affecting all others of the same type
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.y = -box.min.y;
    cloned.position.x = -center.x;
    cloned.position.z = -center.z;
    return cloned;
  }, [scene]);

  // Add highlight effect based on state
  useEffect(() => {
    clonedScene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (isSelected) {
          material.emissive = new THREE.Color(0x444400);
        } else if (isCaptureThreat) {
          material.emissive = new THREE.Color(0x660000);
        } else {
          material.emissive = new THREE.Color(0x000000);
        }
      }
    });
  }, [isSelected, isCaptureThreat, clonedScene]);
  
  return (
    <group 
      position={position} 
      scale={[scale, scale, scale]} 
      rotation={[0, rotationY, 0]}
      onClick={onClick}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

function ChessPiece({ modelInfo, file, rank, scale = 1, rotationY = 0, squareSizeCm = 1, onClick, isSelected, isCaptureThreat, isAnimating, isInCheck, isShaking, showMarker, pieceType }: any) {
  const position = squareToPosition(file, rank, squareSizeCm);
  const groupRef = useRef<THREE.Group>(null);
  
  // Shake animation when trying to move while in check
  useFrame((state) => {
    if (groupRef.current) {
      if (isShaking) {
        // Shake effect
        const shake = Math.sin(state.clock.elapsedTime * 50) * 0.15;
        groupRef.current.position.x = position[0] + shake;
      } else {
        groupRef.current.position.x = position[0];
      }
      
      // Pulsing glow effect when in check
      if (isInCheck) {
        const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.5 + 0.5;
        groupRef.current.position.y = position[1] + pulse * 0.3;
      } else if (!isAnimating) {
        groupRef.current.position.y = position[1];
      }
    }
  });
  
  // Apply a slight lift when animating
  const animatedPosition: [number, number, number] = isAnimating 
    ? [position[0], position[1] + 2, position[2]] 
    : position;
  
  return (
    <group ref={groupRef} position={animatedPosition}>
      {/* Piece type marker */}
      {showMarker && <PieceMarker pieceType={pieceType} squareSizeCm={squareSizeCm} />}
      {/* Red glow effect when in check */}
      {isInCheck && <CheckGlowEffect />}
      <PieceErrorBoundary>
        <Suspense fallback={null}>
          {modelInfo.type === 'glb' ? (
            <GLBPiece url={modelInfo.url} position={[0, 0, 0]} scale={scale} rotationY={rotationY} onClick={onClick} isSelected={isSelected} isCaptureThreat={isCaptureThreat} />
          ) : (
            <STLPiece url={modelInfo.url} position={[0, 0, 0]} scale={scale} rotationY={rotationY} onClick={onClick} isSelected={isSelected} isCaptureThreat={isCaptureThreat} />
          )}
        </Suspense>
      </PieceErrorBoundary>
    </group>
  );
}

// Animated glow effect for king in check
function CheckGlowEffect() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.15 + 0.25;
      material.opacity = pulse;
      
      // Also pulse the scale
      const scalePulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(scalePulse);
    }
  });
  
  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]}>
      <sphereGeometry args={[2.5, 16, 16]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={0.25} />
    </mesh>
  );
}

// Piece type marker - colored light under each piece
function PieceMarker({ pieceType, squareSizeCm }: { pieceType: string; squareSizeCm: number }) {
  const markerColor = PIECE_MARKER_COLORS[pieceType]?.color || '#ffffff';
  const ringRef = useRef<THREE.Mesh>(null);
  const cylinderRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (ringRef.current) {
      const material = ringRef.current.material as THREE.MeshStandardMaterial;
      // Strong pulse for the ring
      const pulse = Math.sin(time * 4) * 0.5 + 1.5; // 1.0 to 2.0
      material.emissiveIntensity = pulse * 3; // Super bright
    }
    
    if (cylinderRef.current) {
      const material = cylinderRef.current.material as THREE.MeshBasicMaterial;
      // Fading pulse for the beam
      const pulse = Math.sin(time * 2) * 0.1 + 0.2;
      material.opacity = pulse;
    }
  });
  
  return (
    <group position={[0, 0, 0]}>
      {/* Neon Torus Ring at base - 3D object that won't be hidden */}
      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[squareSizeCm * 0.42, squareSizeCm * 0.04, 16, 32]} />
        <meshStandardMaterial 
          color={markerColor} 
          emissive={markerColor}
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
      
      {/* Vertical light beam */}
      <mesh ref={cylinderRef} position={[0, 1, 0]}>
        <cylinderGeometry args={[squareSizeCm * 0.4, squareSizeCm * 0.4, 2, 32, 1, true]} />
        <meshBasicMaterial 
          color={markerColor} 
          transparent 
          opacity={0.2} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Floor glow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[squareSizeCm * 0.45, 32]} />
        <meshBasicMaterial color={markerColor} transparent opacity={0.5} />
      </mesh>
      
      {/* Strong point light */}
      <pointLight color={markerColor} intensity={3} distance={squareSizeCm * 3} decay={2} position={[0, 0.5, 0]} />
    </group>
  );
}

// Move indicator - white circle for valid moves
function MoveIndicator({ file, rank, squareSizeCm, onClick }: { file: string; rank: number; squareSizeCm: number; onClick: () => void }) {
  const [x, , z] = squareToPosition(file, rank, squareSizeCm);
  const indicatorSize = squareSizeCm * 0.2; // Circle size
  
  return (
    <mesh 
      position={[x, 0.5, z]} // Higher above the board
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <circleGeometry args={[indicatorSize, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  );
}

// --- Game Logic ---

interface GamePiece {
  id: string;
  type: string;
  color: 'white' | 'black';
  file: string;
  rank: number;
}

// Move indicator types
interface MoveOption {
  file: string;
  rank: number;
  isCapture: boolean; // true if there's an enemy piece to capture
}

// MOCKUP: Generate possible moves for a piece (will be replaced by backend call)
function getMockMoves(piece: GamePiece, allPieces: GamePiece[]): MoveOption[] {
  const moves: MoveOption[] = [];
  
  const isOccupied = (f: string, r: number) => 
    allPieces.find(p => p.file === f && p.rank === r);
  
  const isEnemy = (f: string, r: number) => {
    const p = isOccupied(f, r);
    return p && p.color !== piece.color;
  };

  const addMove = (f: string, r: number) => {
    if (r < 1 || r > 8) return false;
    const fIdx = f.charCodeAt(0) - 'a'.charCodeAt(0);
    if (fIdx < 0 || fIdx > 7) return false;
    
    const occupant = isOccupied(f, r);
    if (occupant) {
      if (occupant.color !== piece.color) {
        moves.push({ file: f, rank: r, isCapture: true });
      }
      return false; // blocked
    }
    moves.push({ file: f, rank: r, isCapture: false });
    return true; // can continue
  };

  switch (piece.type.toLowerCase()) {
    case 'pawn': {
      const direction = piece.color === 'white' ? 1 : -1;
      const startRank = piece.color === 'white' ? 2 : 7;
      
      // Forward move
      if (!isOccupied(piece.file, piece.rank + direction)) {
        moves.push({ file: piece.file, rank: piece.rank + direction, isCapture: false });
        // Double move from start
        if (piece.rank === startRank && !isOccupied(piece.file, piece.rank + 2 * direction)) {
          moves.push({ file: piece.file, rank: piece.rank + 2 * direction, isCapture: false });
        }
      }
      // Captures
      const leftFile = String.fromCharCode(piece.file.charCodeAt(0) - 1);
      const rightFile = String.fromCharCode(piece.file.charCodeAt(0) + 1);
      if (isEnemy(leftFile, piece.rank + direction)) {
        moves.push({ file: leftFile, rank: piece.rank + direction, isCapture: true });
      }
      if (isEnemy(rightFile, piece.rank + direction)) {
        moves.push({ file: rightFile, rank: piece.rank + direction, isCapture: true });
      }
      break;
    }
    case 'knight': {
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [df, dr] of knightMoves) {
        const newFile = String.fromCharCode(piece.file.charCodeAt(0) + df);
        const newRank = piece.rank + dr;
        if (newRank >= 1 && newRank <= 8) {
          const fIdx = newFile.charCodeAt(0) - 'a'.charCodeAt(0);
          if (fIdx >= 0 && fIdx <= 7) {
            const occupant = isOccupied(newFile, newRank);
            if (!occupant || occupant.color !== piece.color) {
              moves.push({ file: newFile, rank: newRank, isCapture: !!occupant });
            }
          }
        }
      }
      break;
    }
    case 'bishop': {
      // Diagonals
      for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i <= 7; i++) {
          const newFile = String.fromCharCode(piece.file.charCodeAt(0) + df * i);
          if (!addMove(newFile, piece.rank + dr * i)) break;
        }
      }
      break;
    }
    case 'rook': {
      // Straight lines
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let i = 1; i <= 7; i++) {
          const newFile = String.fromCharCode(piece.file.charCodeAt(0) + df * i);
          if (!addMove(newFile, piece.rank + dr * i)) break;
        }
      }
      break;
    }
    case 'queen': {
      // All 8 directions
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (let i = 1; i <= 7; i++) {
          const newFile = String.fromCharCode(piece.file.charCodeAt(0) + df * i);
          if (!addMove(newFile, piece.rank + dr * i)) break;
        }
      }
      break;
    }
    case 'king': {
      // All 8 directions, 1 square
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const newFile = String.fromCharCode(piece.file.charCodeAt(0) + df);
        addMove(newFile, piece.rank + dr);
      }
      break;
    }
  }
  
  return moves;
}

const INITIAL_PIECES: GamePiece[] = [
  // White
  { id: 'w-r-a1', type: 'rook', color: 'white', file: 'a', rank: 1 },
  { id: 'w-n-b1', type: 'knight', color: 'white', file: 'b', rank: 1 },
  { id: 'w-b-c1', type: 'bishop', color: 'white', file: 'c', rank: 1 },
  { id: 'w-q-d1', type: 'queen', color: 'white', file: 'd', rank: 1 },
  { id: 'w-k-e1', type: 'king', color: 'white', file: 'e', rank: 1 },
  { id: 'w-b-f1', type: 'bishop', color: 'white', file: 'f', rank: 1 },
  { id: 'w-n-g1', type: 'knight', color: 'white', file: 'g', rank: 1 },
  { id: 'w-r-h1', type: 'rook', color: 'white', file: 'h', rank: 1 },
  ...['a','b','c','d','e','f','g','h'].map(f => ({ id: `w-p-${f}2`, type: 'pawn', color: 'white' as const, file: f, rank: 2 })),
  
  // Black
  { id: 'b-r-a8', type: 'rook', color: 'black', file: 'a', rank: 8 },
  { id: 'b-n-b8', type: 'knight', color: 'black', file: 'b', rank: 8 },
  { id: 'b-b-c8', type: 'bishop', color: 'black', file: 'c', rank: 8 },
  { id: 'b-q-d8', type: 'queen', color: 'black', file: 'd', rank: 8 },
  { id: 'b-k-e8', type: 'king', color: 'black', file: 'e', rank: 8 },
  { id: 'b-b-f8', type: 'bishop', color: 'black', file: 'f', rank: 8 },
  { id: 'b-n-g8', type: 'knight', color: 'black', file: 'g', rank: 8 },
  { id: 'b-r-h8', type: 'rook', color: 'black', file: 'h', rank: 8 },
  ...['a','b','c','d','e','f','g','h'].map(f => ({ id: `b-p-${f}7`, type: 'pawn', color: 'black' as const, file: f, rank: 7 })),
];

interface PlayableChessboardProps {
  whitePieces: ChessPieceWithVersions[];
  blackPieces: ChessPieceWithVersions[];
  squareSizeCm?: number;
  playerColor?: 'white' | 'black';
  aiElo?: number;
  onMoveMade?: (moveSan: string, color: 'white' | 'black') => void;
  isPlayerTurn?: boolean;
  onGameOver?: (result: { winner: string | null; reason: string }) => void;
  onPromotionRequest?: (callback: (piece: 'queen' | 'rook' | 'bishop' | 'knight') => void) => void;
  showPlayerMarkers?: boolean;
  showEnemyMarkers?: boolean;
}

// Convert board state to FEN (simplified - full implementation would track castling, en passant, etc.)
function piecesToFen(pieces: GamePiece[], turn: 'white' | 'black' = 'white'): string {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  const pieceToFenChar: Record<string, string> = {
    'king': 'k', 'queen': 'q', 'rook': 'r', 'bishop': 'b', 'knight': 'n', 'pawn': 'p'
  };
  
  for (const piece of pieces) {
    const fileIdx = piece.file.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankIdx = piece.rank - 1;
    let char = pieceToFenChar[piece.type.toLowerCase()] || 'p';
    if (piece.color === 'white') char = char.toUpperCase();
    board[rankIdx][fileIdx] = char;
  }
  
  // Build FEN string (ranks 8 to 1)
  const ranks: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let rank = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      if (board[r][f]) {
        if (empty > 0) { rank += empty; empty = 0; }
        rank += board[r][f];
      } else {
        empty++;
      }
    }
    if (empty > 0) rank += empty;
    ranks.push(rank);
  }
  
  // Determine castling rights based on piece positions
  let castling = '';
  const whiteKing = pieces.find(p => p.type === 'king' && p.color === 'white');
  const blackKing = pieces.find(p => p.type === 'king' && p.color === 'black');
  const whiteRookH = pieces.find(p => p.type === 'rook' && p.color === 'white' && p.file === 'h' && p.rank === 1);
  const whiteRookA = pieces.find(p => p.type === 'rook' && p.color === 'white' && p.file === 'a' && p.rank === 1);
  const blackRookH = pieces.find(p => p.type === 'rook' && p.color === 'black' && p.file === 'h' && p.rank === 8);
  const blackRookA = pieces.find(p => p.type === 'rook' && p.color === 'black' && p.file === 'a' && p.rank === 8);
  
  // White castling rights (king on e1)
  if (whiteKing && whiteKing.file === 'e' && whiteKing.rank === 1) {
    if (whiteRookH) castling += 'K';
    if (whiteRookA) castling += 'Q';
  }
  // Black castling rights (king on e8)
  if (blackKing && blackKing.file === 'e' && blackKing.rank === 8) {
    if (blackRookH) castling += 'k';
    if (blackRookA) castling += 'q';
  }
  
  if (!castling) castling = '-';
  
  // Return FEN with correct turn and castling rights
  return ranks.join('/') + ` ${turn === 'white' ? 'w' : 'b'} ${castling} - 0 1`;
}

function GameScene({ whitePieces, blackPieces, squareSizeCm = 6, playerColor = 'white', aiElo = 1200, onMoveMade, onGameOver, onPromotionRequest, showPlayerMarkers = false, showEnemyMarkers = false }: PlayableChessboardProps) {
  const [pieces, setPieces] = useState<GamePiece[]>(INITIAL_PIECES);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<MoveDetail[]>([]);
  const [isLoadingMoves, setIsLoadingMoves] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [animatingPieces, setAnimatingPieces] = useState<Set<string>>(new Set());
  const [gameOver, setGameOver] = useState<{ winner: string | null; reason: string } | null>(null);
  const [awaitingPromotion, setAwaitingPromotion] = useState(false);
  const [checkedKingColor, setCheckedKingColor] = useState<'white' | 'black' | null>(null);
  const [kingShaking, setKingShaking] = useState(false);
  const texture = useMemo(() => createChessboardTexture(), []);
  
  // Ref to always have latest pieces value
  const piecesRef = useRef<GamePiece[]>(pieces);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  // Board dimensions
  const boardSizeUnits = 9 * squareSizeCm;
  const frameSizeUnits = 9.2 * squareSizeCm;
  const frameHeight = 0.1 * squareSizeCm;

  // Fetch legal moves when a piece is selected
  useEffect(() => {
    if (!selectedPieceId) {
      setLegalMoves([]);
      return;
    }
    
    const selectedPiece = pieces.find(p => p.id === selectedPieceId);
    if (!selectedPiece) return;
    
    // Only allow selecting pieces of current turn
    if (selectedPiece.color !== currentTurn) {
      setSelectedPieceId(null);
      return;
    }
    
    const square = `${selectedPiece.file}${selectedPiece.rank}`;
    const fen = piecesToFen(pieces, currentTurn);
    
    setIsLoadingMoves(true);
    chessEngineApi.getLegalMoves(fen, square)
      .then(response => {
        setLegalMoves(response.legal_moves);
        
        // If player's king is in check and piece has no legal moves, shake the king
        const playerInCheck = checkedKingColor === playerColor;
        if (playerInCheck && response.legal_moves.length === 0 && selectedPiece.type !== 'king') {
          setKingShaking(true);
          setTimeout(() => {
            setKingShaking(false);
            setSelectedPieceId(null);
          }, 500);
        }
      })
      .catch(err => {
        console.error('Error fetching legal moves:', err);
        // Fallback to mock moves if API fails
        const mockMoves = getMockMoves(selectedPiece, pieces);
        setLegalMoves(mockMoves.map(m => ({
          uci: `${selectedPiece.file}${selectedPiece.rank}${m.file}${m.rank}`,
          san: '',
          from_sq: `${selectedPiece.file}${selectedPiece.rank}`,
          to_sq: `${m.file}${m.rank}`,
          is_capture: m.isCapture,
          is_check: false
        })));
      })
      .finally(() => setIsLoadingMoves(false));
  }, [selectedPieceId, pieces, currentTurn]);

  // Convert API moves to our format
  const possibleMoves = useMemo(() => {
    return legalMoves.map(m => ({
      file: m.to_sq[0],
      rank: parseInt(m.to_sq[1]),
      isCapture: m.is_capture
    }));
  }, [legalMoves]);

  // Get IDs of pieces that can be captured
  const capturablePieceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const move of possibleMoves) {
      if (move.isCapture) {
        const target = pieces.find(p => p.file === move.file && p.rank === move.rank);
        if (target) ids.add(target.id);
      }
    }
    return ids;
  }, [possibleMoves, pieces]);

  // Helper function to execute a move with castling, promotion, and animation
  const executeMove = (
    uciMove: string,
    color: 'white' | 'black',
    piecesState: GamePiece[],
    isPromotion: boolean = false,
    promotionPiece: string = 'queen'
  ): GamePiece[] => {
    const fromFile = uciMove[0];
    const fromRank = parseInt(uciMove[1]);
    const toFile = uciMove[2];
    const toRank = parseInt(uciMove[3]);
    
    // Find the piece to move
    const movingPiece = piecesState.find(p => 
      p.file === fromFile && p.rank === fromRank
    );
    if (!movingPiece) return piecesState;
    
    let newPieces = [...piecesState];
    
    // Remove captured piece if any
    const capturedPiece = newPieces.find(p => 
      p.file === toFile && p.rank === toRank && p.color !== color
    );
    if (capturedPiece) {
      newPieces = newPieces.filter(p => p.id !== capturedPiece.id);
    }
    
    // Handle en passant capture (pawn moves diagonally to empty square)
    if (movingPiece.type === 'pawn' && fromFile !== toFile && !capturedPiece) {
      const enPassantRank = color === 'white' ? toRank - 1 : toRank + 1;
      const enPassantPawn = newPieces.find(p => 
        p.file === toFile && p.rank === enPassantRank && p.color !== color
      );
      if (enPassantPawn) {
        newPieces = newPieces.filter(p => p.id !== enPassantPawn.id);
      }
    }
    
    // Handle castling
    if (movingPiece.type === 'king' && Math.abs(fromFile.charCodeAt(0) - toFile.charCodeAt(0)) === 2) {
      // King side castling (e -> g)
      if (toFile === 'g') {
        const rook = newPieces.find(p => 
          p.file === 'h' && p.rank === fromRank && p.type === 'rook' && p.color === color
        );
        if (rook) {
          newPieces = newPieces.map(p => 
            p.id === rook.id ? { ...p, file: 'f' } : p
          );
        }
      }
      // Queen side castling (e -> c)
      else if (toFile === 'c') {
        const rook = newPieces.find(p => 
          p.file === 'a' && p.rank === fromRank && p.type === 'rook' && p.color === color
        );
        if (rook) {
          newPieces = newPieces.map(p => 
            p.id === rook.id ? { ...p, file: 'd' } : p
          );
        }
      }
    }
    
    // Move the piece
    newPieces = newPieces.map(p => {
      if (p.id === movingPiece.id) {
        // Handle promotion
        if (isPromotion || (movingPiece.type === 'pawn' && (toRank === 8 || toRank === 1))) {
          return { ...p, file: toFile, rank: toRank, type: promotionPiece };
        }
        return { ...p, file: toFile, rank: toRank };
      }
      return p;
    });
    
    return newPieces;
  };

  // Check game state after each move
  const checkGameState = async (newPieces: GamePiece[], nextTurn: 'white' | 'black') => {
    try {
      const fen = piecesToFen(newPieces, nextTurn);
      const state = await chessEngineApi.getGameState(fen);
      
      // Update check state - track which king is in check
      if (state.is_check || state.is_checkmate) {
        // The king in check is the one whose turn it is (they need to escape)
        setCheckedKingColor(nextTurn);
      } else {
        setCheckedKingColor(null);
      }
      
      if (state.is_checkmate) {
        const result = { winner: state.winner, reason: 'checkmate' };
        setGameOver(result);
        if (onGameOver) onGameOver(result);
      } else if (state.is_stalemate) {
        const result = { winner: null, reason: 'stalemate' };
        setGameOver(result);
        if (onGameOver) onGameOver(result);
      }
    } catch (err) {
      console.error('Error checking game state:', err);
    }
  };

  // AI move effect - when it's AI's turn, fetch and execute AI move
  useEffect(() => {
    const aiColor = playerColor === 'white' ? 'black' : 'white';
    
    console.log('AI useEffect triggered:', { currentTurn, aiColor, isAiThinking, gameOver });
    
    if (currentTurn !== aiColor || isAiThinking || gameOver) {
      console.log('AI useEffect blocked');
      return;
    }
    
    console.log('AI should make a move now!');
    
    const makeAiMove = async () => {
      setIsAiThinking(true);
      try {
        // Use ref to get the latest pieces value
        const currentPieces = piecesRef.current;
        const fen = piecesToFen(currentPieces, currentTurn);
        console.log('AI requesting move for FEN:', fen);
        const response = await chessEngineApi.getBestMove(fen, aiElo);
        
        if (response.best_move_uci) {
          console.log('AI best move:', response.best_move_uci);
          
          // Check if it's a promotion (5 chars like "e7e8q")
          const isPromotion = response.best_move_uci.length === 5;
          const promotionPiece = isPromotion ? 
            { 'q': 'queen', 'r': 'rook', 'b': 'bishop', 'n': 'knight' }[response.best_move_uci[4]] || 'queen' 
            : 'queen';
          
          // Start animation - use ref for current pieces
          const fromFile = response.best_move_uci[0];
          const fromRank = parseInt(response.best_move_uci[1]);
          const pieceToMove = currentPieces.find(p => p.file === fromFile && p.rank === fromRank);
          
          console.log('AI piece to move:', pieceToMove, 'from', fromFile, fromRank);
          
          if (pieceToMove) {
            setAnimatingPieces(new Set([pieceToMove.id]));
          }
          
          // Small delay for animation feel
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Execute the move - use ref to get latest pieces
          const latestPieces = piecesRef.current;
          console.log('AI executing move with pieces count:', latestPieces.length);
          const newPieces = executeMove(response.best_move_uci, aiColor, latestPieces, isPromotion, promotionPiece);
          console.log('AI move executed, newPieces count:', newPieces.length);
          setPieces(newPieces);
          setAnimatingPieces(new Set());
          
          // Notify parent
          if (onMoveMade) {
            console.log('AI calling onMoveMade:', response.best_move_uci, aiColor);
            onMoveMade(response.best_move_uci, aiColor);
          }
          
          // Check game state
          await checkGameState(newPieces, playerColor);
          
          console.log('AI setting turn to:', playerColor);
          setCurrentTurn(playerColor);
        }
      } catch (err) {
        console.error('AI move error:', err);
      } finally {
        setIsAiThinking(false);
      }
    };
    
    // Small delay for better UX
    const timer = setTimeout(makeAiMove, 500);
    return () => clearTimeout(timer);
  }, [currentTurn, playerColor, aiElo, isAiThinking, onMoveMade, gameOver]);

  const handlePieceClick = async (e: any, pieceId: string) => {
    e.stopPropagation();
    
    // Block clicks during AI turn or game over
    if (currentTurn !== playerColor || isAiThinking || gameOver) return;
    
    const clickedPiece = pieces.find(p => p.id === pieceId);
    
    // If clicking on a capturable piece, execute the capture
    if (capturablePieceIds.has(pieceId)) {
      const targetPiece = pieces.find(p => p.id === pieceId);
      const attackingPiece = pieces.find(p => p.id === selectedPieceId);
      if (targetPiece && attackingPiece) {
        const uciMove = `${attackingPiece.file}${attackingPiece.rank}${targetPiece.file}${targetPiece.rank}`;
        
        // Check for pawn promotion
        const isPromotion = attackingPiece.type === 'pawn' && 
          ((playerColor === 'white' && targetPiece.rank === 8) || 
           (playerColor === 'black' && targetPiece.rank === 1));
        
        const promoMove = isPromotion ? uciMove + 'q' : uciMove;
        
        // Execute move immediately
        const newPieces = executeMove(promoMove, playerColor, pieces, isPromotion, 'queen');
        
        // Update ref and state
        piecesRef.current = newPieces;
        setPieces(newPieces);
        setSelectedPieceId(null);
        
        // Notify parent
        if (onMoveMade) {
          onMoveMade(promoMove, playerColor);
        }
        
        // Check game state
        const nextTurn = playerColor === 'white' ? 'black' : 'white';
        await checkGameState(newPieces, nextTurn);
        
        // Switch turn
        setCurrentTurn(nextTurn);
        return;
      }
    }
    
    // Only allow selecting player's own pieces
    if (clickedPiece && clickedPiece.color !== playerColor) {
      return;
    }
    
    setSelectedPieceId(pieceId === selectedPieceId ? null : pieceId);
  };

  const handleMoveClick = (file: string, rank: number) => {
    console.log('handleMoveClick called:', { file, rank, selectedPieceId, currentTurn, playerColor, isAiThinking, gameOver });
    
    if (!selectedPieceId || currentTurn !== playerColor || isAiThinking || gameOver || awaitingPromotion) {
      console.log('handleMoveClick blocked by condition');
      return;
    }
    
    const movingPiece = pieces.find(p => p.id === selectedPieceId);
    if (!movingPiece) {
      console.log('movingPiece not found');
      return;
    }
    
    const uciMove = `${movingPiece.file}${movingPiece.rank}${file}${rank}`;
    console.log('UCI move:', uciMove);
    
    // Check for pawn promotion - show modal instead of auto-promoting
    const isPromotion = movingPiece.type === 'pawn' && 
      ((playerColor === 'white' && rank === 8) || 
       (playerColor === 'black' && rank === 1));
    
    if (isPromotion && onPromotionRequest) {
      // Show promotion modal via parent callback
      setAwaitingPromotion(true);
      onPromotionRequest((chosenPiece: 'queen' | 'rook' | 'bishop' | 'knight') => {
        // This callback is called when user selects a piece
        const promoChar = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }[chosenPiece];
        const promoMove = uciMove + promoChar;
        
        // Execute the promotion move
        const newPieces = executeMove(promoMove, playerColor, piecesRef.current, true, chosenPiece);
        
        // Update pieces AND ref
        piecesRef.current = newPieces;
        setPieces(newPieces);
        setSelectedPieceId(null);
        setAwaitingPromotion(false);
        
        // Notify parent
        if (onMoveMade) {
          onMoveMade(promoMove, playerColor);
        }
        
        // Check game state and switch turn
        const nextTurn = playerColor === 'white' ? 'black' : 'white';
        checkGameState(newPieces, nextTurn);
        setCurrentTurn(nextTurn);
      });
      return;
    }
    
    // Execute non-promotion move immediately
    const newPieces = executeMove(uciMove, playerColor, pieces, false, 'queen');
    console.log('Move executed, newPieces count:', newPieces.length);
    
    // Update pieces AND ref immediately - ref must be updated before setCurrentTurn
    piecesRef.current = newPieces;
    setPieces(newPieces);
    setSelectedPieceId(null);
    
    // Notify parent
    if (onMoveMade) {
      console.log('Calling onMoveMade:', uciMove, playerColor);
      onMoveMade(uciMove, playerColor);
    }
    
    // Check game state in background (non-blocking)
    const nextTurn = playerColor === 'white' ? 'black' : 'white';
    checkGameState(newPieces, nextTurn);
    
    // Switch turn LAST - this triggers the AI useEffect
    console.log('Switching turn to:', nextTurn);
    setCurrentTurn(nextTurn);
  };

  const handleBoardClick = () => {
    // Deselect when clicking on empty board area
    if (selectedPieceId && !awaitingPromotion) {
      setSelectedPieceId(null);
    }
  };

  return (
    <group>
      {/* Board Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[frameSizeUnits, frameHeight, frameSizeUnits]} />
        <meshBasicMaterial color="#5c3d2e" />
      </mesh>

      {/* Board Surface (Clickable) */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, frameHeight / 2 + 0.01, 0]}
        onClick={handleBoardClick}
      >
        <planeGeometry args={[boardSizeUnits, boardSizeUnits]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Move Indicators - white circles for valid moves */}
      {!isLoadingMoves && possibleMoves.filter(m => !m.isCapture).map(move => (
        <MoveIndicator
          key={`move-${move.file}${move.rank}`}
          file={move.file}
          rank={move.rank}
          squareSizeCm={squareSizeCm}
          onClick={() => handleMoveClick(move.file, move.rank)}
        />
      ))}

      {/* Pieces */}
      {pieces.map(piece => {
        const pieceSet = piece.color === 'white' ? whitePieces : blackPieces;
        const modelInfo = getModelInfo(pieceSet, piece.type);
        
        if (!modelInfo) return null;
        
        // Check if this king is in check (works for both player and enemy king)
        const isKingInCheck = piece.type === 'king' && piece.color === checkedKingColor;
        // Only shake player's king when trying to move wrong piece
        const shouldShake = isKingInCheck && piece.color === playerColor && kingShaking;
        
        // Determine if marker should be shown for this piece
        const isPlayerPiece = piece.color === playerColor;
        const shouldShowMarker = isPlayerPiece ? showPlayerMarkers : showEnemyMarkers;

        return (
          <ChessPiece
            key={piece.id}
            modelInfo={modelInfo}
            file={piece.file}
            rank={piece.rank}
            scale={1}
            rotationY={piece.color === 'white' ? Math.PI : 0}
            squareSizeCm={squareSizeCm}
            onClick={(e: any) => handlePieceClick(e, piece.id)}
            isSelected={selectedPieceId === piece.id}
            isCaptureThreat={capturablePieceIds.has(piece.id)}
            isAnimating={animatingPieces.has(piece.id)}
            isInCheck={isKingInCheck}
            isShaking={shouldShake}
            showMarker={shouldShowMarker}
            pieceType={piece.type}
          />
        );
      })}
    </group>
  );
}

// Promotion Modal Component
function PromotionModal({ 
  onChoice, 
  playerColor 
}: { 
  onChoice: (piece: 'queen' | 'rook' | 'bishop' | 'knight') => void;
  playerColor: 'white' | 'black';
}) {
  const pieces: Array<{ type: 'queen' | 'rook' | 'bishop' | 'knight'; symbol: string; name: string }> = [
    { type: 'queen', symbol: '♛', name: 'Regina' },
    { type: 'rook', symbol: '♜', name: 'Torre' },
    { type: 'bishop', symbol: '♝', name: 'Alfiere' },
    { type: 'knight', symbol: '♞', name: 'Cavallo' },
  ];

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-600">
        <h3 className="text-white text-xl font-bold text-center mb-4">
          Promuovi il pedone
        </h3>
        <div className="flex gap-3">
          {pieces.map(({ type, symbol, name }) => (
            <button
              key={type}
              onClick={() => onChoice(type)}
              className="flex flex-col items-center p-4 bg-gray-700 hover:bg-gray-600 
                         rounded-lg transition-colors border-2 border-transparent 
                         hover:border-blue-500 min-w-[80px]"
            >
              <span 
                className="text-5xl mb-2" 
                style={{ color: playerColor === 'white' ? '#fff' : '#333' }}
              >
                {symbol}
              </span>
              <span className="text-gray-300 text-sm">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayableChessboard({ whitePieces, blackPieces, squareSizeCm = 6, playerColor = 'white', aiElo = 1200, onMoveMade, isPlayerTurn, onGameOver }: PlayableChessboardProps) {
  const [promotionCallback, setPromotionCallback] = useState<((piece: 'queen' | 'rook' | 'bishop' | 'knight') => void) | null>(null);
  const [showPlayerMarkers, setShowPlayerMarkers] = useState(false);
  const [showEnemyMarkers, setShowEnemyMarkers] = useState(false);
  const [showMarkerMenu, setShowMarkerMenu] = useState(false);
  
  // Camera position: looking from player's side
  // White plays from positive Z (looking towards negative Z)
  // Black plays from negative Z (looking towards positive Z)
  const cameraZ = playerColor === 'white' ? 40 : -40;
  
  const handlePromotionRequest = (callback: (piece: 'queen' | 'rook' | 'bishop' | 'knight') => void) => {
    setPromotionCallback(() => callback);
  };
  
  const handlePromotionChoice = (piece: 'queen' | 'rook' | 'bishop' | 'knight') => {
    if (promotionCallback) {
      promotionCallback(piece);
      setPromotionCallback(null);
    }
  };
  
  return (
    <div className="w-full h-full bg-gray-900 relative">
      <Canvas camera={{ position: [0, 40, cameraZ], fov: 45 }} shadows>
        {/* Enhanced lighting setup - stronger for dark piece visibility */}
        <ambientLight intensity={0.7} />
        
        {/* Main directional light from top-front - creates nice shadows */}
        <directionalLight 
          position={[10, 30, 20]} 
          intensity={1.5} 
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={100}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        
        {/* Strong fill light from opposite side - helps dark pieces */}
        <directionalLight position={[-15, 25, -15]} intensity={0.9} />
        
        {/* Additional fill from front */}
        <directionalLight position={[0, 20, 30]} intensity={0.6} />
        
        {/* Soft point lights for ambiance - increased intensity */}
        <pointLight position={[25, 20, 25]} intensity={1.0} color="#fff5e6" />
        <pointLight position={[-25, 20, -25]} intensity={0.8} color="#e6f0ff" />
        <pointLight position={[25, 20, -25]} intensity={0.6} color="#ffffff" />
        <pointLight position={[-25, 20, 25]} intensity={0.6} color="#ffffff" />
        
        {/* Top spotlight for even coverage */}
        <spotLight 
          position={[0, 50, 0]} 
          angle={0.8} 
          penumbra={1} 
          intensity={1.2} 
          color="#ffffff"
        />
        
        {/* Hemisphere light for natural outdoor feel - great for dark objects */}
        <hemisphereLight args={['#ffffff', '#444444', 0.6]} />
        
        <Suspense fallback={null}>
          <GameScene 
            whitePieces={whitePieces} 
            blackPieces={blackPieces} 
            squareSizeCm={squareSizeCm}
            playerColor={playerColor}
            aiElo={aiElo}
            onMoveMade={onMoveMade}
            isPlayerTurn={isPlayerTurn}
            onGameOver={onGameOver}
            onPromotionRequest={handlePromotionRequest}
            showPlayerMarkers={showPlayerMarkers}
            showEnemyMarkers={showEnemyMarkers}
          />
          <OrbitControls 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2.2} 
            minDistance={20}
            maxDistance={100}
          />
        </Suspense>
      </Canvas>
      
      {/* Marker Toggle Menu - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMarkerMenu(!showMarkerMenu);
          }}
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg 
                     shadow-lg border border-gray-600 flex items-center gap-2 transition-colors
                     cursor-pointer select-none whitespace-nowrap"
        >
          <span className="text-xl">🎯</span>
          <span className="text-sm font-medium">Segnaposti</span>
          <span className={`text-xs transition-transform duration-200 ${showMarkerMenu ? 'rotate-180' : ''}`}>▼</span>
        </button>
        
        {/* Dropdown Menu */}
        {showMarkerMenu && (
          <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg shadow-xl 
                          border border-gray-600 p-4 min-w-[240px] z-50"
               onClick={(e) => e.stopPropagation()}>
            {/* Toggle switches */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium">I tuoi pezzi</span>
                <button
                  onClick={() => setShowPlayerMarkers(!showPlayerMarkers)}
                  className={`w-12 h-6 rounded-full transition-colors duration-200 relative focus:outline-none ${
                    showPlayerMarkers ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span 
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      showPlayerMarkers ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-medium">Pezzi nemici</span>
                <button
                  onClick={() => setShowEnemyMarkers(!showEnemyMarkers)}
                  className={`w-12 h-6 rounded-full transition-colors duration-200 relative focus:outline-none ${
                    showEnemyMarkers ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span 
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      showEnemyMarkers ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            {/* Legend */}
            {(showPlayerMarkers || showEnemyMarkers) && (
              <div className="border-t border-gray-600 pt-3 animate-fadeIn">
                <h4 className="text-gray-400 text-xs uppercase font-bold mb-3 tracking-wider">Legenda</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                  {Object.entries(PIECE_MARKER_COLORS).map(([type, { color, name }]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                      />
                      <span className="text-gray-200 text-xs">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Promotion Modal Overlay */}
      {promotionCallback && (
        <PromotionModal onChoice={handlePromotionChoice} playerColor={playerColor} />
      )}
    </div>
  );
}



