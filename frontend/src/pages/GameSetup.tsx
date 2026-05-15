import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { chessSetsApi } from '../services/api';
import { ArrowLeft, Shuffle } from 'lucide-react';
import sizePresetsConfig from '../config/sizePresets.json';

export default function GameSetup() {
  const navigate = useNavigate();
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [playerSetId, setPlayerSetId] = useState<string>('');
  const [opponentSetId, setOpponentSetId] = useState<string>('');
  const [timeControl, setTimeControl] = useState('10+0');
  const [boardSize, setBoardSize] = useState<string>('small');
  const [aiElo, setAiElo] = useState<number>(1200);

  const { data: sets, isLoading } = useQuery({
    queryKey: ['chess-sets'],
    queryFn: chessSetsApi.getAll,
  });

  // Trova i set di base
  const defaultWhiteSetId = sets?.find((s) => s.name?.toLowerCase() === 'bianco')?.id?.toString() || '';
  const defaultBlackSetId = sets?.find((s) => s.name?.toLowerCase() === 'nero')?.id?.toString() || '';

  // Filtra i set di base dalla select
  const selectableSets = sets?.filter(
    (s) => s.name?.toLowerCase() !== 'bianco' && s.name?.toLowerCase() !== 'nero'
  ) || [];

  // Auto-seleziona il set avversario uguale al tuo in modalità rapida se non è stato scelto specificamente
  useEffect(() => {
    if (!isAdvancedMode && playerSetId) {
      setOpponentSetId(playerSetId);
    }
  }, [playerSetId, isAdvancedMode]);

  const handleStart = (selectedColor: 'white' | 'black' | 'random') => {
    // Determine actual player color
    let actualPlayerColor: 'white' | 'black' = selectedColor === 'random' 
      ? (Math.random() > 0.5 ? 'white' : 'black')
      : selectedColor;

    // Fallback: se non è selezionato nulla, usa i default (Bianco vs Nero)
    let pSet = playerSetId;
    let oSet = opponentSetId;

    if (!pSet && !oSet) {
      // Se non si seleziona nulla, usiamo i set di base a seconda del colore
      pSet = actualPlayerColor === 'white' ? defaultWhiteSetId : defaultBlackSetId;
      oSet = actualPlayerColor === 'white' ? defaultBlackSetId : defaultWhiteSetId;
    } else {
      // Se ha selezionato solo il proprio set (es. in modalità rapida o si è scordato quello avversario)
      // l'avversario usa lo stesso set, oppure quello che è stato selezionato.
      const fallbackForOpponent = isAdvancedMode ? opponentSetId : playerSetId;
      if (!fallbackForOpponent) {
        // Se in modalità avanzata non ha selezionato l'avversario, diamogli quello di base opposto al suo
        oSet = actualPlayerColor === 'white' ? defaultBlackSetId : defaultWhiteSetId;
      } else {
        oSet = fallbackForOpponent;
      }
      // Se ha selezionato solo l'avversario ma non il proprio set
      if (!pSet) {
        pSet = actualPlayerColor === 'white' ? defaultWhiteSetId : defaultBlackSetId;
      }
    }

    if (pSet && oSet) {
      const finalTimeControl = isAdvancedMode ? timeControl : '10+0';
      const finalBoardSize = isAdvancedMode ? boardSize : 'small';

      navigate(`/game/play?playerSet=${pSet}&opponentSet=${oSet}&playerColor=${actualPlayerColor}&time=${encodeURIComponent(finalTimeControl)}&size=${finalBoardSize}&elo=${aiElo}`);
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Nuova Partita 1 vs 1</h2>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setIsAdvancedMode(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                !isAdvancedMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Rapida
            </button>
            <button
              onClick={() => setIsAdvancedMode(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isAdvancedMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Personalizzata
            </button>
          </div>
        </div>

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
              <option value="">Seleziona il tuo set (default Bianco/Nero)...</option>
              {selectableSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>

          {/* Opponent Set Selection - solo in advanced */}
          {isAdvancedMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set Avversario
              </label>
              <select
                value={opponentSetId}
                onChange={(e) => setOpponentSetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleziona set avversario (default Nero/Bianco)...</option>
                {selectableSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Control - solo in advanced */}
          {isAdvancedMode && (
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
          )}

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

          {/* Board Size Selection - solo in advanced */}
          {isAdvancedMode && (
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
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">Scegli il colore e avvia</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleStart('white')}
                className="flex flex-col items-center justify-center py-4 px-2 bg-gray-50 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-400 mb-2 group-hover:border-blue-500 transition-colors" />
                <span className="font-medium text-gray-700 group-hover:text-blue-700">Bianco</span>
              </button>

              <button
                onClick={() => handleStart('random')}
                className="flex flex-col items-center justify-center py-4 px-2 bg-gray-50 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <Shuffle className="w-8 h-8 text-gray-500 mb-2 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium text-gray-700 group-hover:text-blue-700">Casuale</span>
              </button>

              <button
                onClick={() => handleStart('black')}
                className="flex flex-col items-center justify-center py-4 px-2 bg-gray-50 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-transparent mb-2" />
                <span className="font-medium text-gray-700 group-hover:text-blue-700">Nero</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
