"""
SQLModel entities for Chess Set Design Manager
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship, JSON, Column
from pydantic import computed_field
from sqlalchemy import DateTime
from typing import Tuple


class PieceType(str, Enum):
    """Enum for chess piece types"""
    KING = "King"
    QUEEN = "Queen"
    ROOK = "Rook"
    BISHOP = "Bishop"
    KNIGHT = "Knight"
    PAWN = "Pawn"


# --- User Model ---
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True, max_length=255)
    username: str = Field(unique=True, index=True, max_length=255)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    profile_picture_url: Optional[str] = Field(default=None, max_length=500)
    credits: int = Field(default=0)
    is_active: bool = Field(default=True)


class User(UserBase, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))

    # Relationships
    collections: List["Collection"] = Relationship(back_populates="user")
    sets: List["ChessSet"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    created_at: datetime


class UserLogin(SQLModel):
    email: str
    password: str


class Token(SQLModel):
    access_token: str
    token_type: str


class TokenData(SQLModel):
    username: Optional[str] = None


# --- Collections Model (many-to-many with chess_sets) ---
class CollectionBase(SQLModel):
    name: str = Field(max_length=255, index=True)
    description: Optional[str] = Field(default=None, max_length=1000)
    is_public: bool = Field(default=False)


class CollectionSet(SQLModel, table=True):
    __tablename__ = "collection_sets"
    collection_id: Optional[int] = Field(default=None, foreign_key="collections.id", primary_key=True)
    set_id: Optional[int] = Field(default=None, foreign_key="chess_sets.id", primary_key=True)


class Collection(CollectionBase, table=True):
    __tablename__ = "collections"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))
    
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    user: Optional[User] = Relationship(back_populates="collections")

    # Relationship to sets via association
    sets: List["ChessSet"] = Relationship(back_populates="collections", link_model=CollectionSet)


class CollectionCreate(CollectionBase):
    pass


class CollectionRead(CollectionBase):
    id: int
    created_at: datetime


class CollectionReadWithSets(CollectionRead):
    """Schema for reading a collection with its sets (and nested pieces)"""
    sets: List["ChessSetReadWithPieces"] = []


# ChessSet Model
class ChessSetBase(SQLModel):
    name: str = Field(max_length=255, index=True)
    description: Optional[str] = Field(default=None, max_length=1000)
    is_public: bool = Field(default=False)


class ChessSet(ChessSetBase, table=True):
    __tablename__ = "chess_sets"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, nullable=False)
    )
    
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    user: Optional[User] = Relationship(back_populates="sets")
    
    # Relationships
    pieces: List["ChessPiece"] = Relationship(
        back_populates="chess_set",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    # Collections relationship (many-to-many via association table)
    collections: List["Collection"] = Relationship(back_populates="sets", link_model=CollectionSet)


class ChessSetCreate(ChessSetBase):
    """Schema for creating a new chess set"""
    pass


class ChessSetRead(ChessSetBase):
    """Schema for reading a chess set"""
    id: int
    created_at: datetime


class ChessSetReadWithPieces(ChessSetRead):
    """Schema for reading a chess set with its pieces and their versions"""
    pieces: List["ChessPieceReadWithVersions"] = []


# ChessPiece Model
class ChessPieceBase(SQLModel):
    type: PieceType = Field(index=True)
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)


class ChessPiece(ChessPieceBase, table=True):
    __tablename__ = "chess_pieces"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    set_id: int = Field(foreign_key="chess_sets.id", index=True)
    
    # Relationships
    chess_set: ChessSet = Relationship(back_populates="pieces")
    versions: List["PieceVersion"] = Relationship(
        back_populates="piece",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ChessPieceCreate(ChessPieceBase):
    """Schema for creating a new piece (usually internal)"""
    set_id: int


class ChessPieceRead(ChessPieceBase):
    """Schema for reading a piece"""
    id: int
    set_id: int


class ChessPieceReadWithVersions(ChessPieceRead):
    """Schema for reading a piece with its versions"""
    versions: List["PieceVersionRead"] = []


# PieceVersion Model
class PieceVersionBase(SQLModel):
    version_name: str = Field(max_length=100)
    version_description: Optional[str] = Field(default=None, max_length=1000)
    img_front: Optional[str] = Field(default=None, max_length=500)
    img_back: Optional[str] = Field(default=None, max_length=500)
    img_side_r: Optional[str] = Field(default=None, max_length=500)
    img_side_l: Optional[str] = Field(default=None, max_length=500)
    model_glb: Optional[str] = Field(default=None, max_length=500)
    model_stl: Optional[str] = Field(default=None, max_length=500)
    is_favorite: bool = Field(default=False)


class PieceVersion(PieceVersionBase, table=True):
    __tablename__ = "piece_versions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    piece_id: int = Field(foreign_key="chess_pieces.id", index=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, nullable=False)
    )
    
    # Relationships
    piece: ChessPiece = Relationship(back_populates="versions")


class PieceVersionCreate(SQLModel):
    """Schema for creating a new piece version"""
    version_name: str
    # Files will be handled separately via multipart form


class PieceVersionRead(PieceVersionBase):
    """Schema for reading a piece version"""
    id: int
    piece_id: int
    created_at: datetime
    @computed_field
    def completion_percentage(self) -> int:
        """Calculate completion percentage based on uploaded files (4 images + 2 models = 6 total)

        Implemented as a pydantic computed field so it's included in serialization
        even when nested inside other response models.
        """
        count = 0
        if self.img_front:
            count += 1
        if self.img_back:
            count += 1
        if self.img_side_r:
            count += 1
        if self.img_side_l:
            count += 1
        if self.model_glb:
            count += 1
        if self.model_stl:
            count += 1
        return int((count / 6) * 100)

    @computed_field
    def is_complete(self) -> bool:
        """Check if version has all files uploaded"""
        return self.completion_percentage == 100


# --- Image Generation Model ---
class ImageGenerationStatus(str, Enum):
    """Enum for image generation status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GeneratedImageBase(SQLModel):
    """Base for a single generated image"""
    url: str = Field(max_length=500)
    selected: bool = Field(default=False)


class GeneratedImage(GeneratedImageBase):
    """Generated image with timestamp"""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ImageGenerationBase(SQLModel):
    """Base for image generation"""
    user_id: int = Field(foreign_key="users.id", index=True)
    piece_id: Optional[int] = Field(default=None, foreign_key="chess_pieces.id")
    view_type: str = Field(max_length=50, index=True)  # rotate_clockwise, rotate_counter, back
    request_id: str = Field(max_length=255, index=True)
    status: ImageGenerationStatus = Field(default=ImageGenerationStatus.PENDING)
    num_images: int = Field(default=1, ge=1, le=4)
    front_image_url: str = Field(max_length=500)
    generated_images: List[dict] = Field(default_factory=list, sa_column=Column(JSON))  # [{url, selected}, ...]
    selected_image_url: Optional[str] = Field(default=None, max_length=500)
    cost: float = Field(default=0.0)


class ImageGeneration(ImageGenerationBase, table=True):
    __tablename__ = "image_generations"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))


class ImageGenerationCreate(ImageGenerationBase):
    pass


class ImageGenerationRead(ImageGenerationBase):
    id: int
    created_at: datetime
    updated_at: datetime


# --- AI Pricing Model ---
class Price(SQLModel, table=True):
    __tablename__ = "ai_prices"
    id: Optional[int] = Field(default=None, primary_key=True)
    model_name: str = Field(index=True, max_length=255)
    price_per_image: float = Field(default=0.039)
    currency: str = Field(default="USD", max_length=10)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime, nullable=False))


# Update forward refs for relationships
ChessSetReadWithPieces.model_rebuild()
ChessPieceReadWithVersions.model_rebuild()

# Rebuild models
Collection.model_rebuild()
CollectionRead.model_rebuild()
CollectionCreate.model_rebuild()
CollectionSet.model_rebuild()
CollectionReadWithSets.model_rebuild()
