#!/usr/bin/env python3
"""
Tesla service invoice extractor.

Multi-page extraction strategy:
  - Header fields (vin, invoice_date) : pages classified as 'header'
  - Job entries                        : pages classified as 'jobs'
  - Final total_amount                 : pages classified as 'total'

Page classification uses positive service-invoice OCR markers only.
A page that matches no service-invoice marker is silently excluded.

Usage:
  python -m services.invoice.extractor invoice.pdf
  python -m services.invoice.extractor invoice.pdf --out result.json
"""

import sys
import re
import json
import argparse
import logging
import os
import tempfile
from pathlib import Path

from services.shared.utils import pdf_to_images, ocr_page, query_model, parse_json, to_float

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Service-invoice-specific page classification patterns
# (completely separate from purchase contract patterns)
# ---------------------------------------------------------------------------

# Markers that identify a page as containing the invoice header
_HEADER_MARKERS = [
    r'\bservice (invoice|estimate)\b',
    r'\bvehicle identification number\b',
]

# Markers that identify a page as containing job table entries
_JOBS_MARKERS = [
    r'\bconcern\b',
    r'\brepair notes?\b',
    r'\bpay type\b',
    r'\bamount \(usd\)\b',
]

# Marker that identifies the summary page with the final total
_TOTAL_MARKER = r'\btotal amount \(usd\)\b'

def _classify_page(text: str) -> set[str]:
    """
    Return the roles this page plays in a service invoice.
    Roles: 'header', 'jobs', 'total'

    Classification is based on positive service-invoice signals only.
    A page that matches no service-invoice marker receives an empty set
    and is excluded from all extraction passes.
    """
    t     = text.lower()
    roles = set()

    if any(re.search(p, t) for p in _HEADER_MARKERS):
        roles.add('header')

    job_hits = sum(1 for p in _JOBS_MARKERS if re.search(p, t))
    if job_hits >= 2:
        roles.add('jobs')

    if re.search(_TOTAL_MARKER, t):
        roles.add('total')

    return roles


def _screen_pages(image_paths: list[str]) -> dict[str, list[int]]:
    """
    OCR all pages and classify each one.
    Returns a dict mapping role → list of 0-based page indices.
    """
    classified: dict[str, list[int]] = {"header": [], "jobs": [], "total": []}

    for i, img_path in enumerate(image_paths):
        text  = ocr_page(img_path)
        roles = _classify_page(text)
        logger.info("  [screen] page %d: roles=%s", i + 1, sorted(roles) or ['unclassified'])
        for role in ("header", "jobs", "total"):
            if role in roles:
                classified[role].append(i)

    return classified


# ---------------------------------------------------------------------------
# Targeted extraction prompts — service invoice specific
# ---------------------------------------------------------------------------

HEADER_PROMPT = """\
Look at this service invoice page and extract only these two fields.
Return ONLY valid JSON, no explanation, no markdown.

{"vin": "", "invoice_date": ""}

Rules:
- "vin": vehicle identification number from the invoice header.
- "invoice_date": invoice date in YYYY-MM-DD format.
- If either field is not visible on this page, leave it as an empty string.
"""

JOBS_PROMPT = """\
Look at this service invoice page and extract all job entries from the job table.
Return ONLY valid JSON, no explanation, no markdown.

{"jobs": [{"concern": "", "amount": 0}]}

Rules:
- One entry per job using the "Concern" column for description and "Amount (USD)" for value.
- Include jobs even when the amount is 0 (warranty or goodwill).
- Do NOT include labor or parts line items, subtotals, or tax entries — only job-level rows.
- All amount values must be JSON numbers, not strings.
- If this page contains no job table entries, return {"jobs": []}.
"""

TOTAL_PROMPT = """\
Look at this service invoice page and find the final total amount.
Return ONLY valid JSON, no explanation, no markdown.

{"total_amount": null}

Rules:
- "total_amount" must be the final "Total Amount (USD)" from the invoice summary section.
- Do NOT use per-job amounts, subtotals, parts totals, labor totals, or tax amounts.
- If this page does not contain a final total summary section, return {"total_amount": null}.
- The value must be a JSON number or null.
"""

SMOKE_PROMPT = "What text do you see on this page? List the first few lines."

# ---------------------------------------------------------------------------
# Zone extractors
# ---------------------------------------------------------------------------

def _extract_header(img_path: str) -> dict:
    text   = query_model(img_path, HEADER_PROMPT)
    result = parse_json(text) or {}
    logger.info("[header] vin=%r  invoice_date=%r",
                result.get("vin"), result.get("invoice_date"))
    return result


def _extract_jobs(img_path: str, page_num: int) -> list[dict]:
    text   = query_model(img_path, JOBS_PROMPT)
    result = parse_json(text) or {}
    jobs   = result.get("jobs") or []
    coerced = [
        {"concern": j.get("concern", ""), "amount": to_float(j.get("amount"))}
        for j in jobs
        if isinstance(j, dict)
    ]
    logger.info("  [jobs] page %d: %d job(s)", page_num, len(coerced))
    return coerced


def _extract_total(img_path: str, page_num: int) -> float | None:
    text   = query_model(img_path, TOTAL_PROMPT)
    result = parse_json(text) or {}
    raw    = result.get("total_amount")
    if raw is None:
        logger.info("  [total] page %d: no summary total", page_num)
        return None
    total = to_float(raw)
    logger.info("  [total] page %d: total_amount=%.2f", page_num, total)
    return total

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_invoice(pdf_path: str, smoke: bool = False) -> dict:
    """
    Extract structured data from a Tesla service invoice PDF.
    Returns {"vin", "invoice_date", "total_amount", "jobs"} or an error dict.
    """
    path = Path(pdf_path)
    if not path.exists():
        return {"error": f"file not found: {pdf_path}"}
    if path.suffix.lower() != ".pdf":
        return {"error": f"expected a PDF, got: {path.suffix}"}

    with tempfile.TemporaryDirectory() as tmp_dir:
        logger.info("[pdf] loading: %s", pdf_path)
        image_paths = pdf_to_images(pdf_path, tmp_dir, dpi=150)
        logger.info("[pdf] pages: %d", len(image_paths))

        if smoke:
            logger.info("--- SMOKE TEST ---")
            logger.info("[smoke] %r", query_model(image_paths[0], SMOKE_PROMPT)[:300])
            logger.info("--- END SMOKE TEST ---")

        # Classify pages using service-invoice-specific markers
        logger.info("[screen] classifying %d page(s)...", len(image_paths))
        classified = _screen_pages(image_paths)

        # --- Header ---
        header_indices = classified["header"] or [0]  # fallback to page 1
        logger.info("[header] using page(s): %s", [i + 1 for i in header_indices])
        header = _extract_header(image_paths[header_indices[0]])

        # --- Jobs ---
        jobs_indices = classified["jobs"]
        if not jobs_indices:
            logger.warning("[jobs] no job pages detected — falling back to all pages")
            jobs_indices = list(range(len(image_paths)))

        logger.info("[jobs] scanning page(s): %s", [i + 1 for i in jobs_indices])
        all_jobs: list[dict] = []
        for i in jobs_indices:
            all_jobs.extend(_extract_jobs(image_paths[i], i + 1))
        logger.info("[jobs] total: %d", len(all_jobs))

        # --- Total ---
        total_indices = classified["total"]
        if not total_indices:
            logger.warning("[total] no summary page detected — falling back to last page")
            total_indices = [len(image_paths) - 1]

        logger.info("[total] scanning page(s): %s", [i + 1 for i in total_indices])
        total_amount = 0.0
        for i in reversed(total_indices):  # last summary page wins
            t = _extract_total(image_paths[i], i + 1)
            if t is not None:
                total_amount = t
                break

    return {
        "vin":          header.get("vin", ""),
        "invoice_date": header.get("invoice_date", ""),
        "total_amount": total_amount,
        "jobs":         all_jobs,
    }

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract structured JSON from a Tesla service invoice PDF."
    )
    parser.add_argument("pdf", help="Path to the Tesla service invoice PDF")
    parser.add_argument("--out",   metavar="FILE", help="Write JSON to this file instead of stdout")
    parser.add_argument("--smoke", action="store_true", help="Run smoke test before extraction")
    args = parser.parse_args()

    result = extract_invoice(args.pdf, smoke=args.smoke)
    output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"Result written to {args.out}")
    else:
        print(output)

    sys.exit(1 if "error" in result else 0)
