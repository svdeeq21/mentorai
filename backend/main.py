"""
main.py — MentorAI FastAPI backend.
"""
from __future__ import annotations
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
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://mentorai.vercel.app",
        "https://www.mentorai.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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