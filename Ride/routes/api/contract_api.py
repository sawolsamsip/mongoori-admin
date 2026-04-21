import os
import uuid
import tempfile
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from services.contract_parser import process_file

contract_api_bp = Blueprint('contract_api', __name__)

_ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}


def _allowed(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in _ALLOWED_EXTENSIONS


@contract_api_bp.route('/api/contract/parse', methods=['POST'])
def parse_contract():
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename or not _allowed(file.filename):
        return jsonify({
            'success': False,
            'message': 'Invalid file type. Allowed: PDF, PNG, JPG, JPEG'
        }), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    tmp_path = os.path.join(tempfile.gettempdir(), f"contract_{uuid.uuid4().hex}.{ext}")

    try:
        file.save(tmp_path)
        result = process_file(tmp_path)

        if 'error' in result:
            return jsonify({'success': False, 'message': result['error']}), 422

        return jsonify({'success': True, 'data': result})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
