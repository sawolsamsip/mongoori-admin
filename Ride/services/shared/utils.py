"""
Shared low-level utilities for extraction pipelines.
No document-type-specific logic belongs here.
"""

import json
import re
import os
import logging

import ollama
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

logger = logging.getLogger(__name__)

MODEL = "qwen3-vl:8b"


def pdf_to_images(pdf_path: str, tmp_dir: str, dpi: int = 150) -> list[str]:
    """Convert PDF pages to PNG files. Returns list of image paths."""
    pages = convert_from_path(pdf_path, dpi=dpi)
    paths = []
    for i, page in enumerate(pages):
        img_path = os.path.join(tmp_dir, f"page_{i + 1}.png")
        page.save(img_path, "PNG")
        w, h = page.size
        logger.info("  [pdf] page %d: %dx%d px, %d KB",
                    i + 1, w, h, os.path.getsize(img_path) // 1024)
        paths.append(img_path)
    return paths


def ocr_page(img_path: str) -> str:
    """Run Tesseract OCR on an image and return the raw text."""
    return pytesseract.image_to_string(Image.open(img_path))


def query_model(img_path: str, prompt: str) -> str:
    """
    Call Qwen VL on a single image and return clean text.
    Handles Qwen3 thinking mode: prefers content, falls back to thinking,
    then strips any remaining <think>...</think> blocks.
    """
    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": prompt, "images": [img_path]}],
        think=False,
    )
    msg      = response.message
    content  = getattr(msg, "content",  None) or ""
    thinking = getattr(msg, "thinking", None) or ""
    raw = content or thinking
    return re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()


def parse_json(text: str) -> dict | None:
    """Extract and parse the first JSON object found in text. Returns None on failure."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


def to_float(val) -> float:
    """Coerce a currency string like '$1,234.56' or a number to float."""
    if isinstance(val, (int, float)):
        return float(val)
    cleaned = re.sub(r"[^\d.]", "", str(val or ""))
    try:
        return float(cleaned)
    except ValueError:
        return 0.0
