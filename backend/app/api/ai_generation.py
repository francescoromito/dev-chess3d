"""
AI Image Generation API
Endpoints for generating chess piece images using AI models
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Literal, List
from sqlmodel import Session, select
import requests
import os
import time
from app.database import get_session
from app.models import User, Price
from app.api.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Generation"])


class GenerateImageRequest(BaseModel):
    """Request body for image generation"""
    prompt: str = Field(..., min_length=1, description="Text prompt describing the image to generate")
    model_name: Literal["fal-ai/nano-banana"] = Field(default="fal-ai/nano-banana", description="AI model to use")
    num_images: int = Field(default=1, ge=1, le=4, description="Number of image variations to generate (1-4)")


class ImageResult(BaseModel):
    """Single generated image result"""
    url: str
    content_type: str = "image/png"


class GenerateImageResponse(BaseModel):
    """Response from image generation"""
    images: List[ImageResult]
    request_id: str
    model_used: str
    num_generated: int


def generate_images(model_name: str, prompt: str, num_images: int = 1):
    """
    Submit image generation request to FAL AI
    Returns request_id and status_url for polling
    """
    assert model_name in ["fal-ai/nano-banana"], "Unsupported model_name"
    assert 1 <= num_images <= 4, "num_images must be between 1 and 4"
    
    fal_key = os.environ.get("FAL_KEY")
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured in environment")
    
    response = requests.post(
        url=f"https://queue.fal.run/{model_name}",
        headers={
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json"
        },
        json={
            "prompt": prompt,
            "num_images": num_images,
            "aspect_ratio": "1:1",
            "output_format": "png"
        }
    )
    
    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"FAL AI request failed: {response.text}"
        )
    
    response_data = response.json()
    request_id = response_data.get("request_id")
    status_url = response_data.get("status_url")
    
    return request_id, status_url


def get_status(status_url: str) -> str:
    """Check the status of a generation request"""
    status_response = requests.get(url=status_url)
    status_response.raise_for_status()  # Raises exception only for 4xx/5xx status codes
    return status_response.json()["status"]


def get_images(status_url: str) -> List[bytes]:
    """
    Retrieve generated images once ready
    Returns list of image data as bytes
    """
    responses_url_raw = requests.get(url=status_url).json()["response_url"]
    response_json = requests.get(url=responses_url_raw).json()["images"]
    return [requests.get(d["url"]).content for d in response_json]


@router.post("/generate", response_model=GenerateImageResponse)
async def generate_image(
    request: GenerateImageRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate chess piece images using AI
    
    This endpoint submits a generation request and polls until completion.
    Returns URLs to the generated images.
    
    Note: This is a synchronous endpoint that waits for generation to complete.
    Generation typically takes 10-30 seconds.
    """
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        # Get price for this model
        price_entry = session.exec(select(Price).where(Price.model_name == request.model_name)).first()
        if not price_entry:
            # Create default if missing
            price_entry = Price(model_name=request.model_name, price_per_image=0.039)
            session.add(price_entry)
            session.commit()
            session.refresh(price_entry)
        
        # Calculate total cost
        total_cost = price_entry.price_per_image * request.num_images
        
        # Check if user has enough credits
        if current_user.credits < total_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Required: {total_cost:.2f}, Available: {current_user.credits:.2f}"
            )
        
        # Deduct credits BEFORE generation (to prevent double spending if request is retried)
        current_user.credits -= total_cost
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        
        logger.info(f"Credits deducted: {total_cost:.2f} from user {current_user.id}. Remaining: {current_user.credits:.2f}")
        
        # Submit generation request
        request_id, status_url = generate_images(
            model_name=request.model_name,
            prompt=request.prompt,
            num_images=request.num_images
        )
        
        logger.info(f"Generation request submitted: request_id={request_id}, status_url={status_url}")
        
        # Poll for completion (with timeout)
        max_wait_time = 180  # 3 minutes max
        poll_interval = 2  # seconds
        elapsed = 0
        
        while elapsed < max_wait_time:
            status = get_status(status_url)
            logger.info(f"Status check: {status} (elapsed: {elapsed}s)")
            
            if status == "COMPLETED":
                # Get the generated images
                image_urls_data = requests.get(url=status_url).json()
                logger.info(f"Completed response data: {image_urls_data}")
                
                response_url = image_urls_data.get("response_url")
                
                if not response_url:
                    raise HTTPException(status_code=500, detail=f"No response_url in completed request. Data: {image_urls_data}")
                
                # Fetch the actual image URLs
                response_json = requests.get(url=response_url).json()
                logger.info(f"Image response JSON: {response_json}")
                
                images = response_json.get("images", [])
                
                if not images:
                    raise HTTPException(status_code=500, detail=f"No images in response. JSON: {response_json}")
                
                # Return the image URLs directly (frontend will fetch them)
                return GenerateImageResponse(
                    images=[ImageResult(url=img["url"]) for img in images],
                    request_id=request_id,
                    model_used=request.model_name,
                    num_generated=len(images)
                )
            
            elif status == "FAILED":
                raise HTTPException(status_code=500, detail="Image generation failed")
            
            # Still processing, wait and retry
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # Timeout
        raise HTTPException(
            status_code=504,
            detail=f"Image generation timed out after {max_wait_time} seconds"
        )
    
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except AssertionError as e:
        logger.error(f"Assertion error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except requests.RequestException as e:
        logger.error(f"Request exception: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected exception: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
