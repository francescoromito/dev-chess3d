"""
Admin endpoints (e.g. reset database to factory state)
"""
import shutil
import os
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, delete as sql_delete

from app.database import get_session, engine
from app.models import ChessSet, ChessPiece, PieceVersion, Collection, CollectionSet
from app.services.seeding import run_seeding

router = APIRouter(prefix="/admin", tags=["Admin"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))


@router.post("/reset-db", status_code=200)
def reset_db(session: Session = Depends(get_session)):
    """
    Delete ALL data (sets, pieces, versions, collections) and re-run seeding.
    Clears the uploads directory as well.
    """
    # Delete in correct order to respect FK constraints
    session.exec(sql_delete(CollectionSet))
    session.exec(sql_delete(PieceVersion))
    session.exec(sql_delete(ChessPiece))
    session.exec(sql_delete(ChessSet))
    session.exec(sql_delete(Collection))
    session.commit()

    # Clear uploads directory
    if UPLOAD_DIR.exists():
        for item in UPLOAD_DIR.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink(missing_ok=True)

    # Re-run seeding
    run_seeding(session)

    return {"message": "Database reset and seeded successfully"}
