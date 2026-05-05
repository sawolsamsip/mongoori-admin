from flask import Blueprint, request, jsonify, session
from db import get_conn

purchase_invoice_api_bp = Blueprint(
    "purchase_invoice_api", __name__, url_prefix="/api/purchase-invoice"
)


@purchase_invoice_api_bp.route("/vehicles/<int:vehicle_id>", methods=["POST"])
def save_purchase_invoice(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}

    purchase_date = data.get("purchase_date")
    vehicle_price = data.get("vehicle_price")

    if not purchase_date:
        return jsonify(success=False, message="Purchase date is required"), 400
    if not vehicle_price:
        return jsonify(success=False, message="Vehicle price is required"), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT category_id FROM finance_management_category
        WHERE name = 'Vehicle Purchase Price' AND type = 'cost'
    """)
    cat_row = cur.fetchone()
    if not cat_row:
        return jsonify(success=False, message="'Vehicle Purchase Price' category not found in DB"), 500
    category_id = cat_row["category_id"]

    # Pack all supplemental fields into a structured note
    note_parts = []
    if data.get("dealer"):            note_parts.append(f"Dealer: {data['dealer']}")
    if data.get("sales_tax"):         note_parts.append(f"Sales Tax/Fees: ${data['sales_tax']}")
    if data.get("out_the_door"):      note_parts.append(f"Out-the-door: ${data['out_the_door']}")
    if data.get("down_payment"):      note_parts.append(f"Down Payment: ${data['down_payment']}")
    if data.get("financed_amount"):   note_parts.append(f"Financed: ${data['financed_amount']}")
    if data.get("apr"):               note_parts.append(f"APR: {data['apr']}%")
    if data.get("loan_term"):         note_parts.append(f"Term: {data['loan_term']} months")
    if data.get("monthly_payment"):   note_parts.append(f"Monthly: ${data['monthly_payment']}")
    if data.get("first_payment_date"):note_parts.append(f"First payment: {data['first_payment_date']}")
    if data.get("notes"):             note_parts.append(data["notes"])
    note = " | ".join(note_parts) if note_parts else None

    try:
        cur.execute("""
            INSERT INTO finance_management_transaction (
                vehicle_id, category_id, payment_type, event_date, total_amount, note
            ) VALUES (?, ?, 'one_time', ?, ?, ?)
        """, (vehicle_id, category_id, purchase_date, vehicle_price, note))

        conn.commit()
        return jsonify(success=True), 201

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
