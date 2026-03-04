import os
import requests
from flask import Blueprint, jsonify, session

management_api_bp = Blueprint("management_api", __name__, url_prefix="/api/management")

PLATFORM_BASE = os.getenv("PLATFORM_BASE", "http://localhost:3000")

@management_api_bp.get("/cars")
def get_company_cars():
    # if not session.get("admin_logged_in"):
    #     return jsonify(success=False, message="Unauthorized"), 401
    try:
        r = requests.get(f"{PLATFORM_BASE}/api/admin/company-cars", timeout=10)
        r.raise_for_status()
        data = r.json()
        return jsonify(success=True, cars=data.get("cars", []))
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500