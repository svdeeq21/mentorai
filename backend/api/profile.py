"""
api/profile.py
User profile & usage stats.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from api.auth import get_current_user, get_supabase_admin

router = APIRouter()

FREE_LIMITS  = {"documents": 3,   "chats_per_day": 20,  "pages_per_doc": 50}
PRO_LIMITS   = {"documents": None, "chats_per_day": None, "pages_per_doc": 300}
TEAM_LIMITS  = {"documents": None, "chats_per_day": None, "pages_per_doc": 300}


def _get_plan(user_id: str, sb) -> str:
    try:
        r = sb.table("subscriptions").select("plan,status") \
               .eq("user_id", user_id).eq("status", "active").execute()
        if r.data:
            return r.data[0]["plan"]
    except Exception:
        pass
    return "free"


@router.get("/usage")
async def get_usage(user=Depends(get_current_user)):
    sb = get_supabase_admin()
    plan = _get_plan(user.id, sb)

    # Document count (only ready docs)
    doc_r = sb.table("documents").select("id", count="exact") \
               .eq("user_id", user.id).eq("status", "ready").execute()
    doc_count = doc_r.count or 0

    # Chats today
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    chat_r = sb.table("chat_messages").select("id", count="exact") \
                .eq("user_id", user.id).eq("role", "user") \
                .gte("created_at", today_start).execute()
    chats_today = chat_r.count or 0

    # Collections count
    col_r = sb.table("collections").select("id", count="exact") \
               .eq("user_id", user.id).execute()
    col_count = col_r.count or 0

    # Quizzes taken (all time)
    quiz_r = sb.table("quiz_sessions").select("id,score_pct", count="exact") \
                .eq("user_id", user.id).execute()
    quiz_count  = quiz_r.count or 0
    quiz_scores = [q["score_pct"] for q in (quiz_r.data or []) if q.get("score_pct") is not None]
    avg_score   = round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else None

    # Recent quiz history (last 5)
    quiz_hist_r = sb.table("quiz_sessions").select("*") \
                    .eq("user_id", user.id) \
                    .order("created_at", desc=True).limit(5).execute()

    limits = FREE_LIMITS if plan == "free" else PRO_LIMITS if plan == "pro" else TEAM_LIMITS

    return {
        "plan":        plan,
        "doc_count":   doc_count,
        "chats_today": chats_today,
        "col_count":   col_count,
        "quiz_count":  quiz_count,
        "avg_score":   avg_score,
        "quiz_history": quiz_hist_r.data or [],
        "limits":      limits,
    }
