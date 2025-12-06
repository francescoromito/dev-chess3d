from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from app.database import get_session
from app.models import Collection, CollectionCreate, CollectionRead, CollectionReadWithSets, ChessSet, User
from app.services.collection_service import CollectionService
from app.api.auth import get_current_user

router = APIRouter(prefix="/collections", tags=["Collections"])


@router.post("", response_model=CollectionReadWithSets, status_code=status.HTTP_201_CREATED)
def create_collection(
    data: CollectionCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    col = CollectionService.create_collection(session, data, current_user.id)
    # reload with sets (empty initially)
    full = CollectionService.get_collection(session, col.id)
    return CollectionReadWithSets.model_validate(full)


@router.get("", response_model=List[CollectionReadWithSets])
def get_collections(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    cols = CollectionService.get_user_collections(session, current_user.id)
    return [CollectionReadWithSets.model_validate(c) for c in cols]


@router.get("/{collection_id}", response_model=CollectionReadWithSets)
def get_collection(collection_id: int, session: Session = Depends(get_session)):
    col = CollectionService.get_collection(session, collection_id)
    if not col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return CollectionReadWithSets.model_validate(col)


@router.put("/{collection_id}", response_model=CollectionReadWithSets)
def update_collection(collection_id: int, data: CollectionCreate, session: Session = Depends(get_session)):
    updated = CollectionService.update_collection(session, collection_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    full = CollectionService.get_collection(session, collection_id)
    return CollectionReadWithSets.model_validate(full)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(collection_id: int, session: Session = Depends(get_session)):
    CollectionService.delete_collection(session, collection_id)


@router.post("/{collection_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_set(collection_id: int, set_id: int, session: Session = Depends(get_session)):
    # ensure set exists
    s = session.get(ChessSet, set_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Set not found")
    CollectionService.add_set_to_collection(session, collection_id, set_id)


@router.delete("/{collection_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_set(collection_id: int, set_id: int, session: Session = Depends(get_session)):
    CollectionService.remove_set_from_collection(session, collection_id, set_id)
