from datetime import datetime

from .extensions import db


class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    attempts = db.relationship("ExamAttempt", backref="user", lazy=True)
    ai_logs = db.relationship("AISuggestionLog", backref="user", lazy=True)


class NLCategory(db.Model):
    __tablename__ = "nl_category"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    icon = db.Column(db.String(50), nullable=False, default="medkit")

    questions = db.relationship("Question", backref="category", lazy=True)


class Question(db.Model):
    __tablename__ = "question"
    id = db.Column(db.Integer, primary_key=True)
    nl_category_id = db.Column(db.Integer, db.ForeignKey("nl_category.id"), nullable=False)
    prompt = db.Column(db.Text, nullable=False)
    explanation = db.Column(db.Text, nullable=False)
    topic = db.Column(db.String(255), nullable=False)

    choices = db.relationship("Choice", backref="question", lazy=True, cascade="all, delete-orphan")


class Choice(db.Model):
    __tablename__ = "choice"
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey("question.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)


class ExamAttempt(db.Model):
    __tablename__ = "exam_attempt"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    mode = db.Column(db.String(20), nullable=False)  # practice | full
    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    total_questions = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Float, nullable=True)
    passed = db.Column(db.Boolean, nullable=True)
    elapsed_seconds = db.Column(db.Integer, nullable=True)
    nl_category_id = db.Column(db.Integer, db.ForeignKey("nl_category.id"), nullable=True)

    results = db.relationship("ExamResult", backref="attempt", lazy=True, cascade="all, delete-orphan")


class ExamResult(db.Model):
    __tablename__ = "exam_result"
    id = db.Column(db.Integer, primary_key=True)
    exam_attempt_id = db.Column(db.Integer, db.ForeignKey("exam_attempt.id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("question.id"), nullable=False)
    selected_choice_id = db.Column(db.Integer, db.ForeignKey("choice.id"), nullable=True)
    is_correct = db.Column(db.Boolean, nullable=False, default=False)


class AISuggestionLog(db.Model):
    __tablename__ = "ai_suggestion_log"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    exam_attempt_id = db.Column(db.Integer, db.ForeignKey("exam_attempt.id"), nullable=False)
    payload = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
