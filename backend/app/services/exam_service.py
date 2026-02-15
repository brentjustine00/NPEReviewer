import random
import re
from collections import defaultdict
from datetime import datetime

from sqlalchemy.sql.expression import func
from sqlalchemy.orm import aliased

from ..extensions import db
from ..models import Choice, ExamAttempt, ExamResult, NLCategory, Question

PRACTICE_QUESTION_COUNT = 100
FULL_EXAM_QUESTION_COUNT = 500

_FINGERPRINT_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "what",
    "which",
    "when",
    "where",
    "your",
    "their",
    "into",
    "during",
    "after",
    "before",
    "have",
    "has",
    "should",
    "nurse",
    "client",
    "patient",
    "care",
    "nursing",
    "practice",
}


def serialize_choice(choice: Choice):
    return {"id": choice.id, "body": choice.body}


def serialize_question(question: Question):
    shuffled = list(question.choices)
    random.shuffle(shuffled)
    return {
        "id": question.id,
        "prompt": question.prompt,
        "topic": question.topic,
        "choices": [serialize_choice(c) for c in shuffled],
    }


def _pick_unique_by_prompt(questions: list[Question], count: int, seen_prompts: set[str] | None = None):
    chosen: list[Question] = []
    seen = seen_prompts if seen_prompts is not None else set()
    for q in questions:
        key = _question_fingerprint(q.prompt)
        if key in seen:
            continue
        seen.add(key)
        chosen.append(q)
        if len(chosen) >= count:
            break
    return chosen


def _question_fingerprint(text: str):
    core = (text or "").strip().lower()
    core = re.sub(r"^nursing practice\s+[ivx]+\s*\(.*?\)\s*-\s*", "", core)
    core = re.sub(r"^(curated|palmer|template case|external case)\s*[\w\-#]*:\s*", "", core)
    core = re.sub(r"[^a-z0-9\s]", " ", core)
    tokens = [t for t in core.split() if len(t) > 2 and t not in _FINGERPRINT_STOPWORDS]
    if not tokens:
        return ""
    return " ".join(tokens[:24])


def get_questions_for_nl(nl_id: int, limit: int = PRACTICE_QUESTION_COUNT):
    pool = Question.query.filter_by(nl_category_id=nl_id).order_by(func.random()).all()
    questions = _pick_unique_by_prompt(pool, limit)
    return [serialize_question(q) for q in questions]

def get_questions_by_ids(question_ids: list[int]):
    if not question_ids:
        return []
    rows = Question.query.filter(Question.id.in_(question_ids)).all()
    by_id = {q.id: q for q in rows}
    ordered = [by_id[qid] for qid in question_ids if qid in by_id]
    return [serialize_question(q) for q in ordered]


def start_exam(user_id: int, mode: str, nl_category_id: int | None = None):
    count = FULL_EXAM_QUESTION_COUNT if mode == "full" else PRACTICE_QUESTION_COUNT

    if mode == "full":
        pool = Question.query.order_by(func.random()).all()
    else:
        pool = (
            Question.query.filter_by(nl_category_id=nl_category_id)
            .order_by(func.random())
            .all()
        )

    seen_query = (
        db.session.query(ExamResult.question_id)
        .join(ExamAttempt, ExamResult.exam_attempt_id == ExamAttempt.id)
        .filter(
            ExamAttempt.user_id == user_id,
            ExamAttempt.mode == mode,
            ExamAttempt.submitted_at.isnot(None),
        )
    )
    if mode == "practice" and nl_category_id is not None:
        seen_query = seen_query.filter(ExamAttempt.nl_category_id == nl_category_id)
    seen_ids = {qid for (qid,) in seen_query.all()}

    unseen_pool = [q for q in pool if q.id not in seen_ids]
    seen_fingerprints: set[str] = set()
    questions = _pick_unique_by_prompt(unseen_pool, count, seen_fingerprints)
    if len(questions) < count:
        remaining = [q for q in pool if q.id not in {x.id for x in questions}]
        questions.extend(_pick_unique_by_prompt(remaining, count - len(questions), seen_fingerprints))

    attempt = ExamAttempt(
        user_id=user_id,
        mode=mode,
        total_questions=len(questions),
        nl_category_id=nl_category_id,
    )
    db.session.add(attempt)
    db.session.commit()

    return attempt, [serialize_question(q) for q in questions]


def build_attempt_analytics(attempt_id: int):
    rows = (
        db.session.query(ExamResult, Question, NLCategory)
        .join(Question, ExamResult.question_id == Question.id)
        .join(NLCategory, Question.nl_category_id == NLCategory.id)
        .filter(ExamResult.exam_attempt_id == attempt_id)
        .all()
    )

    nl_breakdown = defaultdict(lambda: {"correct": 0, "total": 0})
    topic_misses = defaultdict(int)

    for result, question, nl_category in rows:
        nl_breakdown[nl_category.code]["total"] += 1
        if result.is_correct:
            nl_breakdown[nl_category.code]["correct"] += 1
        else:
            topic_misses[question.topic] += 1

    breakdown_response = []
    for code, values in nl_breakdown.items():
        pct = (values["correct"] / values["total"]) * 100 if values["total"] else 0
        breakdown_response.append(
            {
                "nl_code": code,
                "correct": values["correct"],
                "total": values["total"],
                "score": round(pct, 2),
            }
        )

    breakdown_response.sort(key=lambda x: x["nl_code"])

    missed_topics = [
        {"topic": topic, "misses": misses}
        for topic, misses in sorted(topic_misses.items(), key=lambda x: x[1], reverse=True)
    ]

    return {"nl_breakdown": breakdown_response, "missed_topics": missed_topics}


def build_attempt_answer_review(attempt_id: int):
    selected_choice = aliased(Choice)
    correct_choice = aliased(Choice)
    rows = (
        db.session.query(ExamResult, Question, selected_choice, correct_choice)
        .join(Question, ExamResult.question_id == Question.id)
        .outerjoin(selected_choice, selected_choice.id == ExamResult.selected_choice_id)
        .outerjoin(correct_choice, (correct_choice.question_id == Question.id) & (correct_choice.is_correct.is_(True)))
        .filter(ExamResult.exam_attempt_id == attempt_id)
        .order_by(ExamResult.id.asc())
        .all()
    )

    review = []
    for result, question, selected, correct in rows:
        review.append(
            {
                "question_id": question.id,
                "prompt": question.prompt,
                "topic": question.topic,
                "rationale": question.explanation,
                "selected_choice": selected.body if selected else None,
                "correct_choice": correct.body if correct else None,
                "is_correct": bool(result.is_correct),
            }
        )
    return review


def submit_exam(
    attempt: ExamAttempt,
    answers: list[dict],
    elapsed_seconds: int | None = None,
):
    question_ids = [a.get("question_id") for a in answers if a.get("question_id")]
    selected_by_qid = {a["question_id"]: a.get("selected_choice_id") for a in answers if a.get("question_id")}

    questions = Question.query.filter(Question.id.in_(question_ids)).all() if question_ids else []
    question_map = {q.id: q for q in questions}

    correct_count = 0
    topic_misses = defaultdict(int)
    nl_breakdown = defaultdict(lambda: {"correct": 0, "total": 0})

    for qid, selected_choice_id in selected_by_qid.items():
        question = question_map.get(qid)
        if not question:
            continue
        correct_choice = next((c for c in question.choices if c.is_correct), None)
        is_correct = bool(correct_choice and selected_choice_id == correct_choice.id)
        if is_correct:
            correct_count += 1
        else:
            topic_misses[question.topic] += 1

        nl = NLCategory.query.get(question.nl_category_id)
        key = nl.code if nl else f"NP-{question.nl_category_id}"
        nl_breakdown[key]["total"] += 1
        if is_correct:
            nl_breakdown[key]["correct"] += 1

        result = ExamResult(
            exam_attempt_id=attempt.id,
            question_id=qid,
            selected_choice_id=selected_choice_id,
            is_correct=is_correct,
        )
        db.session.add(result)

    total = max(len(selected_by_qid), 1)
    score = (correct_count / total) * 100

    attempt.score = round(score, 2)
    attempt.passed = attempt.score >= 75
    attempt.submitted_at = datetime.utcnow()
    attempt.elapsed_seconds = elapsed_seconds
    db.session.commit()

    breakdown_response = []
    for code, values in nl_breakdown.items():
        pct = (values["correct"] / values["total"]) * 100 if values["total"] else 0
        breakdown_response.append(
            {
                "nl_code": code,
                "correct": values["correct"],
                "total": values["total"],
                "score": round(pct, 2),
            }
        )

    missed_topics = [
        {"topic": topic, "misses": misses}
        for topic, misses in sorted(topic_misses.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "attempt_id": attempt.id,
        "score": attempt.score,
        "passed": attempt.passed,
        "correct_count": correct_count,
        "total_answered": len(selected_by_qid),
        "nl_breakdown": breakdown_response,
        "missed_topics": missed_topics,
        "elapsed_seconds": elapsed_seconds,
    }
