# FILE: backend/api/summary.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from qdrant_client.models import Filter, FieldCondition, MatchValue

from api.auth import get_current_user, get_supabase_admin
from core.llm import invoke_with_fallback
from core.pipeline import get_embeddings, get_qdrant
from config import get_settings

settings = get_settings()
router   = APIRouter()

SUMMARY_PROMPT = """You are MentorAI, an expert study assistant.
Generate a comprehensive summary of this document.

Structure your response exactly like this:

## Overview
2-3 sentence high-level description of what this document is about.

## Key Topics
List the 4-6 main topics or sections covered.

## Main Takeaways
- bullet points of the most important things to know

## Who Should Read This
One sentence about who this document is most useful for."""


@router.get("/{document_id}")
async def get_summary(document_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()

    r = sb.table("documents").select("id, status, name, summary") \
          .eq("id", document_id).eq("user_id", user.id).execute()

    if not r.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = r.data[0]
    if doc["status"] != "ready":
        raise HTTPException(status_code=400, detail="Document is still processing")

    if doc.get("summary"):
        return {"summary": doc["summary"], "cached": True}

    try:
        embeddings   = get_embeddings()
        qdrant       = get_qdrant()
        query_vector = embeddings.embed_query(
            "overview summary main topics key points introduction"
        )

        results = qdrant.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector,
            query_filter=Filter(must=[
                FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                FieldCondition(key="user_id",     match=MatchValue(value=user.id)),
            ]),
            limit=8,
            with_payload=True,
        ).points

        if not results:
            raise HTTPException(status_code=400, detail="No content found for this document")

        context = "\n\n---\n\n".join(
            r.payload["text"] for r in results if r.payload.get("text")
        )

        messages = [
            SystemMessage(content=SUMMARY_PROMPT),
            HumanMessage(content=f"Document: {doc['name']}\n\nContent:\n{context}"),
        ]

        response, model = invoke_with_fallback(messages)
        summary = response.content

        try:
            sb.table("documents").update({"summary": summary}).eq("id", document_id).execute()
        except Exception:
            pass

        return {"summary": summary, "cached": False, "model": model}

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")