"""
Business logic for ChessSet operations
"""
from typing import List, Optional
from sqlmodel import Session, select
from app.models import (
    ChessSet, ChessSetCreate, ChessSetRead, ChessSetReadWithPieces,
    ChessPiece, ChessPieceCreate, PieceType, PieceVersion
)
from app.services.piece_version_service import PieceVersionService
import shutil


class ChessSetService:
    """Service layer for ChessSet operations"""
    
    @staticmethod
    def duplicate_set(session: Session, set_id: int) -> Optional[ChessSet]:
        """Duplicate a chess set and all its pieces/versions"""
        original_set = session.get(ChessSet, set_id)
        if not original_set:
            return None
        
        # Create new set
        new_set_data = ChessSetCreate(
            name=f"{original_set.name} - Copia",
            description=original_set.description
        )
        new_set = ChessSet.model_validate(new_set_data)
        session.add(new_set)
        session.commit()
        session.refresh(new_set)
        
        # Copy pieces
        for original_piece in original_set.pieces:
            new_piece = ChessPiece(
                set_id=new_set.id,
                type=original_piece.type,
                name=original_piece.name,
                description=original_piece.description
            )
            session.add(new_piece)
            session.commit()
            session.refresh(new_piece)
            
            # Copy versions
            for original_version in original_piece.versions:
                new_version = PieceVersion(
                    piece_id=new_piece.id,
                    version_name=original_version.version_name,
                    version_description=original_version.version_description,
                    img_front=original_version.img_front,
                    img_back=original_version.img_back,
                    img_side_r=original_version.img_side_r,
                    img_side_l=original_version.img_side_l,
                    model_glb=original_version.model_glb,
                    is_favorite=original_version.is_favorite
                )
                session.add(new_version)
        
        session.commit()
        session.refresh(new_set)
        return new_set

    @staticmethod
    def create_set(session: Session, set_data: ChessSetCreate) -> ChessSet:
        """
        Create a new chess set with all 6 piece types automatically
        """
        # Create the chess set
        db_set = ChessSet.model_validate(set_data)
        session.add(db_set)
        session.commit()
        session.refresh(db_set)
        
        # Create all 6 standard piece types
        piece_types = [
            PieceType.KING,
            PieceType.QUEEN,
            PieceType.ROOK,
            PieceType.BISHOP,
            PieceType.KNIGHT,
            PieceType.PAWN
        ]
        
        for piece_type in piece_types:
            piece = ChessPiece(set_id=db_set.id, type=piece_type)
            session.add(piece)
        
        session.commit()
        session.refresh(db_set)
        
        return db_set
    
    @staticmethod
    def get_all_sets(session: Session) -> List[ChessSet]:
        """Get all chess sets"""
        statement = select(ChessSet).order_by(ChessSet.created_at.desc())
        results = session.exec(statement)
        return list(results.all())
    
    @staticmethod
    def get_set_by_id(session: Session, set_id: int) -> Optional[ChessSet]:
        """Get a specific chess set by ID"""
        return session.get(ChessSet, set_id)
    
    @staticmethod
    def delete_set(session: Session, set_id: int) -> bool:
        """Delete a chess set and all its pieces"""
        db_set = session.get(ChessSet, set_id)
        if not db_set:
            return False

        # Ensure associated files for each piece/version are removed
        try:
            for piece in list(db_set.pieces or []):
                # Delete each version using the service so files are removed
                for version in list(getattr(piece, 'versions', []) or []):
                    try:
                        PieceVersionService.delete_version(session, version.id)
                    except Exception:
                        # Best-effort: continue even if a version fails to delete
                        pass

                # After deleting versions, remove the piece directory if present
                try:
                    piece_dir = PieceVersionService.UPLOAD_DIR / f"piece_{piece.id}"
                    if piece_dir.exists():
                        shutil.rmtree(piece_dir)
                except Exception:
                    pass
        except Exception:
            # Non-fatal: proceed to delete DB records even if file cleanup fails
            pass

        # Finally delete the ChessSet record (pieces/versions should already be gone)
        session.delete(db_set)
        session.commit()
        return True

    @staticmethod
    def update_set(session: Session, set_id: int, name: Optional[str] = None, description: Optional[str] = None) -> Optional[ChessSet]:
        db_set = session.get(ChessSet, set_id)
        if not db_set:
            return None
        if name is not None:
            db_set.name = name
        if description is not None:
            db_set.description = description
        session.add(db_set)
        session.commit()
        session.refresh(db_set)
        return db_set
