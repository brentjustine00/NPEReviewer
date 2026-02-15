import json

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import AISuggestionLog
from ..services.ai_service import generate_suggestions

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/suggestions", methods=["GET", "POST"])
@jwt_required()
def suggestions():
    user_id = int(get_jwt_identity())
    attempt_id = request.args.get("attempt_id")
    data = request.get_json(silent=True) or {}

    payload = {
        "nl_breakdown": data.get("nl_breakdown", []),
        "missed_topics": data.get("missed_topics", []),
        "elapsed_seconds": data.get("elapsed_seconds"),
        "historical_attempts": data.get("historical_attempts", []),
    }
    ai_result = generate_suggestions(payload)

    if attempt_id:
        log = AISuggestionLog(user_id=user_id, exam_attempt_id=int(attempt_id), payload=json.dumps(ai_result))
        db.session.add(log)
        db.session.commit()

    return ai_result
