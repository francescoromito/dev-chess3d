from typing import List
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from app.models import Collection, CollectionCreate, CollectionSet, ChessSet, ChessPiece


class CollectionService:
    @staticmethod
    def create_collection(session: Session, data: CollectionCreate, user_id: int) -> Collection:
        col = Collection.model_validate(data)
        col.user_id = user_id
        session.add(col)
        session.commit()
        session.refresh(col)
        return col

    @staticmethod
    def get_all_collections(session: Session) -> List[Collection]:
        # Eager-load associated sets and their pieces so API can return collection contents
        stmt = select(Collection).options(
            selectinload(Collection.sets)
            .selectinload(ChessSet.pieces)
            .selectinload(ChessPiece.versions)
        )
        return session.exec(stmt).all()

    @staticmethod
    def get_user_collections(session: Session, user_id: int) -> List[Collection]:
        stmt = select(Collection).where(Collection.user_id == user_id).options(
            selectinload(Collection.sets)
            .selectinload(ChessSet.pieces)
            .selectinload(ChessPiece.versions)
        )
        return session.exec(stmt).all()

    @staticmethod
    def get_collection(session: Session, collection_id: int) -> Collection | None:
        # Load collection with sets and pieces
        stmt = select(Collection).where(Collection.id == collection_id).options(
            selectinload(Collection.sets)
            .selectinload(ChessSet.pieces)
            .selectinload(ChessPiece.versions)
        )
        return session.exec(stmt).first()

    @staticmethod
    def update_collection(session: Session, collection_id: int, data: CollectionCreate) -> Collection:
        col = session.get(Collection, collection_id)
        if not col:
            return None
        col.name = data.name
        col.description = data.description
        session.add(col)
        session.commit()
        session.refresh(col)
        return col

    @staticmethod
    def delete_collection(session: Session, collection_id: int) -> None:
        col = session.get(Collection, collection_id)
        if not col:
            return
        session.delete(col)
        session.commit()

    @staticmethod
    def add_set_to_collection(session: Session, collection_id: int, set_id: int) -> None:
        # Avoid duplicates
        exists = session.exec(select(CollectionSet).where(CollectionSet.collection_id == collection_id, CollectionSet.set_id == set_id)).first()
        if exists:
            return
        assoc = CollectionSet(collection_id=collection_id, set_id=set_id)
        session.add(assoc)
        session.commit()

    @staticmethod
    def remove_set_from_collection(session: Session, collection_id: int, set_id: int) -> None:
        assoc = session.exec(select(CollectionSet).where(CollectionSet.collection_id == collection_id, CollectionSet.set_id == set_id)).first()
        if assoc:
            session.delete(assoc)
            session.commit()
