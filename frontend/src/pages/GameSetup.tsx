import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { chessSetsApi } from '../services/api';
import { ArrowLeft, Play, Shuffle } from 'lucide-react';
import sizePresetsConfig from '../config/sizePresets.json';

export default function GameSetup() {
  const navigate = useNavigate();
  const [playerSetId, setPlayerSetId] = useState<string>('');
  const [opponentSetId, setOpponentSetId] = useState<string>('');
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | 'random'>('random');
  const [timeControl, setTimeControl] = useState('10+0');
  const [boardSize, setBoardSize] = useState<string>('small');
  const [customBoardSizeCm, setCustomBoardSizeCm] = useState<number>(6);
  const [aiElo, setAiElo] = useState<number>(1200);

  const { data: sets, isLoading } = useQuery({
    queryKey: ['chess-sets'],
    queryFn: chessSetsApi.getAll,
  });

  const handleStart = () => {
    if (playerSetId && opponentSetId) {
      // Determine actual player color (resolve random)
      let actualPlayerColor: 'white' | 'black' = playerColor === 'random' 
        ? (Math.random() > 0.5 ? 'white' : 'black')
        : playerColor;

      navigate(`/game/play?playerSet=${playerSetId}&opponentSet=${opponentSetId}&playerColor=${actualPlayerColor}&time=${encodeURIComponent(timeControl)}&size=${boardSize === 'custom' ? `custom_${customBoardSizeCm}` : boardSize}&elo=${aiElo}`);
    }
  };

  if (isLoading) return <div className="text-center py-12">Caricamento...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 group"
      >
        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        Torna alla Dashboard
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Nuova Partita 1 vs 1</h2>

        <div className="space-y-6">
          {/* Player Set Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Il tuo Set
            </label>
            <select
              value={playerSetId}
              onChange={(e) => setPlayerSetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleziona il tuo set...</option>
              {sets?.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>

          {/* Opponent Set Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Set Avversario
            </label>
            <select
              value={opponentSetId}
              onChange={(e) => setOpponentSetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleziona set avversario...</option>
              {sets?.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Il tuo Colore
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPlayerColor('white')}
                className={`px-4 py-3 rounded-lg border flex items-center justify-center gap-2 ${
                  playerColor === 'white'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white border border-gray-400" />
                Bianco
              </button>
              <button
                onClick={() => setPlayerColor('random')}
                className={`px-4 py-3 rounded-lg border flex items-center justify-center gap-2 ${
                  playerColor === 'random'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Shuffle className="w-4 h-4" />
                Casuale
              </button>
              <button
                onClick={() => setPlayerColor('black')}
                className={`px-4 py-3 rounded-lg border flex items-center justify-center gap-2 ${
                  playerColor === 'black'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-gray-900" />
                Nero
              </button>
            </div>
          </div>

          {/* Time Control Mockup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tempo di Gioco
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['10+0', '15+10', '30+0'].map((tc) => (
                <button
                  key={tc}
                  onClick={() => setTimeControl(tc)}
                  className={`px-4 py-2 rounded-lg border ${
                    timeControl === tc
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tc}
                </button>
              ))}
            </div>
          </div>

          {/* AI ELO Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficoltà Avversario (ELO: {aiElo})
            </label>
            <input
              type="range"
              min="400"
              max="2800"
              step="100"
              value={aiElo}
              onChange={(e) => setAiElo(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Principiante (400)</span>
              <span>Intermedio (1200)</span>
              <span>Esperto (2800)</span>
            </div>
          </div>

          {/* Board Size Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dimensione Scacchiera
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(sizePresetsConfig.presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setBoardSize(key)}
                  className={`px-4 py-2 rounded-lg border ${
                    boardSize === key
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-xs text-gray-500">{preset.baseSizeCm} cm</div>
                </button>
              ))}
              <button
                onClick={() => setBoardSize('custom')}
                className={`px-4 py-2 rounded-lg border ${
                  boardSize === 'custom'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Custom</div>
                <div className="text-xs text-gray-500">Personalizzata</div>
              </button>
            </div>
            {boardSize === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-gray-600">Lato casella (cm):</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={customBoardSizeCm}
                  onChange={(e) => setCustomBoardSizeCm(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleStart}
            disabled={!playerSetId || !opponentSetId}
            className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
          >
            <Play className="w-5 h-5 mr-2" />
            Inizia Partita
          </button>
        </div>
      </div>
    </div>
  );
}
