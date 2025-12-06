import chess
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

# ==========================================
# 1. CORE LOGIC (Motore & Regole)
# ==========================================

# --- A. LOGICA MOTORE (AI) ---

PIECE_VALUES = {
    chess.PAWN: 100, chess.KNIGHT: 300, chess.BISHOP: 300,
    chess.ROOK: 500, chess.QUEEN: 900, chess.KING: 0
}

def elo_to_depth(elo: int) -> int:
    """Converte l'Elo in profondità di ricerca (Depth)."""
    if elo < 1000: return 1
    if elo < 1200: return 2
    if elo < 1500: return 3
    if elo < 1800: return 4
    if elo < 2100: return 5
    return 6

def evaluate_position(board: chess.Board) -> int:
    """Valuta la posizione staticamente (Materiale)."""
    if board.is_checkmate():
        return 1000000 if board.turn == chess.BLACK else -1000000
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    for pt in PIECE_VALUES:
        score += len(board.pieces(pt, chess.WHITE)) * PIECE_VALUES[pt]
        score -= len(board.pieces(pt, chess.BLACK)) * PIECE_VALUES[pt]
    
    # Restituisce punteggio assoluto (prospettiva del Bianco)
    return score

def negamax(board: chess.Board, depth: int, alpha: int, beta: int) -> int:
    """Algoritmo di ricerca ricorsiva."""
    if depth == 0 or board.is_game_over():
        eval_score = evaluate_position(board)
        return eval_score if board.turn == chess.WHITE else -eval_score

    max_score = -float('inf')
    # Ordina mosse (catture prima) per ottimizzare Alpha-Beta
    moves = sorted(board.legal_moves, key=lambda m: board.is_capture(m), reverse=True)

    for move in moves:
        board.push(move)
        score = -negamax(board, depth - 1, -beta, -alpha)
        board.pop()
        
        max_score = max(max_score, score)
        alpha = max(alpha, max_score)
        if alpha >= beta:
            break
    return max_score

def get_ai_move(board: chess.Board, elo: int) -> str | None:
    """Trova la mossa migliore basata sull'Elo."""
    depth = elo_to_depth(elo)
    best_move = None
    best_score = -float('inf')
    
    # Root search
    for move in board.legal_moves:
        board.push(move)
        score = -negamax(board, depth - 1, -float('inf'), float('inf'))
        board.pop()

        if score > best_score:
            best_score = score
            best_move = move
            
    return best_move.uci() if best_move else None

# --- B. LOGICA REGOLE (Validazione Mosse) ---

def get_legal_moves_data(board: chess.Board, square_uci: str = None):
    """
    Restituisce le mosse legali. Se square_uci è specificato (es. 'e2'),
    restituisce solo le mosse per quel pezzo.
    """
    moves_data = []
    target_sq = chess.parse_square(square_uci) if square_uci else None

    for move in board.legal_moves:
        # Se abbiamo chiesto un pezzo specifico, saltiamo le mosse di altri pezzi
        if target_sq is not None and move.from_square != target_sq:
            continue

        moves_data.append({
            "uci": move.uci(),              # Es: "e2e4"
            "san": board.san(move),         # Es: "e4"
            "from_sq": chess.square_name(move.from_square),
            "to_sq": chess.square_name(move.to_square),
            "is_capture": board.is_capture(move),
            "is_check": board.gives_check(move)
        })
    
    return moves_data

# ==========================================
# 2. DATA MODELS (Pydantic)
# ==========================================

class FenRequest(BaseModel):
    fen: str = Field(..., description="Stringa FEN della posizione attuale")

class EngineRequest(FenRequest):
    elo: int = Field(1200, ge=0, le=3000, description="Livello di difficoltà desiderato")

class EngineResponse(BaseModel):
    best_move_uci: str | None
    fen_after: str | None
    depth_used: int

class MovesRequest(FenRequest):
    square: Optional[str] = Field(None, description="Casella specifica (es. 'e2') opzionale")

class MoveDetail(BaseModel):
    uci: str
    san: str
    from_sq: str
    to_sq: str
    is_capture: bool
    is_check: bool

class MovesResponse(BaseModel):
    turn: str
    legal_moves: List[MoveDetail]
    count: int

class GameStateResponse(BaseModel):
    is_checkmate: bool
    is_stalemate: bool
    is_check: bool
    is_game_over: bool
    winner: str | None  # "white", "black", or None for draw/ongoing
    turn: str

# ==========================================
# 3. API ROUTER
# ==========================================

router = APIRouter(prefix="/chess", tags=["Chess Engine"])

@router.post("/engine/best-move", response_model=EngineResponse)
def calculate_best_move(payload: EngineRequest):
    """
    FUNZIONALITÀ 1: Dato un FEN e un Elo, calcola la mossa migliore (AI).
    """
    try:
        board = chess.Board(payload.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="FEN non valida")

    if board.is_game_over():
        return {"best_move_uci": None, "fen_after": payload.fen, "depth_used": 0}

    best_move_uci = get_ai_move(board, payload.elo)
    
    # Calcola il FEN risultante per comodità del frontend
    board.push_uci(best_move_uci)
    
    return {
        "best_move_uci": best_move_uci,
        "fen_after": board.fen(),
        "depth_used": elo_to_depth(payload.elo)
    }

@router.post("/rules/legal-moves", response_model=MovesResponse)
def get_possible_moves(payload: MovesRequest):
    """
    FUNZIONALITÀ 2: Data una posizione, e opzionalmente una casella,
    restituisce dove quel pezzo può muovere e se può mangiare.
    """
    try:
        board = chess.Board(payload.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="FEN non valida")

    # Verifica validità casella se fornita
    if payload.square:
        try:
            chess.parse_square(payload.square)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Casella '{payload.square}' non valida")

    moves_list = get_legal_moves_data(board, payload.square)

    return {
        "turn": "white" if board.turn == chess.WHITE else "black",
        "legal_moves": moves_list,
        "count": len(moves_list)
    }

@router.post("/rules/game-state", response_model=GameStateResponse)
def get_game_state(payload: FenRequest):
    """
    FUNZIONALITÀ 3: Restituisce lo stato della partita (scacco, matto, patta).
    """
    try:
        board = chess.Board(payload.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="FEN non valida")

    is_checkmate = board.is_checkmate()
    is_stalemate = board.is_stalemate()
    is_check = board.is_check()
    is_game_over = board.is_game_over()
    
    winner = None
    if is_checkmate:
        # The player to move is in checkmate, so the other player wins
        winner = "black" if board.turn == chess.WHITE else "white"

    return {
        "is_checkmate": is_checkmate,
        "is_stalemate": is_stalemate,
        "is_check": is_check,
        "is_game_over": is_game_over,
        "winner": winner,
        "turn": "white" if board.turn == chess.WHITE else "black"
    }
