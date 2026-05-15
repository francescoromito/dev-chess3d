"""
API endpoints for ChessSet operations
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse, FileResponse
from starlette.background import BackgroundTask
import time
import tempfile
import logging
from sqlmodel import Session, select
from app.database import get_session
from app.models import (
    ChessSetCreate, ChessSetRead, ChessSetReadWithPieces, ChessSet, ChessPiece, PieceType, PieceVersion, PieceVersionCreate
)
from app.services.chess_set_service import ChessSetService
from app.services.piece_version_service import PieceVersionService
import io
import zipfile
import json
import re
import os


router = APIRouter(prefix="/sets", tags=["Chess Sets"])

logger = logging.getLogger(__name__)


@router.post(
    "",
    response_model=ChessSetReadWithPieces,
    status_code=status.HTTP_201_CREATED
)
def create_chess_set(
    set_data: ChessSetCreate,
    session: Session = Depends(get_session)
) -> ChessSetReadWithPieces:
    """
    Create a new chess set with all 6 standard piece types
    """
    db_set = ChessSetService.create_set(session, set_data)
    return ChessSetReadWithPieces.model_validate(db_set)


@router.get("", response_model=List[ChessSetReadWithPieces])
def get_all_sets(
    session: Session = Depends(get_session)
) -> List[ChessSetReadWithPieces]:
    """
    Get all chess sets with their pieces
    """
    sets = ChessSetService.get_all_sets(session)
    return [ChessSetReadWithPieces.model_validate(s) for s in sets]


@router.get("/{set_id}", response_model=ChessSetReadWithPieces)
def get_set_detail(
    set_id: int,
    session: Session = Depends(get_session)
) -> ChessSetReadWithPieces:
    """
    Get detailed information about a specific chess set including its pieces
    """
    db_set = ChessSetService.get_set_by_id(session, set_id)
    
    if not db_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chess set with id {set_id} not found"
        )
    
    return ChessSetReadWithPieces.model_validate(db_set)


@router.post("/{set_id}/duplicate", response_model=ChessSetReadWithPieces)
def duplicate_chess_set(
    set_id: int,
    session: Session = Depends(get_session)
) -> ChessSetReadWithPieces:
    """
    Duplicate a chess set and all its pieces
    """
    db_set = ChessSetService.duplicate_set(session, set_id)
    
    if not db_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chess set with id {set_id} not found"
        )
    
    return ChessSetReadWithPieces.model_validate(db_set)


@router.patch("/{set_id}", response_model=ChessSetReadWithPieces)
def update_set(
    set_id: int,
    set_data: ChessSetCreate,
    session: Session = Depends(get_session)
) -> ChessSetReadWithPieces:
    """Update name/description of a chess set"""
    db_set = ChessSetService.update_set(session, set_id, name=set_data.name, description=set_data.description)
    if not db_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chess set with id {set_id} not found")
    return ChessSetReadWithPieces.model_validate(db_set)


@router.delete("/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chess_set(
    set_id: int,
    session: Session = Depends(get_session)
) -> None:
    """
    Delete a chess set and all its pieces
    """
    db_set = ChessSetService.get_set_by_id(session, set_id)
    if not db_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chess set with id {set_id} not found"
        )
    if db_set.is_seeded:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="I set base non possono essere eliminati"
        )
    success = ChessSetService.delete_set(session, set_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chess set with id {set_id} not found"
        )


@router.get("/{set_id}/download")
def download_chess_set_zip(set_id: int, session: Session = Depends(get_session)):
    """
    Download the entire chess set as a ZIP archive.
    Contains 6 folders (one per piece type), each with subfolders for each version.
    Folder naming: PieceType_ChessSetName (e.g. Knight_Naruto)
    """
    db_set = ChessSetService.get_set_by_id(session, set_id)
    if not db_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chess set with id {set_id} not found"
        )
    
    # Helper to sanitize strings for filenames
    def _sanitize(s: str, allow_spaces: bool = False) -> str:
        s = s or ''
        if not allow_spaces:
            s = s.strip().replace(' ', '_')
        else:
            s = s.strip()
        pattern = r'[^A-Za-z0-9_\-\. ]+' if allow_spaces else r'[^A-Za-z0-9_\-\.]+'
        s = re.sub(pattern, '', s)
        return s[:200]
    
    # Prepare temp file and record start time for timing
    start_time = time.time()
    set_name = db_set.name or f"set_{set_id}"
    zip_filename = f"{_sanitize(set_name)}.zip"
    
    fd, temp_file_path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    
    # Use ZIP_STORED to avoid CPU bottleneck and temp file to avoid RAM bottleneck
    with zipfile.ZipFile(temp_file_path, 'w', zipfile.ZIP_STORED) as zf:
        # Add description.txt at the root with the chess set description
        description_content = db_set.description or ""
        zf.writestr('description.txt', description_content)
        
        for piece in db_set.pieces:
            piece_type = piece.type.value if hasattr(piece.type, 'value') else str(piece.type)
            # Folder name: PieceType_ChessSetName (e.g. Knight_Naruto)
            piece_folder = f"{_sanitize(piece_type)}_{_sanitize(set_name)}"
            
            if not piece.versions:
                # Create empty folder structure
                zf.writestr(f'{piece_folder}/', '')
                continue
            
            for version in piece.versions:
                version_name = version.version_name or f"version_{version.id}"
                # Version subfolder preserves spaces
                version_folder = f"{piece_folder}/{_sanitize(version_name, allow_spaces=True)}"
                
                # Create folder structure
                zf.writestr(f'{version_folder}/images/', '')
                zf.writestr(f'{version_folder}/3d/', '')
                
                # Add description.json
                try:
                    desc_obj = {
                        'piece_type': piece_type,
                        'piece_id': piece.id,
                        'piece_name': piece.name or None,
                        'piece_description': piece.description or None,
                        'version_id': version.id,
                        'version_name': version_name,
                        'version_created': version.created_at.isoformat() if version.created_at else '',
                        'chess_set_name': set_name,
                        'chess_set_id': db_set.id,
                    }
                    json_str = json.dumps(desc_obj, ensure_ascii=False, indent=2)
                    zf.writestr(f'{version_folder}/description.json', json_str)
                except Exception:
                    pass
                
                # Images mapping
                image_map = {
                    'img_front': 'front',
                    'img_back': 'back',
                    'img_side_l': 'left',
                    'img_side_r': 'right',
                }
                
                # Add images
                for field, name in image_map.items():
                    rel = getattr(version, field, None)
                    if rel:
                        file_path = PieceVersionService.UPLOAD_DIR / rel
                        if file_path.exists():
                            ext = ''.join(file_path.suffixes).lower() if file_path.suffixes else ''
                            arcname = f"{version_folder}/images/{name}{ext}"
                            try:
                                zf.write(file_path, arcname=arcname)
                            except Exception:
                                with open(file_path, 'rb') as fh:
                                    zf.writestr(arcname, fh.read())
                
                # Add STL model
                rel_stl = getattr(version, 'model_stl', None)
                if rel_stl:
                    file_path = PieceVersionService.UPLOAD_DIR / rel_stl
                    if file_path.exists():
                        arcname = f'{version_folder}/3d/stl_model.stl'
                        try:
                            zf.write(file_path, arcname=arcname)
                        except Exception:
                            with open(file_path, 'rb') as fh:
                                zf.writestr(arcname, fh.read())
                
                # Add GLB model
                rel_glb = getattr(version, 'model_glb', None)
                if rel_glb:
                    file_path = PieceVersionService.UPLOAD_DIR / rel_glb
                    if file_path.exists():
                        arcname = f'{version_folder}/3d/glb_model.glb'
                        try:
                            zf.write(file_path, arcname=arcname)
                        except Exception:
                            with open(file_path, 'rb') as fh:
                                zf.writestr(arcname, fh.read())
    
    # Ensure temporary file is cleaned up after sending
    def cleanup_temp_file():
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        except Exception as e:
            logger.error(f"Failed to remove temp file {temp_file_path}: {e}")

    try:
        size = os.path.getsize(temp_file_path)
    except Exception:
        size = None

    try:
        duration = time.time() - start_time
    except Exception:
        duration = 0

    if size is not None:
        logger.info(f"Built ZIP for set_id={set_id} size={size} bytes in {duration:.2f}s")
        headers = {
            "Content-Disposition": f"attachment; filename=\"{zip_filename}\"",
            "Content-Length": str(size)
        }
    else:
        logger.info(f"Built ZIP for set_id={set_id} (size unknown) in {duration:.2f}s")
        headers = {"Content-Disposition": f"attachment; filename=\"{zip_filename}\""}

    return FileResponse(
        path=temp_file_path,
        media_type='application/zip',
        headers=headers,
        background=BackgroundTask(cleanup_temp_file)
    )


@router.post(
    "/import",
    response_model=ChessSetReadWithPieces,
    status_code=status.HTTP_201_CREATED
)
async def import_chess_set_from_zip(
    zip_file: UploadFile = File(...),
    custom_set_name: Optional[str] = Form(None),
    session: Session = Depends(get_session)
) -> ChessSetReadWithPieces:
    """
    Import a chess set from a ZIP archive.
    
    Expected ZIP structure (6 folders, one per piece type):
    - King_ChessSetName/
      - VersionName/
        - description.json
        - images/ (front, back, left, right)
        - 3d/ (stl_model.stl, glb_model.glb)
    - Queen_ChessSetName/
    - Rook_ChessSetName/
    - Bishop_ChessSetName/
    - Knight_ChessSetName/
    - Pawn_ChessSetName/
    
    If custom_set_name is provided, it will be used instead of the ZIP filename.
    Returns 409 Conflict if a chess set with the same name already exists.
    """
    # Valid piece type prefixes (case insensitive)
    VALID_PIECE_TYPES = {
        'king': PieceType.KING,
        'queen': PieceType.QUEEN,
        'rook': PieceType.ROOK,
        'bishop': PieceType.BISHOP,
        'knight': PieceType.KNIGHT,
        'pawn': PieceType.PAWN,
    }
    
    try:
        # Determine chess set name from ZIP filename or custom name
        if custom_set_name:
            set_name = custom_set_name
        else:
            # Extract name from filename (remove .zip extension)
            original_filename = zip_file.filename or "Imported Set"
            set_name = os.path.splitext(original_filename)[0]
            # Clean up underscores to spaces for display
            set_name = set_name.replace('_', ' ')
        
        # Check for duplicate set name
        existing_sets = session.exec(select(ChessSet)).all()
        existing_names = [s.name for s in existing_sets]
        if set_name in existing_names:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "A chess set with this name already exists",
                    "existing_name": set_name,
                    "suggested_name": f"{set_name} 2"
                }
            )
        
        # Read the uploaded ZIP file
        zip_content = await zip_file.read()
        zip_buffer = io.BytesIO(zip_content)
        
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            namelist = zf.namelist()
            
            # Parse folder structure
            # Each entry like: "King_Naruto/Version Name/images/front.png"
            # First level folders should be piece type folders
            top_folders = set()
            for name in namelist:
                parts = name.split('/')
                if len(parts) > 1 and parts[0]:
                    top_folders.add(parts[0])
            
            # Validate: must have folders starting with valid piece type names
            found_piece_types = {}
            for folder in top_folders:
                folder_lower = folder.lower()
                for piece_prefix, piece_type in VALID_PIECE_TYPES.items():
                    if folder_lower.startswith(piece_prefix):
                        found_piece_types[folder] = piece_type
                        break
            
            if len(found_piece_types) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Invalid ZIP structure. No valid piece type folders found.",
                        "expected": "Folders starting with: King, Queen, Rook, Bishop, Knight, Pawn",
                        "found": list(top_folders)
                    }
                )
            
            # Read description from root description.txt if present
            set_description = None
            if 'description.txt' in namelist:
                try:
                    set_description = zf.read('description.txt').decode('utf-8').strip()
                except Exception:
                    pass
            
            # Create the chess set
            db_set = ChessSet(name=set_name, description=set_description)
            session.add(db_set)
            session.commit()
            session.refresh(db_set)
            
            # Create all 6 pieces (even if some don't have versions in the ZIP)
            piece_map = {}  # piece_type -> ChessPiece
            for piece_type in PieceType:
                piece = ChessPiece(set_id=db_set.id, type=piece_type)
                session.add(piece)
                session.commit()
                session.refresh(piece)
                piece_map[piece_type] = piece
            
            # Parse versions from ZIP structure
            # Structure: PieceFolder/VersionFolder/files...
            version_files = {}  # (piece_folder, version_folder) -> {file_type: content}
            
            for name in namelist:
                if name.endswith('/'):
                    continue  # Skip directories
                
                parts = name.split('/')
                if len(parts) < 3:
                    continue  # Need at least piece_folder/version_folder/file
                
                piece_folder = parts[0]
                version_folder = parts[1]
                relative_path = '/'.join(parts[2:])
                
                if piece_folder not in found_piece_types:
                    continue
                
                key = (piece_folder, version_folder)
                if key not in version_files:
                    version_files[key] = {}
                
                content = zf.read(name)
                version_files[key][relative_path.lower()] = content
            
            # Create versions for each piece
            for (piece_folder, version_folder), files in version_files.items():
                piece_type = found_piece_types[piece_folder]
                piece = piece_map[piece_type]
                
                # Determine version name from description.json or folder name
                version_name = version_folder
                if 'description.json' in files:
                    try:
                        desc_data = json.loads(files['description.json'].decode('utf-8'))
                        version_name = desc_data.get('version_name', version_folder)
                    except Exception:
                        pass
                
                # Prepare file uploads
                img_front = None
                img_back = None
                img_side_r = None
                img_side_l = None
                model_glb = None
                model_stl = None
                
                # Map of expected filenames to their field
                image_patterns = {
                    'front': 'img_front',
                    'back': 'img_back',
                    'left': 'img_side_l',
                    'right': 'img_side_r',
                }
                
                for file_path, content in files.items():
                    # Handle images
                    if file_path.startswith('images/'):
                        for pattern, field in image_patterns.items():
                            if pattern in file_path:
                                file_obj = io.BytesIO(content)
                                ext = file_path.split('.')[-1] if '.' in file_path else 'jpg'
                                upload = UploadFile(
                                    filename=f"{field}.{ext}",
                                    file=file_obj
                                )
                                if field == 'img_front':
                                    img_front = upload
                                elif field == 'img_back':
                                    img_back = upload
                                elif field == 'img_side_l':
                                    img_side_l = upload
                                elif field == 'img_side_r':
                                    img_side_r = upload
                                break
                    
                    # Handle 3D models
                    elif file_path.startswith('3d/'):
                        file_obj = io.BytesIO(content)
                        if file_path.endswith('.stl'):
                            model_stl = UploadFile(
                                filename="model.stl",
                                file=file_obj
                            )
                        elif file_path.endswith('.glb') or file_path.endswith('.gltf'):
                            model_glb = UploadFile(
                                filename="model.glb",
                                file=file_obj
                            )
                
                # Create the version
                version_data = PieceVersionCreate(version_name=version_name)
                db_version = await PieceVersionService.create_version(
                    session=session,
                    piece_id=piece.id,
                    version_data=version_data,
                    img_front=img_front,
                    img_back=img_back,
                    img_side_r=img_side_r,
                    img_side_l=img_side_l,
                    model_glb=model_glb,
                    model_stl=model_stl
                )
            
            session.refresh(db_set)
            return ChessSetReadWithPieces.model_validate(db_set)
    
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ZIP file"
        )
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing chess set: {str(e)}"
        )
