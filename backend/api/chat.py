from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from typing import Optional
from api.auth import get_current_user, get_supabase_admin
from core.retrieval import retrieve_and_answer, retrieve_from_collection

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    context_type: str  # 'document' or 'collection'
    context_id: str
    session_id: Optional[str] = None

@router.post("/")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    if body.context_type not in ("document", "collection"):
        raise HTTPException(status_code=400, detail="context_type must be 'document' or 'collection'")
    # Save user message
    sb.table("chat_messages").insert({
        "user_id": user.id,
        "context_type": body.context_type,
        "context_id": body.context_id,
        "role": "user",
        "content": body.message,
    }).execute()
    # Get answer
    try:
        if body.context_type == "document":
            result = retrieve_and_answer(body.message, body.context_id, user.id)
        else:
            result = retrieve_from_collection(body.message, body.context_id, user.id, sb)
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    # Build metadata with source info
    metadata = {
        "answer_type": result["answer_type"],
        "model": result["model"],
        "sources": result.get("sources", []),
    }
    # Save assistant message
    sb.table("chat_messages").insert({
        "user_id": user.id,
        "context_type": body.context_type,
        "context_id": body.context_id,
        "role": "assistant",
        "content": result["answer"],
        "metadata": metadata,
    }).execute()
    return {
        "answer": result["answer"],
        "answer_type": result["answer_type"],
        "sources": result.get("sources", []),
        "model": result["model"],
    }

@router.get("/history")
async def get_history(context_type: str, context_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r = sb.table("chat_messages") \
          .select("role, content, metadata, created_at") \
          .eq("user_id", user.id) \
          .eq("context_type", context_type) \
          .eq("context_id", context_id) \
          .order("created_at") \
          .execute()
    return r.data or []

@router.delete("/history")
async def clear_history(context_type: str, context_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    sb.table("chat_messages") \
      .delete() \
      .eq("user_id", user.id) \
      .eq("context_type", context_type) \
      .eq("context_id", context_id) \
      .execute()
    return {"cleared": True}
