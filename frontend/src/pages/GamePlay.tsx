import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { chessSetsApi } from '../services/api';
import PlayableChessboard from '../components/PlayableChessboard';
import { ArrowLeft } from 'lucide-react';
import sizePresetsConfig from '../config/sizePresets.json';

interface MoveRecord {
  moveNumber: number;
  white?: string;
  black?: string;
}

export default function GamePlay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerSetId = searchParams.get('playerSet');
  const opponentSetId = searchParams.get('opponentSet');
  const playerColor = searchParams.get('playerColor') as 'white' | 'black' || 'white';
  const timeControl = searchParams.get('time') || '10+0';
  const sizeKey = searchParams.get('size') || 'medium';
  const aiElo = parseInt(searchParams.get('elo') || '1200');

  // Parse time control (e.g., "10+0" -> 10 minutes, 0 increment)
  const timeControlDecoded = decodeURIComponent(timeControl);
  const timeParts = timeControlDecoded.split('+').map(Number);
  const baseMinutes = isNaN(timeParts[0]) ? 10 : timeParts[0];
  const increment = isNaN(timeParts[1]) ? 0 : timeParts[1];
  const initialTimeSeconds = baseMinutes * 60;

  // Timer states
  const [whiteTime, setWhiteTime] = useState(initialTimeSeconds);
  const [blackTime, setBlackTime] = useState(initialTimeSeconds);
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: string | null; reason: string } | null>(null);

  // Move history
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);

  // Get size in cm from config
  const squareSizeCm = (sizePresetsConfig.presets as any)[sizeKey]?.baseSizeCm || 6;

  const { data: playerSet, isLoading: isLoadingPlayer } = useQuery({
    queryKey: ['chess-set', playerSetId],
    queryFn: () => chessSetsApi.getById(Number(playerSetId)),
    enabled: !!playerSetId,
  });

  const { data: opponentSet, isLoading: isLoadingOpponent } = useQuery({
    queryKey: ['chess-set', opponentSetId],
    queryFn: () => chessSetsApi.getById(Number(opponentSetId)),
    enabled: !!opponentSetId,
  });

  // Timer effect
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      if (currentTurn === 'white') {
        setWhiteTime(prev => {
          if (prev <= 0) {
            setGameOver(true);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 0) {
            setGameOver(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTurn, gameStarted, gameOver]);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle move made (called from PlayableChessboard)
  const handleMoveMade = useCallback((moveSan: string, color: 'white' | 'black') => {
    if (!gameStarted) setGameStarted(true);

    // Add increment to the player who just moved
    if (color === 'white') {
      setWhiteTime(prev => prev + increment);
    } else {
      setBlackTime(prev => prev + increment);
    }

    // Update move history
    setMoveHistory(prev => {
      if (color === 'white') {
        return [...prev, { moveNumber: prev.length + 1, white: moveSan }];
      } else {
        const lastMove = prev[prev.length - 1];
        if (lastMove && !lastMove.black) {
          return [...prev.slice(0, -1), { ...lastMove, black: moveSan }];
        }
        return [...prev, { moveNumber: prev.length + 1, black: moveSan }];
      }
    });

    // Switch turn
    setCurrentTurn(color === 'white' ? 'black' : 'white');
  }, [gameStarted, increment]);

  // Handle game over from checkmate/stalemate
  const handleGameOver = useCallback((result: { winner: string | null; reason: string }) => {
    setGameOver(true);
    setGameResult(result);
  }, []);

  if (isLoadingPlayer || isLoadingOpponent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Caricamento scacchiere...</div>
      </div>
    );
  }

  if (!playerSet || !opponentSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl mb-4">Errore nel caricamento dei set</div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Torna alla Dashboard
        </button>
      </div>
    );
  }

  // Determine which set is white and which is black based on player color choice
  const whitePieces = playerColor === 'white' ? playerSet.pieces : opponentSet.pieces;
  const blackPieces = playerColor === 'white' ? opponentSet.pieces : playerSet.pieces;
  const whiteSetName = playerColor === 'white' ? playerSet.name : opponentSet.name;
  const blackSetName = playerColor === 'white' ? opponentSet.name : playerSet.name;

  const isPlayerTurn = currentTurn === playerColor;
  const opponentColor = playerColor === 'white' ? 'black' : 'white';

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main Game Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Partita vs AI (ELO: {aiElo})</h1>
              <div className="text-sm text-gray-400">
                {whiteSetName} vs {blackSetName} • Tu: {playerColor === 'white' ? 'Bianco' : 'Nero'}
              </div>
            </div>
          </div>
          
          {/* Timers */}
          <div className="flex items-center gap-4">
            {/* Opponent Timer */}
            <div className={`px-4 py-2 rounded font-mono text-xl shadow-md flex items-center gap-2 ${
              opponentColor === 'white' ? 'bg-white text-black' : 'bg-black text-white'
            } ${currentTurn === opponentColor ? 'ring-4 ring-yellow-400' : ''}`}>
              {playerColor === 'white' ? formatTime(blackTime) : formatTime(whiteTime)}
              <span className="text-xs ml-2 opacity-80">AI</span>
            </div>

            {/* Player Timer */}
            <div className={`px-4 py-2 rounded font-mono text-xl shadow-md flex items-center gap-2 ${
              playerColor === 'white' ? 'bg-white text-black' : 'bg-black text-white'
            } ${currentTurn === playerColor ? 'ring-4 ring-green-400' : ''}`}>
              {playerColor === 'white' ? formatTime(whiteTime) : formatTime(blackTime)}
              <span className="text-xs ml-2 opacity-80">Tu</span>
            </div>
          </div>
        </div>

        {/* Game Board */}
        <div className="flex-1 relative">
          {gameOver && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 text-center max-w-md">
                <h2 className="text-3xl font-bold mb-2">
                  {gameResult?.reason === 'checkmate' 
                    ? '♔ Scacco Matto! ♚' 
                    : gameResult?.reason === 'stalemate'
                    ? '½-½ Stallo'
                    : '⏱️ Tempo Scaduto'}
                </h2>
                <p className="text-xl mb-6 text-gray-600">
                  {gameResult?.reason === 'checkmate' 
                    ? gameResult.winner === playerColor 
                      ? 'Hai vinto! 🎉' 
                      : 'Hai perso!'
                    : gameResult?.reason === 'stalemate'
                    ? 'La partita è patta!'
                    : (whiteTime <= 0 && playerColor === 'white') || (blackTime <= 0 && playerColor === 'black')
                    ? 'Hai perso per tempo!'
                    : 'Hai vinto per tempo! 🎉'}
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Nuova Partita
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Torna alla Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
          <PlayableChessboard
            whitePieces={whitePieces}
            blackPieces={blackPieces}
            squareSizeCm={squareSizeCm}
            playerColor={playerColor}
            aiElo={aiElo}
            onMoveMade={handleMoveMade}
            isPlayerTurn={isPlayerTurn}
            onGameOver={handleGameOver}
          />
        </div>
      </div>

      {/* Move History Panel */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-white font-semibold">Mosse</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {moveHistory.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-4">
              Nessuna mossa ancora
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {moveHistory.map((move, idx) => (
                  <tr key={idx} className="text-gray-300">
                    <td className="w-8 text-gray-500 pr-2">{move.moveNumber}.</td>
                    <td className="w-16 text-white">{move.white || ''}</td>
                    <td className="w-16 text-white">{move.black || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Game Status */}
        <div className="p-4 border-t border-gray-700">
          <div className={`text-center py-2 rounded ${
            isPlayerTurn ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
          }`}>
            {isPlayerTurn ? 'Tocca a te!' : 'AI sta pensando...'}
          </div>
        </div>
      </div>
    </div>
  );
}
