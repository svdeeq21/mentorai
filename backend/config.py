from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    app_name: str = "MentorAI"
    debug: bool = False

    # ── Supabase ─────────────────────────────────────────
    supabase_url: str
    supabase_key: str                  # anon/public key
    supabase_service_key: str          # service role key (for admin ops)

    # ── LLMs ─────────────────────────────────────────────
    google_api_key: str
    groq_api_key: str

    # ── Vector DB (Qdrant Cloud) ──────────────────────────
    qdrant_url: str
    qdrant_api_key: str
    qdrant_collection: str = "mentorai_docs"

    # ── Queue (Upstash Redis) ─────────────────────────────
    redis_url: str                     # rediss://default:xxx@xxx.upstash.io:6379

    # ── Embeddings ───────────────────────────────────────
    embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # ── Flutterwave ───────────────────────────────────────
    flutterwave_public_key: str
    flutterwave_secret_key: str
    flutterwave_webhook_secret: str = ""

    # ── Pricing (in NGN) ─────────────────────────────────
    pro_monthly_ngn: int = 9000        # ~$12 USD equivalent
    team_monthly_ngn: int = 22000      # ~$29 USD equivalent

    # ── Pipeline limits per tier ─────────────────────────
    free_max_pages: int = 50
    free_max_docs: int = 3
    free_daily_messages: int = 20
    pro_max_pages: int = 300

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
