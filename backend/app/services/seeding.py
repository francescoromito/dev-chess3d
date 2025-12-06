"""
Database seeding for default chess sets.

This module loads chess sets from the seeds/ directory and imports them
into the database at first startup.
"""
import os
import json
import shutil
import uuid
from pathlib import Path
from typing import Optional, Dict, List
from sqlmodel import Session, select

from app.models import (
    ChessSet, ChessPiece, PieceVersion, PieceType,
    Collection, CollectionSet
)


# Collection name for default sets
DEFAULT_COLLECTION_NAME = "Set Base"
DEFAULT_COLLECTION_DESCRIPTION = "Collezione dei set di scacchi predefiniti inclusi nell'applicazione."

# Valid piece type prefixes (case insensitive)
VALID_PIECE_TYPES = {
    'king': PieceType.KING,
    'queen': PieceType.QUEEN,
    'rook': PieceType.ROOK,
    'bishop': PieceType.BISHOP,
    'knight': PieceType.KNIGHT,
    'pawn': PieceType.PAWN,
}

# Upload directory
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))


def get_seeds_directory() -> Path:
    """Get the path to the seeds directory."""
    # In Docker: /app/seeds
    # Local development: relative to this file
    docker_path = Path("/app/seeds")
    if docker_path.exists():
        return docker_path
    
    # Fallback: look relative to this file
    local_path = Path(__file__).parent.parent / "seeds"
    return local_path


def should_run_seeding(session: Session) -> bool:
    """
    Check if seeding should run.
    Returns True if the database has no chess sets (first run).
    """
    existing_sets = session.exec(select(ChessSet).limit(1)).first()
    return existing_sets is None


def get_or_create_base_collection(session: Session) -> Collection:
    """Get or create the 'Set Base' collection (public by default)."""
    collection = session.exec(
        select(Collection).where(Collection.name == DEFAULT_COLLECTION_NAME)
    ).first()
    
    if not collection:
        collection = Collection(
            name=DEFAULT_COLLECTION_NAME,
            description=DEFAULT_COLLECTION_DESCRIPTION,
            is_public=True
        )
        session.add(collection)
        session.commit()
        session.refresh(collection)
        print(f"  ✅ Created collection: {DEFAULT_COLLECTION_NAME}")
    
    return collection


def find_seed_sets(seeds_dir: Path) -> List[Path]:
    """
    Find all chess set directories in the seeds folder.
    Each subdirectory (except README.md) is considered a chess set.
    """
    if not seeds_dir.exists():
        return []
    
    sets = []
    for item in seeds_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            sets.append(item)
    
    return sorted(sets)


def parse_set_structure(set_path: Path) -> Dict:
    """
    Parse the folder structure of a chess set.
    
    Returns a dict with:
    {
        'name': str,
        'description': str or None,
        'pieces': {
            PieceType.KING: {
                'version_name': {
                    'description': {...},
                    'images': {'front': Path, 'back': Path, ...},
                    '3d': {'stl': Path, 'glb': Path}
                }
            },
            ...
        }
    }
    """
    set_name = set_path.name.replace('_', ' ')
    
    # Read description.txt if present
    description_file = set_path / "description.txt"
    description = None
    if description_file.exists():
        description = description_file.read_text(encoding='utf-8').strip()
    
    # Find piece folders
    pieces = {}
    for item in set_path.iterdir():
        if not item.is_dir():
            continue
        
        folder_name_lower = item.name.lower()
        piece_type = None
        
        for prefix, ptype in VALID_PIECE_TYPES.items():
            if folder_name_lower.startswith(prefix):
                piece_type = ptype
                break
        
        if not piece_type:
            continue
        
        pieces[piece_type] = parse_piece_folder(item)
    
    return {
        'name': set_name,
        'description': description,
        'pieces': pieces
    }


def parse_piece_folder(piece_path: Path) -> Dict:
    """
    Parse a piece folder to find all versions.
    Each subdirectory is a version.
    """
    versions = {}
    
    for version_folder in piece_path.iterdir():
        if not version_folder.is_dir():
            continue
        
        version_name = version_folder.name
        version_data = {
            'description': {},
            'images': {},
            '3d': {}
        }
        
        # Read description.json if present
        desc_file = version_folder / "description.json"
        if desc_file.exists():
            try:
                version_data['description'] = json.loads(desc_file.read_text(encoding='utf-8'))
                # Use version_name from description.json if present
                if 'version_name' in version_data['description']:
                    version_name = version_data['description']['version_name']
            except Exception:
                pass
        
        # Find images
        images_dir = version_folder / "images"
        if images_dir.exists():
            for img_file in images_dir.iterdir():
                if img_file.is_file():
                    name_lower = img_file.stem.lower()
                    if 'front' in name_lower:
                        version_data['images']['front'] = img_file
                    elif 'back' in name_lower:
                        version_data['images']['back'] = img_file
                    elif 'left' in name_lower:
                        version_data['images']['left'] = img_file
                    elif 'right' in name_lower:
                        version_data['images']['right'] = img_file
        
        # Find 3D models
        models_dir = version_folder / "3d"
        if models_dir.exists():
            for model_file in models_dir.iterdir():
                if model_file.is_file():
                    ext = model_file.suffix.lower()
                    if ext == '.stl':
                        version_data['3d']['stl'] = model_file
                    elif ext in ('.glb', '.gltf'):
                        version_data['3d']['glb'] = model_file
        
        versions[version_name] = version_data
    
    return versions


def copy_file_to_uploads(source_path: Path, piece_id: int, file_type: str) -> str:
    """
    Copy a file from seeds to uploads directory.
    Returns the relative path from uploads directory.
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get file extension
    ext = source_path.suffix.lower()
    
    # Create piece-specific directory
    piece_dir = UPLOAD_DIR / f"piece_{piece_id}"
    piece_dir.mkdir(exist_ok=True)
    
    # Generate unique filename with UUID to prevent conflicts
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{file_type}_{unique_id}{ext}"
    dest_path = piece_dir / filename
    
    # Copy file
    shutil.copy2(source_path, dest_path)
    
    # Return relative path from uploads directory
    return str(Path(f"piece_{piece_id}") / filename)


def import_chess_set(session: Session, set_data: Dict, collection: Collection) -> Optional[ChessSet]:
    """
    Import a chess set from parsed folder data.
    This is a synchronous version that directly copies files.
    """
    set_name = set_data['name']
    
    # Check if set already exists
    existing = session.exec(
        select(ChessSet).where(ChessSet.name == set_name)
    ).first()
    
    if existing:
        print(f"  ⏭️  Set '{set_name}' already exists, skipping...")
        return None
    
    # Create the chess set (seeded sets are public by default)
    db_set = ChessSet(
        name=set_name,
        description=set_data.get('description'),
        is_public=True
    )
    session.add(db_set)
    session.commit()
    session.refresh(db_set)
    
    # Create all 6 pieces (even if some don't have versions)
    piece_map = {}
    for piece_type in PieceType:
        piece = ChessPiece(set_id=db_set.id, type=piece_type)
        session.add(piece)
        session.commit()
        session.refresh(piece)
        piece_map[piece_type] = piece
    
    # Import versions for each piece type
    pieces_data = set_data.get('pieces', {})
    
    for piece_type, versions in pieces_data.items():
        piece = piece_map[piece_type]
        
        for version_name, version_data in versions.items():
            # Prepare file paths
            file_paths = {
                "img_front": None,
                "img_back": None,
                "img_side_r": None,
                "img_side_l": None,
                "model_glb": None,
                "model_stl": None
            }
            
            # Copy images
            images = version_data.get('images', {})
            if 'front' in images:
                file_paths['img_front'] = copy_file_to_uploads(images['front'], piece.id, 'img_front')
            if 'back' in images:
                file_paths['img_back'] = copy_file_to_uploads(images['back'], piece.id, 'img_back')
            if 'left' in images:
                file_paths['img_side_l'] = copy_file_to_uploads(images['left'], piece.id, 'img_side_l')
            if 'right' in images:
                file_paths['img_side_r'] = copy_file_to_uploads(images['right'], piece.id, 'img_side_r')
            
            # Copy 3D models
            models = version_data.get('3d', {})
            if 'stl' in models:
                file_paths['model_stl'] = copy_file_to_uploads(models['stl'], piece.id, 'model_stl')
            if 'glb' in models:
                file_paths['model_glb'] = copy_file_to_uploads(models['glb'], piece.id, 'model_glb')
            
            # Create the version directly
            db_version = PieceVersion(
                piece_id=piece.id,
                version_name=version_name,
                **file_paths
            )
            session.add(db_version)
            session.commit()
            session.refresh(db_version)
    
    # Add set to collection
    assoc = CollectionSet(collection_id=collection.id, set_id=db_set.id)
    session.add(assoc)
    session.commit()
    
    print(f"  ✅ Imported set: {set_name}")
    return db_set


def run_seeding(session: Session) -> None:
    """
    Main seeding function. Loads all chess sets from seeds/ directory.
    """
    print("🌱 Starting database seeding...")
    
    seeds_dir = get_seeds_directory()
    
    if not seeds_dir.exists():
        print(f"  ⚠️  Seeds directory not found: {seeds_dir}")
        return
    
    # Find all set directories
    set_paths = find_seed_sets(seeds_dir)
    
    if not set_paths:
        print("  ℹ️  No seed sets found")
        return
    
    print(f"  📦 Found {len(set_paths)} seed set(s)")
    
    # Get or create the base collection
    collection = get_or_create_base_collection(session)
    
    # Import each set
    for set_path in set_paths:
        try:
            set_data = parse_set_structure(set_path)
            import_chess_set(session, set_data, collection)
        except Exception as e:
            print(f"  ❌ Error importing {set_path.name}: {e}")
            import traceback
            traceback.print_exc()
    
    print("✅ Seeding completed!")


def seed_if_needed(session: Session) -> None:
    """
    Check if seeding is needed and run it.
    This is the main entry point called from main.py.
    """
    if should_run_seeding(session):
        print("📭 Database is empty, running seeding...")
        run_seeding(session)
    else:
        print("📬 Database already has data, skipping seeding")
