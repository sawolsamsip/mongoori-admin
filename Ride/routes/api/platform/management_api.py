import os
import requests
from flask import Blueprint, jsonify, request
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
                "SELECT vehicle_id FROM vehicle WHERE platform_car_id = ?",
                (platform_car_id,)
            )
            existing = cur.fetchone()

            vin = (car.get("vin") or "").strip()
            model = car.get("model")
            model_year = car.get("year")
            trim = car.get("trim")
            tesla_vehicle_id = car.get("teslaVehicleId")
            plate_number = (car.get("plate_number") or "").strip()
            is_available = 1 if car.get("isAvailable") else 0
            platform_updated_at = car.get("updatedAt")

            cur.execute("""
                INSERT INTO vehicle (
                    platform_car_id,
                    vin,
                    tesla_vehicle_id,
                    plate_number,
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
                    ?, ?, ?, ?, ?, ?, ?, ?,
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
                plate_number if plate_number else None,
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
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                vehicle_id,
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
            FROM vehicle
            ORDER BY created_at DESC
        """)

        rows = cur.fetchall()

        cars = []
        for r in rows:
            cars.append({
                "vehicle_id": r["vehicle_id"],
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
                "last_seen_at": r["last_seen_at"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            })

        return jsonify(success=True, cars=cars)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@management_api_bp.put("/cars/<int:vehicle_id>/plate")
def update_car_plate(vehicle_id):
    try:
        data = request.get_json() or {}
        plate_number = (data.get("plate_number") or "").strip()

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            UPDATE vehicle
            SET plate_number = ?,
                updated_at = datetime('now')
            WHERE vehicle_id = ?
        """, (
            plate_number if plate_number else None,
            vehicle_id
        ))

        if cur.rowcount == 0:
            return jsonify(success=False, message="Vehicle not found"), 404

        conn.commit()

        return jsonify(
            success=True,
            vehicle_id=vehicle_id,
            plate_number=plate_number if plate_number else None
        )

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500