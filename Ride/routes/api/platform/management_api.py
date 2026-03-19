import os
import requests
from flask import Blueprint, jsonify, request, session
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


@management_api_bp.post("/finance/sync")
def sync_finance():
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    try:
        data = request.get_json() or {}
        since = data.get("since")  # optional YYYY-MM-DD

        conn = get_conn()
        cur = conn.cursor()

        # Step 1: Resolve category IDs by name (fail fast if seed data is missing)
        cur.execute(
            "SELECT category_id FROM finance_operation_category WHERE name = ? AND type = 'revenue'",
            ("Rental Revenue",)
        )
        row = cur.fetchone()
        if not row:
            return jsonify(success=False, message="Category 'Rental Revenue' not found in finance_operation_category"), 500
        rental_revenue_id = row["category_id"]

        cur.execute(
            "SELECT category_id FROM finance_operation_category WHERE name = ? AND type = 'cost'",
            ("Platform Service Fee",)
        )
        row = cur.fetchone()
        if not row:
            return jsonify(success=False, message="Category 'Platform Service Fee' not found in finance_operation_category"), 500
        platform_fee_id = row["category_id"]

        # Step 2: Fetch invoices from platform
        url = f"{PLATFORM_BASE}/api/admin/finance/invoices"
        if since:
            url += f"?since={since}"

        r = requests.get(url, timeout=10)
        r.raise_for_status()
        invoices = r.json().get("invoices", [])

        synced = 0
        skipped_no_vehicle = 0
        skipped_duplicate = 0

        # Step 3: Process each invoice
        for inv in invoices:
            invoice_id = inv.get("invoiceId")
            car_id = inv.get("carId")
            invoice_number = inv.get("invoiceNumber", "")
            owner_payout = inv.get("ownerPayoutAmount")
            platform_fee = inv.get("platformFee") or 0
            pickup_date = inv.get("pickupDate")

            if not invoice_id or not car_id or not pickup_date or owner_payout is None:
                continue

            # a. Resolve vehicle_id from platform_car_id
            cur.execute(
                "SELECT vehicle_id FROM vehicle WHERE platform_car_id = ?",
                (car_id,)
            )
            vehicle_row = cur.fetchone()
            if not vehicle_row:
                skipped_no_vehicle += 1
                continue
            vehicle_id = vehicle_row["vehicle_id"]

            # b. Check for duplicate (revenue row reference_id = invoice_id)
            cur.execute(
                "SELECT 1 FROM finance_operation_transaction WHERE reference_id = ?",
                (invoice_id,)
            )
            if cur.fetchone():
                skipped_duplicate += 1
                continue

            # c. Insert revenue row
            cur.execute("""
                INSERT INTO finance_operation_transaction
                    (vehicle_id, category_id, amount, transaction_date, reference_id, note)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                vehicle_id,
                rental_revenue_id,
                owner_payout,
                pickup_date,
                invoice_id,
                f"Platform sync: {invoice_number}"
            ))

            # d. Insert cost row only when platformFee > 0
            if platform_fee > 0:
                cur.execute("""
                    INSERT INTO finance_operation_transaction
                        (vehicle_id, category_id, amount, transaction_date, reference_id, note)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    vehicle_id,
                    platform_fee_id,
                    platform_fee,
                    pickup_date,
                    f"{invoice_id}_fee",
                    f"Platform sync: {invoice_number} platform fee"
                ))

            synced += 1

        conn.commit()

        return jsonify(
            success=True,
            fetched=len(invoices),
            synced=synced,
            skipped_no_vehicle=skipped_no_vehicle,
            skipped_duplicate=skipped_duplicate
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