import os
import requests
from flask import Blueprint, jsonify, session, request
from db import get_conn

management_api_bp = Blueprint("management_api", __name__, url_prefix="/api/management")

PLATFORM_BASE = os.getenv("PLATFORM_BASE", "http://localhost:3000")

@management_api_bp.post("/cars/sync")
def sync_company_cars():

    try:
        r = requests.get(f"{PLATFORM_BASE}/api/admin/company-cars", timeout=10)
        r.raise_for_status()
        cars = r.json().get("cars", [])

        conn = get_conn()
        cur = conn.cursor()

        inserted_count = 0
        updated_count = 0
        skipped_count = 0

        for car in cars:

            platform_car_id = car.get("_id")
            if not platform_car_id:
                skipped_count += 1
                continue

            cur.execute(
                "SELECT vehicle_platform_id FROM vehicle_platform WHERE platform_car_id = ?",
                (platform_car_id,)
            )
            existing = cur.fetchone()

            vin = (car.get("vin") or "").strip()
            model = car.get("model")
            model_year = car.get("modelYear")
            trim = car.get("trim")
            tesla_vehicle_id = car.get("teslaVehicleId")
            is_available = 1 if car.get("isAvailable") else 0
            platform_updated_at = car.get("updatedAt")

            cur.execute("""
                INSERT INTO vehicle_platform (
                    platform_car_id,
                    vin,
                    tesla_vehicle_id,
                    model,
                    model_year,
                    trim,
                    is_available,
                    platform_updated_at,
                    last_sync_at,
                    last_seen_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, datetime('now'), datetime('now'),
                    datetime('now'), datetime('now')
                )
                ON CONFLICT(platform_car_id) DO UPDATE SET
                    vin = excluded.vin,
                    tesla_vehicle_id = excluded.tesla_vehicle_id,
                    model = excluded.model,
                    model_year = excluded.model_year,
                    trim = excluded.trim,
                    is_available = excluded.is_available,
                    platform_updated_at = excluded.platform_updated_at,
                    last_sync_at = datetime('now'),
                    last_seen_at = datetime('now'),
                    updated_at = datetime('now')
            """, (
                platform_car_id,
                vin if vin else None,
                tesla_vehicle_id,
                model,
                model_year,
                trim,
                is_available,
                platform_updated_at
            ))

            if existing:
                updated_count += 1
            else:
                inserted_count += 1

        conn.commit()

        return jsonify(
            success=True,
            fetched=len(cars),
            inserted=inserted_count,
            updated=updated_count,
            skipped=skipped_count
        )

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    
@management_api_bp.get("/cars")
def get_company_cars():
    # if not session.get("admin_logged_in"):
    #     return jsonify(success=False, message="Unauthorized"), 401

    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                vehicle_platform_id,
                platform_car_id,
                plate_number,
                vin,
                tesla_vehicle_id,
                model,
                model_year,
                trim,
                is_available,
                vehicle_status,
                platform_updated_at,
                last_sync_at,
                last_seen_at,
                created_at,
                updated_at
            FROM vehicle_platform
            ORDER BY created_at DESC
        """)

        rows = cur.fetchall()

        cars = []
        for r in rows:
            cars.append({
                "vehicle_platform_id": r["vehicle_platform_id"],
                "platform_car_id": r["platform_car_id"],
                "plate_number": r["plate_number"],
                "vin": r["vin"],
                "tesla_vehicle_id": r["tesla_vehicle_id"],
                "model": r["model"],
                "model_year": r["model_year"],
                "trim": r["trim"],
                "is_available": r["is_available"],
                "vehicle_status": r["vehicle_status"],
                "platform_updated_at": r["platform_updated_at"],
                "last_sync_at": r["last_sync_at"],
                "last_seen_at": r["last_seen_at"]
            })

        return jsonify(success=True, cars=cars)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    
@management_api_bp.put("/cars/<int:vehicle_platform_id>/plate")
def update_car_plate(vehicle_platform_id):
    try:
        data = request.get_json() or {}
        plate_number = (data.get("plate_number") or "").strip()

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            UPDATE vehicle_platform
            SET plate_number = ?,
                updated_at = datetime('now')
            WHERE vehicle_platform_id = ?
        """, (
            plate_number if plate_number else None,
            vehicle_platform_id
        ))

        if cur.rowcount == 0:
            return jsonify(success=False, message="Vehicle not found"), 404

        conn.commit()

        return jsonify(
            success=True,
            vehicle_platform_id=vehicle_platform_id,
            plate_number=plate_number if plate_number else None
        )

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500