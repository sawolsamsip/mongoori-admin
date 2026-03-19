from flask import Blueprint, request, jsonify, session, redirect, url_for
from db import get_conn
import sqlite3
from utils.time_utils import get_pacific_time, get_pacific_today

vehicle_api_bp = Blueprint(
    "vehicle_api",
    __name__,
    url_prefix="/api/vehicles"
)

@vehicle_api_bp.route("/trims", methods=["GET"])
def get_trims():
    model_name = request.args.get("model_name")
    year = request.args.get("year")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT trim_name
        FROM model_year_trim_exterior
        WHERE model_name=? AND "year"=?
        ORDER BY sort_order;
    """, (model_name, year))
    trims = [r["trim_name"] for r in cur.fetchall()]
    
    return jsonify({"trims": trims})


@vehicle_api_bp.route("/exteriors", methods=["GET"])
def get_exteriors():
    model_name = request.args.get("model_name")
    year = request.args.get("year")
    trim = request.args.get("trim")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT t3.color_name
        FROM model_year_trim_exterior t1
        JOIN color_group t2 ON t1.color_group = t2.group_id
        JOIN colors t3 ON t2.color_id = t3.color_id
        WHERE model_name=? AND "year"=? AND trim_name=?
        ORDER BY sort_order;
    """, (model_name, year, trim))

    exteriors = [r["color_name"] for r in cur.fetchall()]
    
    return jsonify({"exteriors":exteriors})


## del vehicle
@vehicle_api_bp.route("/<int:vehicle_id>", methods=['DELETE'])
def admin_delete_vehicle(vehicle_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))

    if not vehicle_id:
        return jsonify(success=False, message = "Invalid request"), 400
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM vehicle WHERE vehicle_id = ?", (vehicle_id,))

        conn.commit()
        
        return jsonify(success = True, message="Vehicle deleted successfully")
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

## update
@vehicle_api_bp.route("/<int:vehicle_id>", methods=['PUT'])
def admin_update_vehicle(vehicle_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    
    data = request.get_json()

    vin = (data.get("vin") or "").strip().upper()
    make = (data.get("make") or "").strip()
    model = (data.get("model") or "").strip()
    year = (data.get("year") or "").strip()
    trim = (data.get("trim") or "").strip()
    exterior = (data.get("exterior") or "").strip()
    interior = (data.get("interior") or "").strip()
    plate_number = (data.get("plate_number") or "").strip().upper()
    mileage = (data.get("mileage") or "").strip()
    software = (data.get("software") or "").strip()

    errors = {}

    if not vin:
        errors["vin"] = "VIN is required."
    elif len(vin) != 17:
        errors["vin"] = "Incorrect VIN length"
    
    if errors:
        return jsonify(success=False, message = "check the input fields", errors=errors), 422
    
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            UPDATE vehicle
            SET vin = ?, make = ?, model = ?, model_year = ?, trim = ?,
                    exterior = ?, interior = ?, plate_number = ?, mileage = ?,
                    software = ?
            WHERE vehicle_id = ?
            
        """, (vin, make or None, model or None, year or None, trim or None, exterior or None, interior or None, plate_number or None, mileage or None, software or None, vehicle_id))
        conn.commit()
        
    except sqlite3.IntegrityError:
        return jsonify(success=False, message="VIN already exists", errors={"vin": "VIN is already registered."}), 422
    
    return jsonify(
        success = True,
        message="Vehicle updated successfully",
        ), 200

## status update for vehicle management
@vehicle_api_bp.route("/<int:vehicle_id>/status", methods=["PATCH"])
def admin_update_vehicle_status(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}
    new_status = data.get("vehicle_status")

    if new_status not in ("Active", "Maintenance", "Archived"):
        return jsonify(success=False, message="Invalid status value"), 422

    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            UPDATE vehicle
            SET vehicle_status = ?
            WHERE vehicle_id = ?
        """, (new_status, vehicle_id))

        if cur.rowcount == 0:
            return jsonify(success=False, message="Vehicle not found"), 404

        conn.commit()

    except Exception as e:
        conn.rollback()
        return jsonify(success=False, message="Status update failed", error=str(e)), 500

    return jsonify(success=True, message="Vehicle status updated successfully.")


## add vehicle
@vehicle_api_bp.route('/', methods = ['POST'])
def admin_create_vehicle():
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))

    data = request.get_json()

    vin = (data.get("vin") or "").strip().upper()
    make = (data.get("make") or "").strip()
    model = (data.get("model") or "").strip()
    year = (data.get("year") or "").strip()
    trim = (data.get("trim") or "").strip()
    exterior = (data.get("exterior") or "").strip()
    interior = (data.get("interior") or "").strip()
    plate_number = (data.get("plate_number") or "").strip().upper()
    mileage = (data.get("mileage") or "").strip()
    software = (data.get("software") or "").strip()

    errors = {}

    if not vin:
        errors["vin"] = "VIN is required."
    elif len(vin) != 17:
        errors["vin"] = "Incorrect VIN length"
    
    if errors:
        return jsonify(success=False, message="VIN Validation failed", errors=errors), 422
    
    ## warranty list
    warranties = data.get("warranties", [])
    if not isinstance(warranties, list):
        return jsonify(success=False, message="Invalid warranties format"), 422
    
    try:
        conn = get_conn()
        cur = conn.cursor()
        ## insert vehicle data
        cur.execute("""
            INSERT INTO vehicle (vin, make, model, model_year, trim, exterior, interior, plate_number, mileage, software, vehicle_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        """, (vin, make or None, model or None, year or None, trim or None, exterior or None, interior or None, plate_number or None, mileage or None, software or None, get_pacific_time()))
        
        vehicle_id = cur.lastrowid
        ## insert common warranty data
        # insert warranties
        for w in warranties:
            wtype = w.get("type")
            if not wtype:
                continue

            exp_date = (w.get("expire_date") or "").strip() or None
            raw_miles = (w.get("expire_miles") or "").strip()
            exp_miles = int(raw_miles) if raw_miles.isdigit() else None

            # insert into vehicle_warranty
            cur.execute("""
                INSERT INTO vehicle_warranty (vehicle_id, warranty_type_id, category)
                SELECT ?, warranty_type_id, category
                FROM warranty_type WHERE warranty_type_id = ?
            """, (vehicle_id, wtype))
            
            vw_id = cur.lastrowid

            # insert into warranty_purchase
            cur.execute("""
                INSERT INTO warranty_purchase (vehicle_warranty_id, expire_date, expire_miles)
                VALUES (?, ?, ?)
            """, (vw_id, exp_date, exp_miles))

        conn.commit()
        
    except sqlite3.IntegrityError:
        conn.rollback()
        
        return jsonify(success=False, message="VIN already exists", errors={"vin": "VIN is already registered."}
                       ), 422
    
    except Exception as e:
        conn.rollback()
        
        return jsonify(success=False, message="Insert failed", error=str(e)), 500

    return jsonify(success=True, message="Vehicle successfully added."), 201

## operation
@vehicle_api_bp.route("/<int:vehicle_id>", methods=["GET"])
def get_vehicle(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            v.vehicle_id,
            v.plate_number,
            v.vin,
            v.model,
            v.model_year,
            v.trim,

            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM vehicle_fleet vf
                    WHERE vf.vehicle_id = v.vehicle_id
                      AND vf.registered_to IS NULL
                )
                THEN 'ACTIVE'
                ELSE 'INACTIVE'
            END AS operation_status

        FROM vehicle v

        WHERE v.vehicle_id = ?
    """, (vehicle_id,))

    row = cur.fetchone()
    if not row:
        return jsonify(success=False, message="Vehicle not found"), 404

    return jsonify(
        success=True,
        vehicle={
            "vehicle_id": row["vehicle_id"],
            "plate_number": row["plate_number"],
            "vin": row["vin"],
            "model": row["model"],
            "model_year": row["model_year"],
            "trim": row["trim"],
            "operation_status": row["operation_status"],
        }
    )

## fleet ##
@vehicle_api_bp.route("/<int:vehicle_id>/fleets", methods=["POST"])
def register_vehicle_fleet(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}

    fleet_service_id = data.get("fleet_service_id")
    registered_from = data.get("registered_from")

    if not fleet_service_id or not registered_from:
        return jsonify(
            success=False,
            message="fleet_service_id and registered_from are required."
        ), 400

    conn = get_conn()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO vehicle_fleet (
                vehicle_id,
                fleet_service_id,
                registered_from
            )
            VALUES (?, ?, ?)
        """, (
            vehicle_id,
            fleet_service_id,
            registered_from
        ))

        conn.commit()

        return jsonify(
            success=True,
            message="Fleet registered successfully."
        ), 201

    except Exception as e:
        conn.rollback()
        return jsonify(
            success=False,
            message=str(e)
        ), 500

## load fleet list for a given vehicle    
@vehicle_api_bp.route("/<int:vehicle_id>/fleets", methods=["GET"])
def get_vehicle_fleets(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            vf.vehicle_fleet_id,
            vf.vehicle_id,
            vf.fleet_service_id,
            fs.name AS fleet_name,
            vf.registered_from,
            vf.registered_to
        FROM vehicle_fleet vf
        JOIN fleet_service fs
            ON vf.fleet_service_id = fs.fleet_service_id
        WHERE vf.vehicle_id = ?
        ORDER BY vf.registered_from DESC
    """, (vehicle_id,))

    rows = cur.fetchall()

    fleets = []
    for row in rows:
        fleets.append({
            "vehicle_fleet_id": row["vehicle_fleet_id"],
            "fleet_service_id": row["fleet_service_id"],
            "fleet_name": row["fleet_name"],
            "registered_from": row["registered_from"],
            "registered_to": row["registered_to"]
        })

    return jsonify(
        success=True,
        fleets=fleets
    ), 200


