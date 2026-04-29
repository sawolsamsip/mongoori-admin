import os
import uuid
import tempfile
from flask import Blueprint, request, jsonify, session
from services.invoice.extractor import extract_invoice

invoice_api_bp = Blueprint('invoice_api', __name__)


@invoice_api_bp.route('/api/invoice/parse', methods=['POST'])
def parse_invoice():
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return jsonify({'success': False, 'message': 'Only PDF files are accepted'}), 400

    tmp_path = os.path.join(tempfile.gettempdir(), f"invoice_{uuid.uuid4().hex}.pdf")

    try:
        file.save(tmp_path)
        result = extract_invoice(tmp_path)

        if 'error' in result:
            return jsonify({'success': False, 'message': result['error']}), 422

        return jsonify({'success': True, 'data': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
