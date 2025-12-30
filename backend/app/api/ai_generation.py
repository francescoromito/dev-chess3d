"""
AI Image Generation API
Endpoints for generating chess piece images using AI models
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Literal, List, Optional
from sqlmodel import Session, select
from datetime import datetime
import requests
import os
import time
import base64
import json
import traceback
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from app.database import get_session
from app.models import User, Price, ImageGeneration, ImageGenerationStatus
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


def upload_image(image_data: bytes) -> str:
    """
    Upload an image to FAL AI and return its URL
    
    Args:
        image_data: Raw image bytes
        
    Returns:
        URL of uploaded image on FAL AI
    """
    import fal_client
    from io import BytesIO
    from PIL import Image
    
    # Convert bytes to PIL Image
    image = Image.open(BytesIO(image_data))
    
    # Handle RGBA images (convert to RGB with white background)
    # JPEG doesn't support alpha channel, and many AI models prefer RGB
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        # Create a white background
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'P':
            image = image.convert('RGBA')
        background.paste(image, mask=image.split()[-1]) # Use alpha channel as mask
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Upload to FAL
    url = fal_client.upload_image(image)
    return url


def load_prompt_template(template_name: str) -> str:
    """
    Load a Jinja2 template from the prompts directory
    
    Args:
        template_name: Name of the template file (without path)
        
    Returns:
        The rendered template content
    """
    prompts_dir = Path(__file__).parent.parent / "prompts"
    
    if not prompts_dir.exists():
        raise HTTPException(status_code=500, detail="Prompts directory not found")
    
    env = Environment(loader=FileSystemLoader(prompts_dir))
    template = env.get_template(template_name)
    
    return template.render()


def render_prompt_template(template_name: str, **kwargs) -> str:
    """
    Load and render a Jinja2 template with provided context
    
    Args:
        template_name: Name of the template file (without path)
        **kwargs: Variables to pass to the template
        
    Returns:
        The rendered template content
    """
    prompts_dir = Path(__file__).parent.parent / "prompts"
    
    if not prompts_dir.exists():
        raise HTTPException(status_code=500, detail="Prompts directory not found")
    
    env = Environment(loader=FileSystemLoader(prompts_dir))
    template = env.get_template(template_name)
    
    return template.render(**kwargs)


def edit_images(model_name: str, prompt: str, images: List[str], num_images: int = 1):
    """
    Submit image editing request to FAL AI
    
    Args:
        model_name: The FAL AI model to use
        prompt: The editing prompt/instruction
        images: List of image URLs to edit
        num_images: Number of variations to generate
        
    Returns:
        Tuple of (request_id, status_url)
    """
    assert model_name in ["fal-ai/nano-banana/edit"], "Unsupported model_name"
    assert 1 <= num_images <= 4, "num_images must be between 1 and 4"
    assert len(images) > 0, "At least one image must be provided"
    
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
            "image_urls": images,
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
        
        # Create generation record
        db_generation = ImageGeneration(
            user_id=current_user.id,
            view_type="text_to_image",
            request_id="pending",
            status=ImageGenerationStatus.PENDING,
            num_images=request.num_images,
            front_image_url="",
            cost=total_cost
        )
        session.add(db_generation)
        session.commit()
        session.refresh(db_generation)

        # Submit generation request
        request_id, status_url = generate_images(
            model_name=request.model_name,
            prompt=request.prompt,
            num_images=request.num_images
        )
        
        # Update record with request_id
        db_generation.request_id = request_id
        db_generation.status = ImageGenerationStatus.PROCESSING
        session.add(db_generation)
        session.commit()

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
                    db_generation.status = ImageGenerationStatus.FAILED
                    session.add(db_generation)
                    session.commit()
                    raise HTTPException(status_code=500, detail=f"No response_url in completed request. Data: {image_urls_data}")
                
                # Fetch the actual image URLs
                response_json = requests.get(url=response_url).json()
                logger.info(f"Image response JSON: {response_json}")
                
                images = response_json.get("images", [])
                
                if not images:
                    db_generation.status = ImageGenerationStatus.FAILED
                    session.add(db_generation)
                    session.commit()
                    raise HTTPException(status_code=500, detail=f"No images in response. JSON: {response_json}")
                
                # Update record with results
                db_generation.status = ImageGenerationStatus.COMPLETED
                db_generation.generated_images = [{"url": img["url"], "selected": False} for img in images]
                db_generation.updated_at = datetime.utcnow()
                session.add(db_generation)
                session.commit()

                # Return the image URLs directly (frontend will fetch them)
                return GenerateImageResponse(
                    images=[ImageResult(url=img["url"]) for img in images],
                    request_id=request_id,
                    model_used=request.model_name,
                    num_generated=len(images)
                )
            
            elif status == "FAILED":
                db_generation.status = ImageGenerationStatus.FAILED
                session.add(db_generation)
                session.commit()
                raise HTTPException(status_code=500, detail="Image generation failed")
            
            # Still processing, wait and retry
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # Timeout
        db_generation.status = ImageGenerationStatus.FAILED
        session.add(db_generation)
        session.commit()
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


class EditImageRequest(BaseModel):
    """Request body for image editing"""
    image_url: str = Field(..., description="URL of the image to edit")
    edit_type: Literal["rotate_90_cw", "rotate_90_ccw", "back_view", "generic_edit"] = Field(..., description="Type of edit to apply")
    custom_prompt: Optional[str] = Field(None, description="Custom prompt for generic_edit type")
    num_images: int = Field(default=1, ge=1, le=4, description="Number of variations to generate (1-4)")


class EditImageResponse(BaseModel):
    """Response from image editing"""
    images: List[ImageResult]
    request_id: str
    edit_type: str
    num_generated: int


@router.post("/edit", response_model=EditImageResponse)
async def edit_image(
    request: EditImageRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Edit chess piece images using AI
    
    Supports predefined edit types:
    - rotate_90_cw: Rotate 90 degrees clockwise
    - rotate_90_ccw: Rotate 90 degrees counter-clockwise  
    - back_view: Generate back view
    - generic_edit: Apply custom edit (requires custom_prompt)
    
    This endpoint submits an edit request and polls until completion.
    Returns URLs to the edited images.
    """
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        # Validate edit type and get prompt template
        valid_edit_types = ["rotate_90_cw", "rotate_90_ccw", "back_view", "generic_edit"]
        if request.edit_type not in valid_edit_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid edit_type. Must be one of: {', '.join(valid_edit_types)}"
            )
        
        # For generic_edit, custom_prompt is required
        if request.edit_type == "generic_edit" and not request.custom_prompt:
            raise HTTPException(
                status_code=400,
                detail="custom_prompt is required for generic_edit type"
            )
        
        # Load and render the appropriate prompt template
        if request.edit_type == "generic_edit":
            prompt = render_prompt_template("generic_edit.jinja", custom_prompt=request.custom_prompt)
        else:
            template_name = f"{request.edit_type}.jinja"
            prompt = load_prompt_template(template_name)
        
        logger.info(f"Loaded prompt template: {request.edit_type}")
        logger.info(f"Rendered prompt: {prompt}")
        
        # Get price for edit model
        model_name = "fal-ai/nano-banana/edit"
        price_entry = session.exec(select(Price).where(Price.model_name == model_name)).first()
        if not price_entry:
            # Create default if missing
            price_entry = Price(model_name=model_name, price_per_image=0.039)
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
        
        # Deduct credits BEFORE editing
        current_user.credits -= total_cost
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        
        logger.info(f"Credits deducted: {total_cost:.2f} from user {current_user.id}. Remaining: {current_user.credits:.2f}")
        
        # Create generation record
        db_generation = ImageGeneration(
            user_id=current_user.id,
            view_type=request.edit_type,
            request_id="pending",
            status=ImageGenerationStatus.PENDING,
            num_images=request.num_images,
            front_image_url=request.image_url,
            cost=total_cost
        )
        session.add(db_generation)
        session.commit()
        session.refresh(db_generation)

        # Submit edit request
        request_id, status_url = edit_images(
            model_name=model_name,
            prompt=prompt,
            images=[request.image_url],
            num_images=request.num_images
        )
        
        # Update record with request_id
        db_generation.request_id = request_id
        db_generation.status = ImageGenerationStatus.PROCESSING
        session.add(db_generation)
        session.commit()

        logger.info(f"Edit request submitted: request_id={request_id}, edit_type={request.edit_type}")
        
        # Poll for completion (with timeout)
        max_wait_time = 180  # 3 minutes max
        poll_interval = 2  # seconds
        elapsed = 0
        
        while elapsed < max_wait_time:
            status = get_status(status_url)
            logger.info(f"Status check: {status} (elapsed: {elapsed}s)")
            
            if status == "COMPLETED":
                # Get the edited images
                image_urls_data = requests.get(url=status_url).json()
                logger.info(f"Completed response data: {image_urls_data}")
                
                response_url = image_urls_data.get("response_url")
                
                if not response_url:
                    db_generation.status = ImageGenerationStatus.FAILED
                    session.add(db_generation)
                    session.commit()
                    raise HTTPException(status_code=500, detail=f"No response_url in completed request. Data: {image_urls_data}")
                
                # Fetch the actual image URLs
                response_json = requests.get(url=response_url).json()
                logger.info(f"Image response JSON: {response_json}")
                
                images = response_json.get("images", [])
                
                if not images:
                    db_generation.status = ImageGenerationStatus.FAILED
                    session.add(db_generation)
                    session.commit()
                    raise HTTPException(status_code=500, detail=f"No images in response. JSON: {response_json}")
                
                # Update record with results
                db_generation.status = ImageGenerationStatus.COMPLETED
                db_generation.generated_images = [{"url": img["url"], "selected": False} for img in images]
                db_generation.updated_at = datetime.utcnow()
                session.add(db_generation)
                session.commit()

                # Return the image URLs
                return EditImageResponse(
                    images=[ImageResult(url=img["url"]) for img in images],
                    request_id=request_id,
                    edit_type=request.edit_type,
                    num_generated=len(images)
                )
            
            elif status == "FAILED":
                db_generation.status = ImageGenerationStatus.FAILED
                session.add(db_generation)
                session.commit()
                raise HTTPException(status_code=500, detail="Image editing failed")
            
            # Still processing, wait and retry
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # Timeout
        db_generation.status = ImageGenerationStatus.FAILED
        session.add(db_generation)
        session.commit()
        raise HTTPException(
            status_code=504,
            detail=f"Image editing timed out after {max_wait_time} seconds"
        )
    
    except HTTPException:
        raise
    except AssertionError as e:
        logger.error(f"Assertion error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except requests.RequestException as e:
        logger.error(f"Request exception: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=502, detail=f"External API error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected exception: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/upload")
async def upload_image_endpoint(
    image_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an image to FAL AI and return its URL
    
    This is useful before editing images, as edit endpoints require image URLs.
    Supports common image formats (JPEG, PNG, WebP, etc.)
    """
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if image_file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Read file content
        content = await image_file.read()
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Upload to FAL
        url = upload_image(content)
        
        logger.info(f"Image uploaded successfully. URL: {url}")
        
        return {
            "url": url,
            "filename": image_file.filename,
            "content_type": image_file.content_type
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image upload failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

