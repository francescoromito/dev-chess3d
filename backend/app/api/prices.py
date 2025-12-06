"""
AI Pricing endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models import Price

router = APIRouter(prefix="/ai/price", tags=["AI Prices"])


@router.get("/", response_model=List[Price])
def list_prices(session: Session = Depends(get_session)):
    """List all price entries"""
    prices = session.exec(select(Price)).all()
    return prices


@router.get("/{model_name:path}")
def get_price(model_name: str, session: Session = Depends(get_session)):
    """Get current price for a model"""
    # model_name comes URL-encoded (e.g., fal-ai%2Fnano-banana), FastAPI auto-decodes with :path
    price = session.exec(select(Price).where(Price.model_name == model_name)).first()
    if not price:
        # If price not found, create a default entry so frontend can always fetch a price
        default_price = Price(model_name=model_name, price_per_image=0.039, currency="USD")
        session.add(default_price)
        session.commit()
        session.refresh(default_price)
        price = default_price

    return {
        "model_name": price.model_name,
        "price_per_image": price.price_per_image,
        "currency": price.currency,
        "updated_at": price.updated_at,
    }


@router.post("/{model_name:path}/set")
def set_price(model_name: str, value: float, session: Session = Depends(get_session)):
    """Set or update price for a model (simple admin endpoint)"""
    price = session.exec(select(Price).where(Price.model_name == model_name)).first()
    if price:
        price.price_per_image = value
        session.add(price)
        session.commit()
        session.refresh(price)
        return {"ok": True, "model_name": price.model_name, "price_per_image": price.price_per_image}
    # create
    new = Price(model_name=model_name, price_per_image=value)
    session.add(new)
    session.commit()
    session.refresh(new)
    return {"ok": True, "model_name": new.model_name, "price_per_image": new.price_per_image}
