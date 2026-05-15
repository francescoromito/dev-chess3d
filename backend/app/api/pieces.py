"""
API endpoints for PieceVersion operations
"""
from typing import List, Optional
from fastapi import (
    APIRouter, Depends, HTTPException, status, UploadFile, File, Form
)
from sqlmodel import Session
from app.database import get_session
from app.models import (
    ChessPieceReadWithVersions, PieceVersionCreate, PieceVersionRead, PieceVersion
)
from app.services.piece_version_service import PieceVersionService
from app.services.chess_set_service import ChessSetService
import io
import zipfile
import json
from fastapi.responses import StreamingResponse
import re


router = APIRouter(prefix="/pieces", tags=["Pieces & Versions"])


@router.get("/{piece_id}", response_model=ChessPieceReadWithVersions)
def get_piece_detail(
    piece_id: int,
    session: Session = Depends(get_session)
) -> ChessPieceReadWithVersions:
    """
    Get detailed information about a specific piece including all its versions
    """
    piece = PieceVersionService.get_piece_by_id(session, piece_id)
    
    if not piece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Piece with id {piece_id} not found"
        )
    
    return ChessPieceReadWithVersions.model_validate(piece)


@router.get("/{piece_id}/download-all")
def download_all_versions_zip(piece_id: int, session: Session = Depends(get_session)):
    """
    Download all versions of a piece as a single ZIP archive.
    Each version is placed in its own folder named after the version name.
    """
    piece = PieceVersionService.get_piece_by_id(session, piece_id)
    if not piece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Piece with id {piece_id} not found"
        )
    
    if not piece.versions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This piece has no versions to download"
        )
    
    # Helper to sanitize strings for filenames
    def _sanitize(s: str, allow_spaces: bool = False) -> str:
        s = s or ''
        if not allow_spaces:
            s = s.strip().replace(' ', '_')
        else:
            s = s.strip()
        # Allow alphanumeric, underscore, dash, dot, and space if allowed
        pattern = r'[^A-Za-z0-9_\-\. ]+' if allow_spaces else r'[^A-Za-z0-9_\-\.]+'
        s = re.sub(pattern, '', s)
        return s[:200]
    
    # Prepare zip buffer
    buf = io.BytesIO()
    
    # Create ZIP filename based on piece type and chess set name
    # Format: PieceType_ChessSetName.zip (e.g. Knight_Naruto.zip)
    piece_type = piece.type.value if hasattr(piece.type, 'value') else str(piece.type)
    chess_set_name = piece.chess_set.name if piece.chess_set else "UnknownSet"
    zip_filename = f"{_sanitize(piece_type)}_{_sanitize(chess_set_name)}.zip"
    
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for version in piece.versions:
            version_name = version.version_name or f"version_{version.id}"
            # Folder name should preserve spaces
            folder_name = _sanitize(version_name, allow_spaces=True)
            
            # Create folder structure for this version
            zf.writestr(f'{folder_name}/images/', '')
            zf.writestr(f'{folder_name}/3d/', '')
            
            # Add description.json
            try:
                desc_obj = {
                    'piece_type': piece.type.value if hasattr(piece.type, 'value') else str(piece.type),
                    'piece_id': piece.id,
                    'piece_name': piece.name or None,
                    'piece_description': piece.description or None,
                    'version_id': version.id,
                    'version_name': version_name,
                    'version_created': version.created_at.isoformat() if version.created_at else '',
                }
                json_str = json.dumps(desc_obj, ensure_ascii=False, indent=2)
                zf.writestr(f'{folder_name}/description.json', json_str)
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
                        arcname = f"{folder_name}/images/{name}{ext}"
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
                    arcname = f'{folder_name}/3d/stl_model.stl'
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
                    arcname = f'{folder_name}/3d/glb_model.glb'
                    try:
                        zf.write(file_path, arcname=arcname)
                    except Exception:
                        with open(file_path, 'rb') as fh:
                            zf.writestr(arcname, fh.read())
    
    buf.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=\"{zip_filename}\""}
    return StreamingResponse(buf, media_type='application/zip', headers=headers)


@router.post(
    "/{piece_id}/versions",
    response_model=PieceVersionRead,
    status_code=status.HTTP_201_CREATED
)
async def create_piece_version(
    piece_id: int,
    version_name: str = Form(...),
    img_front: Optional[UploadFile] = File(None),
    img_back: Optional[UploadFile] = File(None),
    img_side_r: Optional[UploadFile] = File(None),
    img_side_l: Optional[UploadFile] = File(None),
    model_glb: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session)
) -> PieceVersionRead:
    """
    Create a new version for a piece with uploaded files
    
    Accepts multipart form data with:
    - version_name: Name of the version (required)
    - img_front: Front view image (optional)
    - img_back: Back view image (optional)
    - img_side_r: Right side view image (optional)
    - img_side_l: Left side view image (optional)
    - model_glb: 3D model in GLB format (optional)
    - model_stl: 3D model in STL format (optional)
    """
    version_data = PieceVersionCreate(version_name=version_name)
    
    try:
        db_version = await PieceVersionService.create_version(
            session=session,
            piece_id=piece_id,
            version_data=version_data,
            img_front=img_front,
            img_back=img_back,
            img_side_r=img_side_r,
            img_side_l=img_side_l,
            model_glb=model_glb,
        )
        
        return PieceVersionRead.model_validate(db_version)
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/versions/{version_id}/download")
def download_version_zip(version_id: int, session: Session = Depends(get_session)):
    """
    Create a ZIP archive containing all files of a specific version and return it as attachment
    """
    # Load version
    db_version = session.get(PieceVersion, version_id)
    if not db_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version with id {version_id} not found")

    # Prepare zip buffer
    buf = io.BytesIO()

    # Helper to sanitize strings for filenames
    def _sanitize(s: str) -> str:
        s = (s or '').strip().replace(' ', '_')
        # remove problematic chars, keep letters, numbers, underscore, dash and dot
        s = re.sub(r'[^A-Za-z0-9_\-\.]+', '', s)
        return s[:200]

    # Resolve piece type and version name for zip filename
    piece_type = None
    try:
        if db_version.piece is not None:
            piece_type = getattr(db_version.piece, 'type', None)
            # If enum, get value
            piece_type = piece_type.value if hasattr(piece_type, 'value') else str(piece_type)
    except Exception:
        piece_type = None

    version_name = getattr(db_version, 'version_name', None) or f"version_{version_id}"
    # Use only the version name for the ZIP filename. Do not prefix with the piece type
    # (this removes strings like 'piece_' / 'pezzo_' or 'rook_' from the generated filename).
    safe_base = _sanitize(f"{version_name}")
    zip_filename = f"{safe_base}.zip"

    # Ensure folders exist in archive
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # create directory entries for images/ and 3d/
        zf.writestr('images/', '')
        zf.writestr('3d/', '')

        # Add description.json at the root containing piece metadata and version info
        try:
            piece_name = getattr(db_version.piece, 'name', None) or ''
            piece_desc = getattr(db_version.piece, 'description', None) or ''
            piece_id = getattr(db_version.piece, 'id', None)
            version_id_attr = getattr(db_version, 'id', None)
            created_at = getattr(db_version, 'created_at', None)
            created_iso = created_at.isoformat() if created_at is not None else ''

            desc_obj = {
                'piece_type': piece_type or None,
                'piece_id': piece_id,
                'piece_name': piece_name or None,
                'piece_description': piece_desc or None,
                'version_id': version_id_attr,
                'version_name': version_name,
                'version_created': created_iso,
            }

            json_str = json.dumps(desc_obj, ensure_ascii=False, indent=2)
            zf.writestr('description.json', json_str)
        except Exception:
            # do not fail the whole ZIP creation if description fails
            pass

        # Images mapping: field -> desired name inside images/
        image_map = {
            'img_front': 'front',
            'img_back': 'back',
            'img_side_l': 'left',
            'img_side_r': 'right',
        }

        # Add images
        for field, name in image_map.items():
            rel = getattr(db_version, field)
            if rel:
                file_path = PieceVersionService.UPLOAD_DIR / rel
                if file_path.exists():
                    # preserve original extension
                    ext = ''.join(file_path.suffixes) if file_path.suffixes else ''
                    ext = ext.lower() if ext else ''
                    arcname = f"images/{name}{ext}"
                    try:
                        zf.write(file_path, arcname=arcname)
                    except Exception:
                        # fallback: read bytes and write
                        with open(file_path, 'rb') as fh:
                            zf.writestr(arcname, fh.read())

        # Add 3D models with fixed names
        # STL
        rel_stl = getattr(db_version, 'model_stl')
        if rel_stl:
            file_path = PieceVersionService.UPLOAD_DIR / rel_stl
            if file_path.exists():
                arcname = '3d/stl_model.stl'
                try:
                    zf.write(file_path, arcname=arcname)
                except Exception:
                    with open(file_path, 'rb') as fh:
                        zf.writestr(arcname, fh.read())

        # GLB
        rel_glb = getattr(db_version, 'model_glb')
        if rel_glb:
            file_path = PieceVersionService.UPLOAD_DIR / rel_glb
            if file_path.exists():
                arcname = '3d/glb_model.glb'
                try:
                    zf.write(file_path, arcname=arcname)
                except Exception:
                    with open(file_path, 'rb') as fh:
                        zf.writestr(arcname, fh.read())

    buf.seek(0)

    headers = {"Content-Disposition": f"attachment; filename=\"{zip_filename}\""}

    return StreamingResponse(buf, media_type='application/zip', headers=headers)

@router.get("/versions/{version_id}/download-as-stl")
def download_version_as_stl(version_id: int, session: Session = Depends(get_session)):
    """
    Convert the GLB model of a version to STL and stream it back.
    The conversion preserves the original geometry (same dimensions as the GLB).
    """
    db_version = session.get(PieceVersion, version_id)
    if not db_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version with id {version_id} not found")

    rel_glb = getattr(db_version, 'model_glb', None)
    if not rel_glb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No GLB model found for this version")

    glb_path = PieceVersionService.UPLOAD_DIR / rel_glb
    if not glb_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GLB file not found on disk")

    try:
        import trimesh
        loaded = trimesh.load(str(glb_path), force='scene')
        # If it is a Scene (multi-mesh GLB), concatenate all geometries into one mesh
        if isinstance(loaded, trimesh.Scene):
            geometries = list(loaded.geometry.values())
            if not geometries:
                raise ValueError("GLB scene contains no meshes")
            if len(geometries) == 1:
                mesh = geometries[0]
            else:
                mesh = trimesh.util.concatenate(geometries)
        else:
            mesh = loaded

        # Scale from mm (internal units) to cm: multiply all coordinates by 10
        mesh.apply_scale(10.0)

        # Rotate 90 degrees around X axis before export
        import numpy as np
        rot = trimesh.transformations.rotation_matrix(np.radians(90), [1, 0, 0])
        mesh.apply_transform(rot)

        stl_bytes = mesh.export(file_type='stl')
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"STL conversion failed: {exc}")

    version_name = getattr(db_version, 'version_name', None) or f"version_{version_id}"
    safe_name = re.sub(r'[^A-Za-z0-9_\-\.]+', '_', version_name.strip())[:200]
    filename = f"{safe_name}.stl"

    return StreamingResponse(
        io.BytesIO(stl_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_piece_version(version_id: int, session: Session = Depends(get_session)):
    """Delete a piece version and its files"""
    success = PieceVersionService.delete_version(session, version_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version with id {version_id} not found")
    return None

@router.delete("/versions/{version_id}/file")
def delete_version_file(version_id: int, field: str, session: Session = Depends(get_session)) -> PieceVersionRead:
    """Remove a single file from a version (query param 'field' required)"""
    try:
        db_version = PieceVersionService.remove_file(session, version_id, field)
        if not db_version:
            raise ValueError(f"Version with id {version_id} not found")
        return PieceVersionRead.model_validate(db_version)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{piece_id}", response_model=ChessPieceReadWithVersions)
def update_piece(
    piece_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    session: Session = Depends(get_session)
) -> ChessPieceReadWithVersions:
    """Update a chess piece's name/description"""
    piece = session.get(ChessPieceReadWithVersions.__args__[0].__mro__[1], piece_id) if False else None
    # simpler: load model directly
    from app.models import ChessPiece
    db_piece = session.get(ChessPiece, piece_id)
    if not db_piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Piece with id {piece_id} not found")
    if name is not None:
        db_piece.name = name
    if description is not None:
        db_piece.description = description
    session.add(db_piece)
    session.commit()
    session.refresh(db_piece)
    return ChessPieceReadWithVersions.model_validate(db_piece)


@router.get("/{piece_id}/versions", response_model=List[PieceVersionRead])
def get_piece_versions(
    piece_id: int,
    session: Session = Depends(get_session)
) -> List[PieceVersionRead]:
    """
    Get all versions for a specific piece
    """
    versions = PieceVersionService.get_piece_versions(session, piece_id)
    return [PieceVersionRead.model_validate(v) for v in versions]


@router.patch("/versions/{version_id}", response_model=PieceVersionRead)
async def patch_piece_version(
    version_id: int,
    version_name: Optional[str] = Form(None),
    version_description: Optional[str] = Form(None),
    session: Session = Depends(get_session)
) -> PieceVersionRead:
    """
    Update version name and/or description
    """
    try:
        db_version = session.get(PieceVersion, version_id)
        if not db_version:
            raise ValueError(f"Version with id {version_id} not found")
        
        if version_name is not None:
            db_version.version_name = version_name
        if version_description is not None:
            db_version.version_description = version_description
        
        session.add(db_version)
        session.commit()
        session.refresh(db_version)
        
        return PieceVersionRead.model_validate(db_version)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/versions/{version_id}", response_model=PieceVersionRead)
async def update_piece_version(
    version_id: int,
    version_name: Optional[str] = Form(None),
    img_front: Optional[UploadFile] = File(None),
    img_back: Optional[UploadFile] = File(None),
    img_side_r: Optional[UploadFile] = File(None),
    img_side_l: Optional[UploadFile] = File(None),
    model_glb: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session)
) -> PieceVersionRead:
    """
    Update an existing piece version with new files or name
    
    Accepts multipart form data with:
    - version_name: New name for the version (optional)
    - img_front: New front view image (optional)
    - img_back: New back view image (optional)
    - img_side_r: New right side view image (optional)
    - img_side_l: New left side view image (optional)
    - model_glb: New 3D model in GLB format (optional)
    - model_stl: New 3D model in STL format (optional)
    """
    try:
        db_version = await PieceVersionService.update_version(
            session=session,
            version_id=version_id,
            version_name=version_name,
            img_front=img_front,
            img_back=img_back,
            img_side_r=img_side_r,
            img_side_l=img_side_l,
            model_glb=model_glb,
        )
        
        return PieceVersionRead.model_validate(db_version)
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/versions/{version_id}/favorite", response_model=PieceVersionRead)
def set_version_as_favorite(
    version_id: int,
    session: Session = Depends(get_session)
) -> PieceVersionRead:
    """
    Set a version as the favorite for its piece.
    This will unset any other favorite version for the same piece.
    """
    try:
        db_version = PieceVersionService.set_favorite(session, version_id)
        return PieceVersionRead.model_validate(db_version)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/{piece_id}/versions/import",
    response_model=PieceVersionRead,
    status_code=status.HTTP_201_CREATED
)
async def import_version_from_zip(
    piece_id: int,
    zip_file: UploadFile = File(...),
    custom_version_name: Optional[str] = Form(None),
    session: Session = Depends(get_session)
) -> PieceVersionRead:
    """
    Import a new version for a piece from a ZIP archive.
    
    The ZIP should have the same structure as the exported ZIP:
    - description.json (optional, contains version_name)
    - images/ folder with front, back, left, right images
    - 3d/ folder with stl_model.stl and/or glb_model.glb
    
    If custom_version_name is provided, it will be used instead of the name from description.json.
    Returns 409 Conflict if a version with the same name already exists.
    """
    # Verify piece exists
    piece = PieceVersionService.get_piece_by_id(session, piece_id)
    if not piece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Piece with id {piece_id} not found"
        )
    
    try:
        # Read the uploaded ZIP file
        zip_content = await zip_file.read()
        zip_buffer = io.BytesIO(zip_content)
        
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            # Parse description.json if present
            version_name = custom_version_name or f"Imported_{piece_id}"
            original_name_from_zip = None
            
            if not custom_version_name:
                try:
                    if 'description.json' in zf.namelist():
                        desc_content = zf.read('description.json').decode('utf-8')
                        desc_data = json.loads(desc_content)
                        version_name = desc_data.get('version_name', version_name)
                        original_name_from_zip = version_name
                except Exception:
                    pass  # Use default version name
            
            # Check for duplicate version name
            existing_names = [v.version_name for v in piece.versions] if piece.versions else []
            if version_name in existing_names:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "A version with this name already exists",
                        "existing_name": version_name,
                        "suggested_name": f"{version_name} 2"
                    }
                )
            
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
            
            for name in zf.namelist():
                # Skip directories
                if name.endswith('/'):
                    continue
                
                content = zf.read(name)
                lower_name = name.lower()
                
                # Handle images
                if lower_name.startswith('images/'):
                    for pattern, field in image_patterns.items():
                        if pattern in lower_name:
                            # Create an UploadFile-like object
                            file_obj = io.BytesIO(content)
                            ext = name.split('.')[-1] if '.' in name else 'jpg'
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
                elif lower_name.startswith('3d/'):
                    file_obj = io.BytesIO(content)
                    if lower_name.endswith('.stl'):
                        model_stl = UploadFile(
                            filename="model.stl",
                            file=file_obj
                        )
                    elif lower_name.endswith('.glb') or lower_name.endswith('.gltf'):
                        model_glb = UploadFile(
                            filename="model.glb",
                            file=file_obj
                        )
            
            # Create the version
            version_data = PieceVersionCreate(version_name=version_name)
            db_version = await PieceVersionService.create_version(
                session=session,
                piece_id=piece_id,
                version_data=version_data,
                img_front=img_front,
                img_back=img_back,
                img_side_r=img_side_r,
                img_side_l=img_side_l,
                model_glb=model_glb,
            )
            
            return PieceVersionRead.model_validate(db_version)
    
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ZIP file"
        )
    except HTTPException:
        raise  # Re-raise HTTP exceptions (like 409 Conflict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing version: {str(e)}"
        )
