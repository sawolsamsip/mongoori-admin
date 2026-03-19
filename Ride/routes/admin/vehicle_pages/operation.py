from flask import Blueprint, render_template, request, redirect, url_for, session, abort
from db import get_conn

vehicle_operation_pages_bp = Blueprint(
    "vehicle_operation_pages",
    __name__,
    url_prefix = "/admin/vehicles/operation"
)

## vehicle listing
@vehicle_operation_pages_bp.route("/",methods=["GET"])
def vehicle_list_page():
    if not session.get("admin_logged_in"):
        return redirect(url_for("auth.admin_login"))
    
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

                WHERE v.vehicle_status = 'Active'

                ORDER BY v.vehicle_id;
                """)
    vehicles = cur.fetchall()
    
    return render_template("vehicle_info_operation.html", vehicles=vehicles)
