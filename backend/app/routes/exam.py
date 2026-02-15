import json

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import AISuggestionLog, ExamAttempt, NLCategory
from ..services.exam_service import (
    build_attempt_analytics,
    build_attempt_answer_review,
    get_questions_for_nl,
    start_exam,
    submit_exam,
)
from ..services.ai_service import generate_suggestions

exam_bp = Blueprint("exam", __name__)


def _synthesize_analytics_from_attempt(attempt: ExamAttempt):
    categories = NLCategory.query.order_by(NLCategory.id.asc()).all()
    if not categories:
        return {"nl_breakdown": [], "missed_topics": []}

    total = int(attempt.total_questions or 0)
    if total <= 0:
        total = 100 if attempt.mode == "practice" else 500
    score = float(attempt.score or 0.0)
    correct_total = max(0, min(total, round((score / 100.0) * total)))

    n = len(categories)
    base_total = total // n
    total_remainder = total % n
    base_correct = correct_total // n
    correct_remainder = correct_total % n

    breakdown = []
    for idx, cat in enumerate(categories):
        cat_total = base_total + (1 if idx < total_remainder else 0)
        cat_correct = min(cat_total, base_correct + (1 if idx < correct_remainder else 0))
        cat_score = round((cat_correct / cat_total) * 100, 2) if cat_total else 0
        breakdown.append(
            {
                "nl_code": cat.code,
                "correct": cat_correct,
                "total": cat_total,
                "score": cat_score,
            }
        )

    weakest = sorted(breakdown, key=lambda x: x["score"])[:2]
    missed_topics = [
        {
            "topic": f"{row['nl_code']} reinforcement topics",
            "misses": max(1, row["total"] - row["correct"]),
        }
        for row in weakest
    ]
    return {"nl_breakdown": breakdown, "missed_topics": missed_topics}


@exam_bp.get("/questions/<int:nl_id>")
@jwt_required()
def get_questions(nl_id: int):
    limit = int(request.args.get("limit", 100))
    return {"questions": get_questions_for_nl(nl_id, limit=limit)}


@exam_bp.post("/start")
@jwt_required()
def start():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    mode = (data.get("mode") or "practice").lower()
    nl_category_id = data.get("nl_category_id")

    if mode not in {"practice", "full"}:
        return {"error": "mode must be practice or full"}, 400
    if mode == "practice" and not nl_category_id:
        return {"error": "nl_category_id required for practice"}, 400

    attempt, questions = start_exam(user_id=user_id, mode=mode, nl_category_id=nl_category_id)
    if len(questions) == 0:
        return {
            "error": "No questions available. Seed NP categories/questions first.",
            "mode": mode,
        }, 409
    return {
        "attempt_id": attempt.id,
        "mode": attempt.mode,
        "total_questions": attempt.total_questions,
        "questions": questions,
    }


@exam_bp.post("/submit")
@jwt_required()
def submit():
    data = request.get_json() or {}
    attempt_id = data.get("attempt_id")
    answers = data.get("answers") or []
    elapsed_seconds = data.get("elapsed_seconds")

    if not attempt_id:
        return {"error": "attempt_id required"}, 400

    attempt = ExamAttempt.query.get(attempt_id)
    if not attempt:
        return {"error": "attempt not found"}, 404

    result = submit_exam(attempt, answers, elapsed_seconds=elapsed_seconds)
    return result


@exam_bp.get("/history")
@jwt_required()
def history():
    user_id = int(get_jwt_identity())
    rows = (
        ExamAttempt.query.filter(
            ExamAttempt.user_id == user_id,
            ExamAttempt.submitted_at.isnot(None),
        )
        .order_by(ExamAttempt.started_at.desc())
        .limit(50)
        .all()
    )
    items = [
        {
            "id": x.id,
            "mode": x.mode,
            "nl_category_id": x.nl_category_id,
            "started_at": x.started_at.isoformat(),
            "submitted_at": x.submitted_at.isoformat() if x.submitted_at else None,
            "score": x.score,
            "passed": x.passed,
            "total_questions": x.total_questions,
            "elapsed_seconds": x.elapsed_seconds,
        }
        for x in rows
    ]
    full_kept = False
    filtered = []
    for item in items:
        if item["mode"] == "full":
            if full_kept:
                continue
            full_kept = True
        filtered.append(item)
    return filtered


@exam_bp.get("/history/<int:attempt_id>")
@jwt_required()
def history_detail(attempt_id: int):
    user_id = int(get_jwt_identity())
    attempt = ExamAttempt.query.filter_by(id=attempt_id, user_id=user_id).first()
    if not attempt:
        return {"error": "attempt not found"}, 404

    analytics = build_attempt_analytics(attempt.id)
    if not analytics["nl_breakdown"]:
        analytics = _synthesize_analytics_from_attempt(attempt)
    ai_log = (
        AISuggestionLog.query.filter_by(user_id=user_id, exam_attempt_id=attempt.id)
        .order_by(AISuggestionLog.created_at.desc())
        .first()
    )

    ai_suggestion = None
    if ai_log:
        try:
            ai_suggestion = json.loads(ai_log.payload)
        except json.JSONDecodeError:
            ai_suggestion = {"weakness_summary": ai_log.payload}
    else:
        payload = {
            "nl_breakdown": analytics["nl_breakdown"],
            "missed_topics": analytics["missed_topics"],
            "elapsed_seconds": attempt.elapsed_seconds,
        }
        try:
            ai_suggestion = generate_suggestions(payload)
        except Exception:
            ai_suggestion = {
                "weakness_summary": "Focus on low-scoring NP areas and most-missed topics.",
                "study_recommendations": [
                    "Review your weakest NP area first.",
                    "Practice the top missed topics in timed sets.",
                    "Retake a mixed set after reinforcement.",
                ],
                "priority_nl_subjects": [x["nl_code"] for x in analytics["nl_breakdown"][:3]],
                "encouraging_feedback": "Keep consistency and your score trend will improve.",
            }
        log = AISuggestionLog(user_id=user_id, exam_attempt_id=attempt.id, payload=json.dumps(ai_suggestion))
        db.session.add(log)
        db.session.commit()

    return {
        "attempt": {
            "id": attempt.id,
            "mode": attempt.mode,
            "nl_category_id": attempt.nl_category_id,
            "started_at": attempt.started_at.isoformat(),
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "score": attempt.score,
            "passed": attempt.passed,
            "total_questions": attempt.total_questions,
            "elapsed_seconds": attempt.elapsed_seconds,
        },
        "nl_breakdown": analytics["nl_breakdown"],
        "missed_topics": analytics["missed_topics"],
        "ai_suggestion": ai_suggestion,
        "answer_review": build_attempt_answer_review(attempt.id),
    }
