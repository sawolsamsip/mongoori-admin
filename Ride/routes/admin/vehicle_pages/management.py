from flask import Blueprint, render_template, request, redirect, url_for, session, abort
from db import get_conn
from utils.warranty_utils import get_purchase_warranty_types

vehicle_pages_bp = Blueprint(
    "vehicle_management_pages",
    __name__,
    url_prefix="/admin/vehicles"
)

## vehicle listing
@vehicle_pages_bp.route("/",methods=["GET"])
def vehicle_list_page():
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
            SELECT
                vehicle_id,
                vin,
                plate_number,
                model,
                model_year,
                trim,
                vehicle_status
            FROM vehicle
            ORDER BY plate_number ASC
    """)
    vehicles = cur.fetchall()
    
    return render_template("vehicle_info_management.html", vehicles=vehicles)

## vehicle add page loading 'purchase' warranty options for dropdown list
@vehicle_pages_bp.route("/new", methods = ['GET'])
def vehicle_create_page():
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    
    
    purchase_types = get_purchase_warranty_types()

    return render_template("form_vehicle.html", mode='add', vehicle={}, purchase_types=purchase_types)

@vehicle_pages_bp.route("/<int:vehicle_id>", methods=['GET'])
def vehicle_detail_page(vehicle_id):
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM vehicle WHERE vehicle_id = ?", (vehicle_id,)
    )
    vehicle = cur.fetchone()
    

    if not vehicle:
        abort(404)

    return render_template("form_vehicle.html", mode="detail", vehicle = vehicle)

## dev
@vehicle_pages_bp.route("/v2", methods=['GET'])
def vehicle_list_page_v2():
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    return render_template("vehicle_info_management_rental.html")