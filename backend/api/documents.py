"""
api/documents.py
Document library — list, get, delete.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException

from api.auth import get_current_user, get_supabase_admin
from core.retrieval import delete_document_vectors

router = APIRouter()


@router.get("/")
async def list_documents(user=Depends(get_current_user)):
    """Return all documents for the current user."""
    sb = get_supabase_admin()
    r  = sb.table("documents").select("*") \
           .eq("user_id", user.id) \
           .order("created_at", desc=True).execute()
    return r.data or []


@router.get("/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    """Return a single document."""
    sb = get_supabase_admin()
    r  = sb.table("documents").select("*") \
           .eq("id", document_id) \
           .eq("user_id", user.id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return r.data


@router.delete("/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    """Delete a document and its vectors from Qdrant."""
    sb = get_supabase_admin()

    # verify ownership
    r = sb.table("documents").select("id") \
          .eq("id", document_id) \
          .eq("user_id", user.id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # delete vectors from Qdrant
    delete_document_vectors(document_id, user.id)

    # delete from DB (cascades to chat_sessions, chat_messages)
    sb.table("documents").delete().eq("id", document_id).execute()

    return {"deleted": True}


@router.post("/{document_id}/session")
async def create_chat_session(
    document_id: str,
    user=Depends(get_current_user)
):
    """Create a new chat session for a document."""
    sb = get_supabase_admin()

    # verify ownership
    r = sb.table("documents").select("id") \
          .eq("id", document_id) \
          .eq("user_id", user.id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Document not found")

    session = sb.table("chat_sessions").insert({
        "user_id":     user.id,
        "document_id": document_id,
    }).execute()

    return {"session_id": session.data[0]["id"]}


@router.get("/{document_id}/sessions/{session_id}/messages")
async def get_messages(
    document_id: str,
    session_id: str,
    user=Depends(get_current_user),
):
    """Return all messages for a chat session."""
    sb = get_supabase_admin()
    r  = sb.table("chat_messages").select("*") \
           .eq("session_id", session_id) \
           .order("created_at").execute()
    return r.data or []
