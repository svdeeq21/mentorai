"""
core/llm.py
LLM initialisation and fallback logic.
Gemini 2.5 Flash is primary. Groq Llama 3.3 70B is fallback.
"""
from __future__ import annotations
import os
from functools import lru_cache
from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from config import get_settings


settings = get_settings()


# ── Model constants ───────────────────────────────────────
GEMINI_MODEL = "models/gemini-2.5-flash"
GROQ_MODEL   = "llama-3.3-70b-versatile"
GROQ_LIMIT   = 6000    # safe char limit for Groq context


@lru_cache()
def _gemini() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=0.2,
        max_output_tokens=4096,
        google_api_key= settings.google_api_key,
    )


@lru_cache()
def _groq() -> ChatGroq:
    return ChatGroq(
        model=GROQ_MODEL,
        temperature=0.2,
        max_tokens=4096,
        groq_api_key=settings.groq_api_key,
    )


def invoke_with_fallback(
    messages: list[BaseMessage],
    *,
    groq_char_limit: int = GROQ_LIMIT,
) -> tuple[BaseMessage, str]:
    """
    Call Gemini first. If it fails, fall back to Groq.
    Returns (response_message, model_used).
    Groq does not support vision — image content is stripped automatically.
    """
    # ── Try Gemini ────────────────────────────────────────
    gemini_err = None
    try:
        response = _gemini().invoke(messages)
        return response, "gemini"
    except Exception as e:
        gemini_err = e

    # ── Groq fallback — strip images, truncate text ───────
    def _strip_images(msg: BaseMessage) -> BaseMessage:
        if not isinstance(msg.content, list):
            return msg
        text_parts = [
            p["text"] for p in msg.content
            if isinstance(p, dict) and p.get("type") == "text"
        ]
        combined = " ".join(text_parts)
        if len(combined) > groq_char_limit:
            combined = combined[:groq_char_limit] + "\n[truncated]"
        msg.content = combined
        return msg

    groq_messages = [_strip_images(m) for m in messages]

    try:
        response = _groq().invoke(groq_messages)
        return response, "groq"
    except Exception as groq_err:
        raise RuntimeError(
            f"Both LLMs failed.\nGemini: {gemini_err}\nGroq: {groq_err}"
        )
