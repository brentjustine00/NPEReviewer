from flask import Blueprint, request
from flask_jwt_extended import create_access_token

from ..extensions import db
from ..models import User
from ..services.security import hash_password, verify_password

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not email or not password or not full_name:
        return {"error": "email, password, full_name are required"}, 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return {"error": "email already exists"}, 409

    user = User(email=email, password_hash=hash_password(password), full_name=full_name)
    db.session.add(user)
    db.session.commit()
    return {"id": user.id, "email": user.email, "full_name": user.full_name}, 201


@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.password_hash):
        return {"error": "invalid credentials"}, 401

    token = create_access_token(identity=str(user.id))
    return {
        "access_token": token,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
    }
