#!/usr/bin/env python3
"""
Test script for Image Editing API endpoints
Shows how to use the new upload and edit endpoints
"""

import requests
import json
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/ai"

# You'll need a valid auth token
AUTH_TOKEN = "your_token_here"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}


def upload_image(image_path: str) -> str:
    """Upload an image and return its URL"""
    print(f"\n📤 Uploading image: {image_path}")
    
    with open(image_path, 'rb') as f:
        files = {'image_file': f}
        response = requests.post(
            f"{BASE_URL}{API_PREFIX}/upload",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
            files=files
        )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Upload successful!")
        print(f"URL: {data['url']}")
        return data['url']
    else:
        print(f"❌ Upload failed: {response.text}")
        return None


def edit_image(image_url: str, edit_type: str, custom_prompt: str = None, num_images: int = 1):
    """Edit an image with specified edit type"""
    print(f"\n✏️  Editing image with type: {edit_type}")
    
    payload = {
        "image_url": image_url,
        "edit_type": edit_type,
        "num_images": num_images
    }
    
    if custom_prompt:
        payload["custom_prompt"] = custom_prompt
    
    response = requests.post(
        f"{BASE_URL}{API_PREFIX}/edit",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Edit successful!")
        print(f"Request ID: {data['request_id']}")
        print(f"Generated {data['num_generated']} image(s)")
        for i, img in enumerate(data['images'], 1):
            print(f"  Image {i}: {img['url']}")
        return data
    else:
        print(f"❌ Edit failed: {response.text}")
        return None


def main():
    """Example workflow"""
    print("🎨 Image Editing API Test")
    print("=" * 50)
    
    # Example 1: Rotate clockwise
    print("\n" + "="*50)
    print("Example 1: Rotate 90° Clockwise")
    print("="*50)
    
    # Assuming you have an image_url from a previous upload
    sample_url = "https://fal.ai/example/chess_piece.png"
    result = edit_image(sample_url, "rotate_90_cw", num_images=1)
    
    # Example 2: Back view
    print("\n" + "="*50)
    print("Example 2: Generate Back View")
    print("="*50)
    
    result = edit_image(sample_url, "back_view", num_images=2)
    
    # Example 3: Custom edit
    print("\n" + "="*50)
    print("Example 3: Custom Edit")
    print("="*50)
    
    custom_prompt = "Change the piece to a shiny gold material"
    result = edit_image(
        sample_url, 
        "generic_edit", 
        custom_prompt=custom_prompt,
        num_images=1
    )
    
    # Example 4: Rotate counter-clockwise
    print("\n" + "="*50)
    print("Example 4: Rotate 90° Counter-Clockwise")
    print("="*50)
    
    result = edit_image(sample_url, "rotate_90_ccw", num_images=1)
    
    print("\n" + "="*50)
    print("✅ All examples completed!")
    print("="*50)


if __name__ == "__main__":
    print("\n⚠️  NOTE: Update AUTH_TOKEN before running!")
    print("⚠️  NOTE: Update sample_url with real image URL!")
    # main()
