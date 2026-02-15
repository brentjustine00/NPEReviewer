from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(raw_password: str) -> str:
    return generate_password_hash(raw_password)


def verify_password(raw_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, raw_password)
