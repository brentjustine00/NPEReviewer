from flask import Blueprint

from ..models import NLCategory
from ..services.exam_service import get_questions_for_nl

nl_bp = Blueprint("nl", __name__)


@nl_bp.get("/nl-categories")
def get_categories():
    rows = NLCategory.query.all()
    return [
        {
            "id": r.id,
            "code": r.code,
            "title": r.title,
            "icon": r.icon,
        }
        for r in rows
    ]


@nl_bp.get("/questions/<int:nl_id>")
def get_questions_by_category(nl_id: int):
    return {"questions": get_questions_for_nl(nl_id)}
