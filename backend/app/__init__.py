import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from sqlalchemy import text

from .bootstrap import ensure_seed_data
from .config import get_config
from .extensions import db
from .routes.ai import ai_bp
from .routes.auth import auth_bp
from .routes.exam import exam_bp
from .routes.nl import nl_bp
from .services.supabase_service import auth_mode


jwt = JWTManager()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config())

    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))
    db.init_app(app)
    jwt.init_app(app)

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(nl_bp)
    app.register_blueprint(exam_bp, url_prefix="/exam")
    app.register_blueprint(ai_bp, url_prefix="/ai")

    with app.app_context():
        db.create_all()
        # Improve sqlite read/write concurrency for local dev.
        if str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).startswith("sqlite"):
            db.session.execute(text("PRAGMA journal_mode=WAL;"))
            db.session.execute(text("PRAGMA synchronous=NORMAL;"))
            db.session.commit()
        if app.config.get("AUTO_SEED_ON_BOOT", True):
            ensure_seed_data()

    @app.get("/")
    def index():
        return {
            "name": "NPE Reviewer API",
            "status": "running",
            "health": "/health",
            "endpoints": {
                "auth_register": "/auth/register",
                "auth_login": "/auth/login",
                "np_categories": "/nl-categories",
                "questions_by_np": "/questions/<np_id>",
                "exam_start": "/exam/start",
                "exam_submit": "/exam/submit",
                "exam_history": "/exam/history",
                "ai_suggestions": "/ai/suggestions",
            },
        }

    @app.get("/health")
    def health():
        return {"status": "ok", "env": os.getenv("APP_ENV", "local"), "auth_mode": auth_mode()}

    return app
