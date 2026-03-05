"""
main.py — MentorAI FastAPI backend.
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from config import get_settings
from api import pipeline, chat, documents, billing, auth, collections, summary, quiz, profile

settings = get_settings()

# ── Rate limiter ──────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="MentorAI API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
)

# Attach limiter to app state so routes can use @limiter.limit()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS must be added BEFORE SlowAPIMiddleware ───────────
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()] if allowed_origins_env else []

# Always include these defaults
default_origins = [
    "http://localhost:3000",
    "https://mentoraitestphase.vercel.app",
]
all_origins = list(set(default_origins + allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SlowAPIMiddleware)

app.include_router(auth.router,        prefix="/api/auth",        tags=["auth"])
app.include_router(pipeline.router,    prefix="/api/pipeline",    tags=["pipeline"])
app.include_router(chat.router,        prefix="/api/chat",        tags=["chat"])
app.include_router(documents.router,   prefix="/api/documents",   tags=["documents"])
app.include_router(collections.router, prefix="/api/collections", tags=["collections"])
app.include_router(billing.router,     prefix="/api/billing",     tags=["billing"])
app.include_router(quiz.router,        prefix="/api/quiz",        tags=["quiz"])
app.include_router(summary.router,     prefix="/api/summary",     tags=["summary"])
app.include_router(profile.router,     prefix="/api/profile",     tags=["profile"])

@app.get("/")
def health():
    return {"status": "ok", "app": settings.app_name}

@app.get("/health")
def healthcheck():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
