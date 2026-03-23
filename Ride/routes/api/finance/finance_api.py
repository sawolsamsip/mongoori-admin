from flask import Blueprint, request, jsonify, session
from db import get_conn
from utils.time_utils import get_pacific_time

finance_api_bp = Blueprint(
    "finance_api",
    __name__,
    url_prefix="/api/finance"
)


## save cost/revenue from management page - one-time
@finance_api_bp.route(
    "/management/vehicles/<int:vehicle_id>/transactions",
    methods=["POST"]
)
def create_management_transaction(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}

    category_id = data.get("category_id")
    payment_type = data.get("payment_type")
    amount = data.get("amount")
    event_date = data.get("transaction_date")  # frontend sends as transaction_date
    note = data.get("note")

    if not category_id or not payment_type or not amount or not event_date:
        return jsonify(success=False, message="Missing required fields"), 400

    conn = get_conn()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO finance_management_transaction (
                vehicle_id,
                category_id,
                payment_type,
                event_date,
                total_amount,
                note
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            vehicle_id,
            category_id,
            payment_type,
            event_date,
            amount,
            note
        ))

        conn.commit()

        return jsonify(success=True), 201

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


## save cost/revenue from management page - monthly, installment

@finance_api_bp.route(
    "/management/vehicles/<int:vehicle_id>/contracts",
    methods=["POST"]
)
def create_management_contract(vehicle_id):
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}

    category_id = data.get("category_id")
    contract_type = data.get("payment_type")

    start_date = data.get("start_date")
    end_date = data.get("end_date")
    monthly_amount = data.get("monthly_amount")
    total_amount = data.get("total_amount")
    months = data.get("months")
    note = data.get("note")

    if contract_type not in ("monthly", "installment"):
        return jsonify(success=False, message="Invalid contract type"), 400

    if not category_id or not start_date or not monthly_amount:
        return jsonify(success=False, message="Missing required fields"), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO finance_management_contract (
            vehicle_id,
            category_id,
            contract_type,
            start_date,
            end_date,
            monthly_amount,
            total_amount,
            months,
            note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vehicle_id,
        category_id,
        contract_type,
        start_date,
        end_date,
        monthly_amount,
        total_amount,
        months,
        note
    ))

    conn.commit()

    return jsonify(success=True), 201


## Manage Finance- mangement: load category to fill modal
@finance_api_bp.route("/management/categories", methods=["GET"])
def get_ownership_categories():
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    type_ = request.args.get("type")

    if not type_:
        return jsonify(
            success=False,
            message="type is required"
        ), 400

    if type_ not in ("cost", "revenue"):
        return jsonify(
            success=False,
            message="Invalid type"
        ), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            category_id,
            name,
            type,
            description
        FROM finance_management_category
        WHERE type = ?
        ORDER BY name ASC
    """, (type_,))

    rows = cur.fetchall()

    categories = [
        {
            "category_id": r["category_id"],
            "name": r["name"],
            "type": r["type"],
            "description": r["description"]
        }
        for r in rows
    ]

    return jsonify(success=True, categories=categories), 200

## Manage Finance- operation: load category to fill modal
@finance_api_bp.route("/operation/categories", methods=["GET"])
def get_operation_categories():
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    type_ = request.args.get("type")
    if type_ not in ("cost", "revenue"):
        return jsonify(success=False, message="Invalid type"), 400

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            category_id,
            name,
            type,
            scope,
            description
        FROM finance_operation_category
        WHERE type = ?
        ORDER BY category_id ASC
    """, (type_,))

    categories = [dict(r) for r in cur.fetchall()]
    return jsonify(success=True, categories=categories), 200

## Manage Finance- operation: load fleet category to fill modal
@finance_api_bp.route("/fleets", methods=["GET"])
def get_fleet_services():
    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT fleet_service_id, name
        FROM fleet_service
        ORDER BY fleet_service_id ASC
    """)

    fleets = [dict(r) for r in cur.fetchall()]

    return jsonify(success=True, fleets=fleets), 200


## Manage Finance- operation: save
@finance_api_bp.route(
    "/operations/vehicles/<int:vehicle_id>/transactions",
    methods=["POST"]
)
def create_operation_transaction(vehicle_id):

    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    data = request.get_json() or {}

    category_id = data.get("category_id")
    fleet_service_id = data.get("fleet_service_id")
    transaction_date = data.get("transaction_date")
    amount = data.get("amount")
    note = data.get("note")

    if not category_id or not transaction_date or amount is None:
        return jsonify(
            success=False,
            message="category_id, transaction_date, amount are required"
        ), 400

    try:
        amount = float(amount)
        category_id = int(category_id)
    except:
        return jsonify(success=False, message="Invalid numeric value"), 400

    conn = get_conn()
    cur = conn.cursor()

    if fleet_service_id:
        fleet_service_id = int(fleet_service_id)
    else:
        fleet_service_id = None

    cur.execute("""
        INSERT INTO finance_operation_transaction (
            vehicle_id,
            fleet_service_id,
            category_id,
            amount,
            transaction_date,
            note
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        vehicle_id,
        fleet_service_id,
        category_id,
        amount,
        transaction_date,
        note
    ))

    conn.commit()

    return jsonify(success=True), 201

## Dashboard
@finance_api_bp.route("/timeseries", methods=["GET"])
def get_finance_timeseries():

    if not session.get("admin_logged_in"):
        return jsonify(success=False, message="Unauthorized"), 401

    window = request.args.get("window", 12)
    mode = request.args.get("mode", "operation")

    try:
        window = int(window)
    except:
        window = 12

    conn = get_conn()
    cur = conn.cursor()

    date_filter = """
        date >= date('now', ?, 'start of month')
        AND date <= date('now', 'start of month', '+1 month', '-1 day')
    """

    # FULL MODE: operation + management
    if mode == "full":
        query = f"""
            SELECT
                strftime('%Y', tx_date) AS year,
                strftime('%m', tx_date) AS month,
                SUM(revenue) AS revenue,
                SUM(expense) AS expense
            FROM (
                -- Operation
                SELECT
                    ot.transaction_date AS tx_date,
                    CASE WHEN oc.type='revenue' THEN ot.amount ELSE 0 END AS revenue,
                    CASE WHEN oc.type='cost' THEN ot.amount ELSE 0 END AS expense
                FROM finance_operation_transaction ot
                JOIN finance_operation_category oc
                    ON ot.category_id = oc.category_id

                UNION ALL

                -- Management
                SELECT
                    mt.event_date AS tx_date,
                    CASE WHEN mc.type='revenue' THEN mt.total_amount ELSE 0 END AS revenue,
                    CASE WHEN mc.type='cost' THEN mt.total_amount ELSE 0 END AS expense
                FROM finance_management_transaction mt
                JOIN finance_management_category mc
                    ON mt.category_id = mc.category_id
            ) AS combined
            WHERE tx_date >= date('now', ?, 'start of month')
            AND tx_date <= date('now', 'start of month', '+1 month', '-1 day')
            GROUP BY year, month
            ORDER BY year, month
        """
    else:
        query = f"""
            SELECT
                strftime('%Y', ot.transaction_date) AS year,
                strftime('%m', ot.transaction_date) AS month,
                SUM(CASE WHEN oc.type='revenue' THEN ot.amount ELSE 0 END) AS revenue,
                SUM(CASE WHEN oc.type='cost' THEN ot.amount ELSE 0 END) AS expense
            FROM finance_operation_transaction ot
            JOIN finance_operation_category oc
                ON ot.category_id = oc.category_id
            WHERE ot.transaction_date >= date('now', ?, 'start of month')
            AND ot.transaction_date <= date('now', 'start of month', '+1 month', '-1 day')
            GROUP BY year, month
            ORDER BY year, month
        """

    cur.execute(query, (f"-{window-1} months",))
    rows = cur.fetchall()

    labels, revenue, expense, net = [], [], [], []

    for r in rows:
        y = r["year"]
        m = r["month"]
        rev = r["revenue"] or 0
        exp = r["expense"] or 0

        labels.append(f"{y}-{m}")
        revenue.append(rev)
        expense.append(exp)
        net.append(rev - exp)

    return jsonify(
        success=True,
        mode=mode,
        window=window,
        data={
            "labels": labels,
            "revenue": revenue,
            "expense": expense,
            "net": net
        }
    ), 200

## monthly detail
@finance_api_bp.route("/monthly-details", methods=["GET"])
def get_monthly_details():

    if not session.get("admin_logged_in"):
        return jsonify(success=False), 401

    month = request.args.get("month")  # "2026-02"
    mode = request.args.get("mode", "operation")
    type_ = request.args.get("type")   # revenue / expense

    if not month:
        return jsonify(success=False), 400

    year, month_num = month.split("-")

    conn = get_conn()
    cur = conn.cursor()

    if mode == "full":
        query = """
            SELECT
                tx_date,
                category_name,
                amount,
                source
            FROM (
                SELECT
                    ot.transaction_date AS tx_date,
                    oc.name AS category_name,
                    ot.amount,
                    'operation' AS source,
                    oc.type
                FROM finance_operation_transaction ot
                JOIN finance_operation_category oc
                    ON ot.category_id = oc.category_id

                UNION ALL

                SELECT
                    mt.event_date AS tx_date,
                    mc.name AS category_name,
                    mt.total_amount AS amount,
                    'management' AS source,
                    mc.type
                FROM finance_management_transaction mt
                JOIN finance_management_category mc
                    ON mt.category_id = mc.category_id
            )
            WHERE strftime('%Y', tx_date) = ?
              AND strftime('%m', tx_date) = ?
              AND type = ?
            ORDER BY tx_date ASC
        """

        cur.execute(query, (year, month_num, type_))

    else:
        query = """
            SELECT
                ot.transaction_date AS tx_date,
                oc.name AS category_name,
                ot.amount,
                'operation' AS source
            FROM finance_operation_transaction ot
            JOIN finance_operation_category oc
                ON ot.category_id = oc.category_id
            WHERE strftime('%Y', ot.transaction_date) = ?
              AND strftime('%m', ot.transaction_date) = ?
              AND oc.type = ?
            ORDER BY ot.transaction_date ASC
        """

        cur.execute(query, (year, month_num, type_))

    rows = [dict(r) for r in cur.fetchall()]

    return jsonify(success=True, data=rows)