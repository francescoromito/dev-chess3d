"""
Database configuration and session management
"""
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
import os


# Get database URL from environment. Do NOT hardcode credentials here.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set.\n"
        "Set it in a .env file or export it in your environment.\n"
        "Example: postgresql://<user>:<password>@db:5432/<dbname>"
    )

# Create engine - PostgreSQL doesn't need check_same_thread
engine = create_engine(
    DATABASE_URL,
    echo=True,  # Set to False in production
    pool_pre_ping=True,  # Verifica connessione prima dell'uso
    pool_size=5,
    max_overflow=10
)


def create_db_and_tables() -> None:
    """Create all database tables"""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Dependency to get database session"""
    with Session(engine) as session:
        yield session
