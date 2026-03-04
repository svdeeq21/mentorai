"""
api/auth.py
Auth helpers — verifies Supabase JWT on every protected request.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
from supabase import create_client
from config import get_settings

settings = get_settings()
router   = APIRouter()


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_key)


def get_supabase_admin():
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(authorization: str = Header(...)):
    """
    Dependency — extracts and verifies the Supabase JWT.
    Usage: user = Depends(get_current_user)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        sb   = get_supabase()
        resp = sb.auth.get_user(token)
        if not resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return resp.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {e}")


def get_user_tier(user_id: str) -> str:
    """Return 'free' | 'pro' | 'team' for a user."""
    try:
        sb = get_supabase_admin()
        r  = sb.table("subscriptions") \
               .select("plan, status") \
               .eq("user_id", user_id) \
               .eq("status", "active") \
               .limit(1).execute()
        if r.data:
            return r.data[0]["plan"]
    except Exception:
        pass
    return "free"


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    """Return current user info + tier."""
    tier = get_user_tier(user.id)
    return {
        "id":    user.id,
        "email": user.email,
        "tier":  tier,
    }
