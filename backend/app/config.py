import os
from urllib.parse import quote_plus, urlencode


def _split_csv(value: str):
    return [x.strip() for x in (value or "").split(",") if x.strip()]


def _build_supabase_pooler_uri():
    user = os.getenv("SUPABASE_DB_USER", "").strip()
    password = os.getenv("SUPABASE_DB_PASSWORD", "").strip()
    host = os.getenv("SUPABASE_DB_HOST", "").strip()
    if not (user and password and host):
        return ""

    port = os.getenv("SUPABASE_DB_PORT", "5432").strip()
    database = os.getenv("SUPABASE_DB_NAME", "postgres").strip()
    sslmode = os.getenv("SUPABASE_DB_SSLMODE", "require").strip()
    query = urlencode({"sslmode": sslmode}) if sslmode else ""
    base = f"postgresql+psycopg://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}"
    return f"{base}?{query}" if query else base


def _database_uri(default_uri: str):
    raw = os.getenv("DATABASE_URL", "").strip()
    if raw:
        return raw
    supabase_uri = _build_supabase_pooler_uri()
    if supabase_uri:
        return supabase_uri
    return default_uri


def _engine_options(database_uri: str):
    if database_uri.startswith("sqlite"):
        return {"connect_args": {"timeout": 30}}
    return {"pool_pre_ping": True, "pool_recycle": 1800}

class BaseConfig:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret")
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    CORS_ORIGINS = _split_csv(os.getenv("CORS_ORIGINS", "*")) or ["*"]
    AUTO_SEED_ON_BOOT: bool = os.getenv("AUTO_SEED_ON_BOOT", "1") == "1"
    DEBUG: bool = False


class LocalConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI: str = _database_uri("sqlite:///nle_reviewer.db")
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options(SQLALCHEMY_DATABASE_URI)
    DEBUG: bool = True


class ProductionConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI: str = _database_uri("sqlite:///nle_reviewer.db")
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options(SQLALCHEMY_DATABASE_URI)
    DEBUG: bool = False
    AUTO_SEED_ON_BOOT: bool = os.getenv("AUTO_SEED_ON_BOOT", "0") == "1"


def get_config():
    env = os.getenv("APP_ENV", "local").lower()
    if env == "production":
        return ProductionConfig
    return LocalConfig
