import re
import logging
import tempfile
from pathlib import Path

from services.shared.utils import pdf_to_images, ocr_page, query_model, parse_json, to_float

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Purchase contract prompt
# ---------------------------------------------------------------------------

PROMPT = """This is a car sales contract image. Extract the following fields and return as JSON only, no explanation, no markdown:
{
    "vin": "",
    "annual_percentage_rate": "",
    "finance_charge": "",
    "amount_financed": "",
    "total_of_payments": "",
    "total_sale_price": "",
    "down_payment": "",
    "num_payments": "",
    "monthly_payment": "",
    "first_payment_date": ""
}"""

# ---------------------------------------------------------------------------
# Purchase-contract-specific page scoring patterns
# ---------------------------------------------------------------------------

TOP_K_SUMMARY_PAGES = 2

SUMMARY_PATTERNS = [
    (r'\btruth[\s\-]in[\s\-]lending\b',         'truth_in_lending'),
    (r'\bannual percentage rate\b',               'annual_percentage_rate'),
    (r'\bapr\b',                                  'apr'),
    (r'\bamount financed\b',                      'amount_financed'),
    (r'\btotal of payments\b',                    'total_of_payments'),
    (r'\bmonthly payment\b',                      'monthly_payment'),
    (r'\bnumber of payments\b',                   'number_of_payments'),
    (r'\bpayment schedule\b',                     'payment_schedule'),
    (r'\bfirst payment date\b',                   'first_payment_date'),
    (r'\bcontract date\b',                        'contract_date'),
    (r'\bretail installment sale contract\b',     'retail_installment_sale_contract'),
]

NUMERIC_PATTERNS = [
    (r'\b\d+\.\d+\s*%',      'percentage'),
    (r'\$[\d,]+\.\d{2}',     'currency'),
    (r'\b\d{2,3}\s+monthly', 'payment_count'),
]

# Pages that are legal boilerplate — not useful for purchase contract extraction.
# NOTE: "warranty" is intentionally excluded here as it appears on some contracts,
# but it is NOT in the invoice pipeline noise list.
NOISE_PATTERNS = [
    (r'\bprivacy notice\b',        'privacy_notice'),
    (r'\barbitration\b',           'arbitration'),
    (r'\bglba\b',                  'glba'),
    (r'\bopt[\s\-]out\b',          'opt_out'),
    (r'\bindemnif',                'indemnification'),
    (r'\bitemization of amount\b', 'itemization'),
    (r'\bgap (addendum|waiver)\b', 'gap_addendum'),
]

PRIORITY_FIELDS = [
    "annual_percentage_rate",
    "monthly_payment",
    "total_of_payments",
    "amount_financed",
    "num_payments",
    "first_payment_date",
]

# ---------------------------------------------------------------------------
# Purchase-contract-specific page screening
# ---------------------------------------------------------------------------

def _score_page(text: str) -> dict:
    t = text.lower()
    score = 0
    matched = {"summary": [], "numeric": [], "noise": []}

    for pattern, label in SUMMARY_PATTERNS:
        if re.search(pattern, t):
            score += 5
            matched["summary"].append(label)

    for pattern, label in NUMERIC_PATTERNS:
        if re.search(pattern, t):
            score += 2
            matched["numeric"].append(label)

    for pattern, label in NOISE_PATTERNS:
        if re.search(pattern, t):
            score -= 4
            matched["noise"].append(label)

    return {"score": score, "matched": matched}


def _screen_pages(page_paths: list[tuple[int, str]],
                  top_k: int = TOP_K_SUMMARY_PAGES) -> list[tuple[int, str]]:
    scored = []
    for page_num, img_path in page_paths:
        text = ocr_page(img_path)
        result = _score_page(text)
        scored.append((page_num, img_path, result))
        logger.info(
            "  [screen] page %d: score=%d | summary=%s",
            page_num, result["score"], result["matched"]["summary"]
        )

    scored.sort(key=lambda x: x[2]["score"], reverse=True)
    selected = [(page_num, img_path) for page_num, img_path, _ in scored[:top_k]
                if scored[0][2]["score"] > 0]
    selected.sort(key=lambda x: x[0])

    logger.info("[screen] selected pages: %s", [p for p, _ in selected])
    return selected


def _score_extraction(result: dict) -> int:
    if "error" in result:
        return -1
    priority_hits = sum(1 for f in PRIORITY_FIELDS if result.get(f))
    total_hits = sum(1 for v in result.values() if v and not str(v).startswith("_"))
    return priority_hits * 2 + total_hits


def _select_best(candidates: list[dict]) -> dict:
    scored = [(c, _score_extraction(c)) for c in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    best, best_score = scored[0]
    best["_extraction_score"] = best_score
    return best

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def process_file(file_path: str) -> dict:
    path = Path(file_path)

    if path.suffix.lower() == ".pdf":
        with tempfile.TemporaryDirectory() as tmp_dir:
            image_paths = pdf_to_images(file_path, tmp_dir, dpi=300)
            page_paths  = [(i + 1, p) for i, p in enumerate(image_paths)]

            candidates = _screen_pages(page_paths)
            if not candidates:
                return {"error": "no relevant pages found in document"}

            extractions = []
            for page_num, img_path in candidates:
                logger.info("  [extract] running Qwen-VL on page %d/%d...", page_num, len(page_paths))
                result = parse_json(query_model(img_path, PROMPT)) or {"error": "no json found"}
                result["_page"] = page_num
                extractions.append(result)

        return _select_best(extractions)

    elif path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        result = parse_json(query_model(file_path, PROMPT)) or {"error": "no json found"}
        result["_page"] = 1
        result["_extraction_score"] = _score_extraction(result)
        return result

    else:
        return {"error": f"unsupported file format: {path.suffix}"}
