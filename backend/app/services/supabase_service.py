import os


def is_supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"))


def auth_mode() -> str:
    env = os.getenv("APP_ENV", "local").lower()
    if env == "production" and is_supabase_configured():
        return "supabase"
    return "flask-jwt"
