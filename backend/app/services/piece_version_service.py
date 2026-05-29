"""
Business logic for PieceVersion operations and file handling
"""
import os
import shutil
import uuid
from typing import Optional, Dict
from pathlib import Path
from fastapi import UploadFile
from sqlmodel import Session, select
from app.models import (
    ChessPiece, PieceVersion, PieceVersionCreate, PieceVersionRead
)


class PieceVersionService:
    """Service layer for PieceVersion operations"""
    
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    ALLOWED_MODEL_EXTENSIONS = {".glb", ".stl"}
    
    @staticmethod
    def _ensure_upload_dir() -> None:
        """Ensure upload directory exists"""
        PieceVersionService.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def _save_file(file: UploadFile, piece_id: int, file_type: str) -> str:
        """
        Save uploaded file to disk and return relative path.
        Uses UUID to ensure unique filenames and prevent conflicts.
        """
        PieceVersionService._ensure_upload_dir()
        
        # Get file extension
        ext = Path(file.filename).suffix.lower()
        
        # Create piece-specific directory
        piece_dir = PieceVersionService.UPLOAD_DIR / f"piece_{piece_id}"
        piece_dir.mkdir(exist_ok=True)
        
        # Generate unique filename with UUID to prevent conflicts
        unique_id = uuid.uuid4().hex[:8]
        filename = f"{file_type}_{unique_id}{ext}"
        file_path = piece_dir / filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Return relative path from uploads directory
        return str(Path(f"piece_{piece_id}") / filename)
    
    @staticmethod
    async def create_version(
        session: Session,
        piece_id: int,
        version_data: PieceVersionCreate,
        img_front: Optional[UploadFile] = None,
        img_back: Optional[UploadFile] = None,
        img_side_r: Optional[UploadFile] = None,
        img_side_l: Optional[UploadFile] = None,
        model_glb: Optional[UploadFile] = None,
    ) -> PieceVersion:
        """
        Create a new piece version with uploaded files
        """
        # Verify piece exists
        piece = session.get(ChessPiece, piece_id)
        if not piece:
            raise ValueError(f"Piece with id {piece_id} not found")
        
        # Prepare file paths
        file_paths: Dict[str, Optional[str]] = {
            "img_front": None,
            "img_back": None,
            "img_side_r": None,
            "img_side_l": None,
            "model_glb": None,
            "model_stl": None
        }
        
        # Save uploaded files
        if img_front:
            file_paths["img_front"] = PieceVersionService._save_file(
                img_front, piece_id, "img_front"
            )
        
        if img_back:
            file_paths["img_back"] = PieceVersionService._save_file(
                img_back, piece_id, "img_back"
            )
        
        if img_side_r:
            file_paths["img_side_r"] = PieceVersionService._save_file(
                img_side_r, piece_id, "img_side_r"
            )
        
        if img_side_l:
            file_paths["img_side_l"] = PieceVersionService._save_file(
                img_side_l, piece_id, "img_side_l"
            )
        
        if model_glb:
            file_paths["model_glb"] = PieceVersionService._save_file(
                model_glb, piece_id, "model_glb"
            )
        
        # Create the version DB object with all file paths
        db_version = PieceVersion(
            piece_id=piece_id,
            version_name=version_data.version_name,
            img_front=file_paths["img_front"],
            img_back=file_paths["img_back"],
            img_side_r=file_paths["img_side_r"],
            img_side_l=file_paths["img_side_l"],
            model_glb=file_paths["model_glb"],
        )

        session.add(db_version)
        session.commit()
        session.refresh(db_version)
        
        return db_version
    
    @staticmethod
    def get_piece_versions(session: Session, piece_id: int) -> list[PieceVersion]:
        """Get all versions for a specific piece"""
        statement = select(PieceVersion).where(
            PieceVersion.piece_id == piece_id
        ).order_by(PieceVersion.created_at.desc())
        
        results = session.exec(statement)
        return list(results.all())
    
    @staticmethod
    def get_piece_by_id(session: Session, piece_id: int) -> Optional[ChessPiece]:
        """Get a specific piece by ID"""
        return session.get(ChessPiece, piece_id)

    @staticmethod
    async def update_version(
        session: Session,
        version_id: int,
        version_name: Optional[str] = None,
        img_front: Optional[UploadFile] = None,
        img_back: Optional[UploadFile] = None,
        img_side_r: Optional[UploadFile] = None,
        img_side_l: Optional[UploadFile] = None,
        model_glb: Optional[UploadFile] = None,
    ) -> PieceVersion:
        """
        Update an existing piece version with new files or name
        """
        # Get existing version
        db_version = session.get(PieceVersion, version_id)
        if not db_version:
            raise ValueError(f"Version with id {version_id} not found")
        
        # Update version name if provided
        if version_name is not None:
            db_version.version_name = version_name
        
        # Update files if provided
        if img_front:
            # Delete old file if exists
            if db_version.img_front:
                old_path = PieceVersionService.UPLOAD_DIR / db_version.img_front
                if old_path.exists():
                    old_path.unlink()
            db_version.img_front = PieceVersionService._save_file(
                img_front, db_version.piece_id, "img_front"
            )
        
        if img_back:
            if db_version.img_back:
                old_path = PieceVersionService.UPLOAD_DIR / db_version.img_back
                if old_path.exists():
                    old_path.unlink()
            db_version.img_back = PieceVersionService._save_file(
                img_back, db_version.piece_id, "img_back"
            )
        
        if img_side_r:
            if db_version.img_side_r:
                old_path = PieceVersionService.UPLOAD_DIR / db_version.img_side_r
                if old_path.exists():
                    old_path.unlink()
            db_version.img_side_r = PieceVersionService._save_file(
                img_side_r, db_version.piece_id, "img_side_r"
            )
        
        if img_side_l:
            if db_version.img_side_l:
                old_path = PieceVersionService.UPLOAD_DIR / db_version.img_side_l
                if old_path.exists():
                    old_path.unlink()
            db_version.img_side_l = PieceVersionService._save_file(
                img_side_l, db_version.piece_id, "img_side_l"
            )
        
        if model_glb:
            if db_version.model_glb:
                old_path = PieceVersionService.UPLOAD_DIR / db_version.model_glb
                if old_path.exists():
                    old_path.unlink()
            db_version.model_glb = PieceVersionService._save_file(
                model_glb, db_version.piece_id, "model_glb"
            )
        
        
        session.add(db_version)
        session.commit()
        session.refresh(db_version)
        
        return db_version

    @staticmethod
    def set_favorite(session: Session, version_id: int) -> PieceVersion:
        """
        Set a version as the favorite for its piece.
        This will unset any other favorite version for the same piece.
        """
        # Get the version
        db_version = session.get(PieceVersion, version_id)
        if not db_version:
            raise ValueError(f"Version with id {version_id} not found")
        
        # Unset all other favorites for this piece
        statement = select(PieceVersion).where(
            PieceVersion.piece_id == db_version.piece_id,
            PieceVersion.is_favorite == True
        )
        other_favorites = session.exec(statement).all()
        for v in other_favorites:
            v.is_favorite = False
            session.add(v)
        
        # Set this version as favorite
        db_version.is_favorite = True
        session.add(db_version)
        session.commit()
        session.refresh(db_version)
        
        return db_version

    @staticmethod
    def delete_version(session: Session, version_id: int) -> bool:
        """Delete a piece version and all its files from disk"""
        db_version = session.get(PieceVersion, version_id)
        if not db_version:
            return False

        # delete associated files on disk
        file_fields = ['img_front', 'img_back', 'img_side_r', 'img_side_l', 'model_glb', ]
        for field in file_fields:
            val = getattr(db_version, field)
            if val:
                path = PieceVersionService.UPLOAD_DIR / val
                if path.exists():
                    try:
                        path.unlink()
                    except Exception:
                        pass

        # delete DB record
        session.delete(db_version)
        session.commit()
        return True

    @staticmethod
    def remove_file(session: Session, version_id: int, field_name: str) -> Optional[PieceVersion]:
        """Remove a single file (image/model) from a version and delete file from disk"""
        db_version = session.get(PieceVersion, version_id)
        if not db_version:
            return None

        allowed = {'img_front', 'img_back', 'img_side_r', 'img_side_l', 'model_glb', }
        if field_name not in allowed:
            raise ValueError(f"Invalid field name {field_name}")

        current = getattr(db_version, field_name)
        if current:
            path = PieceVersionService.UPLOAD_DIR / current
            if path.exists():
                try:
                    path.unlink()
                except Exception:
                    pass
            setattr(db_version, field_name, None)
            session.add(db_version)
            session.commit()
            session.refresh(db_version)

        return db_version
