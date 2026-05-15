"""
AI Generation API — Mock implementation
Real calls to fal.ai/nano-banana-2 will replace the picsum stubs later.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import time
import hashlib
import os
from pathlib import Path

import httpx
from sqlmodel import Session

from app.database import get_session
from app.models import PieceVersion, PieceVersionRead

router = APIRouter(prefix="/ai", tags=["AI Generation"])

# ---------------------------------------------------------------------------
# In-memory stores (replaced by DB rows when real async jobs are wired up)
# ---------------------------------------------------------------------------
_staging: Dict[str, Dict[str, Any]] = {}
_jobs: Dict[str, Dict[str, Any]] = {}
_job_polls: Dict[str, int] = {}

# Public sample GLB for 3D mock
SAMPLE_GLB_URL = (
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/"
    "main/2.0/Box/glTF-Binary/Box.glb"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _picsum_url(seed: str, width: int = 512, height: int = 512) -> str:
    """Deterministic picsum URL derived from a seed string."""
    seed_int = int(hashlib.md5(seed.encode()).hexdigest(), 16) % 1000
    return f"https://picsum.photos/seed/{seed_int}/{width}/{height}"


def _make_staged(preview_url: str, source: str, **extra) -> Dict[str, Any]:
    staged_id = str(uuid.uuid4())
    entry = {"id": staged_id, "preview_url": preview_url, "source": source, **extra}
    _staging[staged_id] = entry
    return entry


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class GenerateImageRequest(BaseModel):
    prompt: str
    style_preset: Optional[str] = None
    piece_type: Optional[str] = None


class EditImageRequest(BaseModel):
    staged_id: Optional[str] = None
    source_url: Optional[str] = None
    prompt: str


class GenerateViewRequest(BaseModel):
    """Generate a rotated view from an existing (staged or saved) image."""
    angle: str                        # back | left | right
    staged_id: Optional[str] = None  # use a staged front image
    source_url: Optional[str] = None # use an already-saved front image URL


class Generate3DRequest(BaseModel):
    image_urls: list[str]             # 1-4 reference image URLs


class ConfirmStagedRequest(BaseModel):
    version_id: int
    field_name: str  # img_front | img_back | img_side_r | img_side_l | model_glb


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/generate-image")
async def generate_image(body: GenerateImageRequest):
    """Mock: text → image. Returns a staged preview URL."""
    seed = f"{body.prompt}|{body.style_preset or ''}|{body.piece_type or ''}"
    preview_url = _picsum_url(seed)
    entry = _make_staged(
        preview_url,
        source="text_to_image",
        prompt=body.prompt,
        style_preset=body.style_preset,
    )
    return {"id": entry["id"], "preview_url": preview_url}


@router.post("/edit-image")
async def edit_image(body: EditImageRequest):
    """Mock: img + prompt → new image. Simulates in-painting / refinement.
    Accepts either staged_id (in-flight staged image) or source_url (already-saved image URL).
    """
    if body.staged_id is not None:
        if body.staged_id not in _staging:
            raise HTTPException(status_code=404, detail="Staged image not found")
        ref = body.staged_id
    elif body.source_url is not None:
        ref = body.source_url
    else:
        raise HTTPException(status_code=422, detail="Provide staged_id or source_url")
    seed = f"edit|{body.prompt}|{ref}|{time.time()}"
    preview_url = _picsum_url(seed)
    entry = _make_staged(
        preview_url,
        source="edit",
        prompt=body.prompt,
        parent_ref=ref,
    )
    return {"id": entry["id"], "preview_url": preview_url}


@router.post("/annotated-edit")
async def annotated_edit(
    image: UploadFile = File(...),
    prompt: str = Form(...),
):
    """Mock: accept an annotated/drawn-upon image + prompt → new image.
    In production this would send both the base image and the annotation mask to the AI.
    """
    seed = f"annotated|{prompt}|{image.filename or ''}|{time.time()}"
    preview_url = _picsum_url(seed)
    entry = _make_staged(
        preview_url,
        source="annotated_edit",
        prompt=prompt,
        original_filename=image.filename,
    )
    return {"id": entry["id"], "preview_url": preview_url}


@router.post("/generate-view")
async def generate_view(body: GenerateViewRequest):
    """Mock: generate back / left / right view from a front image."""
    ref = body.staged_id or body.source_url or "default"
    seed = f"view|{body.angle}|{ref}|{time.time()}"
    preview_url = _picsum_url(seed)
    entry = _make_staged(
        preview_url,
        source="multiview",
        angle=body.angle,
        ref=ref,
    )
    return {"id": entry["id"], "preview_url": preview_url}


@router.post("/generate-3d")
async def generate_3d(body: Generate3DRequest):
    """Mock: start async 3D generation job. Returns a job_id for polling."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "id": job_id,
        "status": "pending",
        "output_url": None,
        "staged_id": None,
        "created_at": time.time(),
    }
    _job_polls[job_id] = 0
    return {"job_id": job_id, "status": "pending"}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Mock: poll job status. Completes after ≥2 polls (simulates ~10-20 s latency)."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    _job_polls[job_id] = _job_polls.get(job_id, 0) + 1
    job = _jobs[job_id]

    if _job_polls[job_id] >= 2 and job["status"] == "pending":
        entry = _make_staged(SAMPLE_GLB_URL, source="3d_generation", job_id=job_id)
        job["status"] = "completed"
        job["output_url"] = SAMPLE_GLB_URL
        job["staged_id"] = entry["id"]

    return job


@router.post("/confirm/{staged_id}")
async def confirm_staged(
    staged_id: str,
    body: ConfirmStagedRequest,
    session: Session = Depends(get_session),
):
    """
    Download the staged file URL and persist it as a real upload for the version.
    This endpoint is NOT mocked — it performs real DB + filesystem writes.
    """
    if staged_id not in _staging:
        raise HTTPException(status_code=404, detail="Staged file not found")

    staged = _staging[staged_id]
    preview_url = staged["preview_url"]

    version = session.get(PieceVersion, body.version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    piece_id = version.piece_id
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    piece_dir = upload_dir / f"piece_{piece_id}"
    piece_dir.mkdir(parents=True, exist_ok=True)

    field = body.field_name
    ext = ".glb" if field == "model_glb" else ".jpg"
    file_id = str(uuid.uuid4())[:8]
    filename = f"{field}_{file_id}{ext}"
    file_path = piece_dir / filename

    # Download staged file
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(preview_url)
            resp.raise_for_status()
            file_path.write_bytes(resp.content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download staged file: {exc}")

    # Remove old file if present
    old_path_str: Optional[str] = getattr(version, field, None)
    if old_path_str:
        old_path = upload_dir / old_path_str
        if old_path.exists():
            old_path.unlink(missing_ok=True)

    # Persist new path
    relative_path = f"piece_{piece_id}/{filename}"
    setattr(version, field, relative_path)
    session.add(version)
    session.commit()
    session.refresh(version)

    del _staging[staged_id]

    return PieceVersionRead.model_validate(version)


@router.delete("/staged/{staged_id}", status_code=204)
async def discard_staged(staged_id: str):
    """Discard a staged generation (no-op if already gone)."""
    _staging.pop(staged_id, None)
