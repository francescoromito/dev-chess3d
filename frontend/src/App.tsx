/**
 * Main App Component with React Router
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import SetDetail from './pages/SetDetail';
import PieceDetail from './pages/PieceDetail';
import GameSetup from './pages/GameSetup';
import GamePlay from './pages/GamePlay';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Chess Set Design Manager
              </h1>
            </div>
          </header>
          
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sets/:setId" element={<SetDetail />} />
              <Route path="/pieces/:pieceId" element={<PieceDetail />} />
              <Route path="/game/setup" element={<GameSetup />} />
              <Route path="/game/play" element={<GamePlay />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
