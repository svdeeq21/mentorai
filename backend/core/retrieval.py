# FILE: backend/core/retrieval.py
from __future__ import annotations
from langchain_core.messages import HumanMessage, SystemMessage
from qdrant_client.models import Filter, FieldCondition, MatchValue
from typing import Any

from config import get_settings
from core.llm import invoke_with_fallback
from core.pipeline import get_embeddings, get_qdrant

settings = get_settings()
CONFIDENCE_THRESHOLD = 0.30

SYSTEM_PROMPT = """You are MentorAI, an expert study assistant.
Answer the user's question using ONLY the provided document context.
Be thorough, clear, and use examples from the document where possible.
If the answer is not in the context, say so honestly.
Always reference the page numbers and document names when they are available."""

GK_SYSTEM_PROMPT = """You are MentorAI, a knowledgeable study assistant.
The question was not found in the uploaded document(s).
Answer from your general knowledge, clearly noting this is general knowledge
and not from the document."""


def _make_filter(document_id: str, user_id: str) -> Filter:
    return Filter(must=[
        FieldCondition(key="document_id", match=MatchValue(value=document_id)),
        FieldCondition(key="user_id",     match=MatchValue(value=user_id)),
    ])


def _make_multi_filter(document_ids: list[str], user_id: str) -> Filter:
    return Filter(must=[
        FieldCondition(key="user_id", match=MatchValue(value=user_id)),
        Filter(should=[
            FieldCondition(key="document_id", match=MatchValue(value=doc_id))
            for doc_id in document_ids
        ])
    ])


def _format_sources(chunks: list[dict], scores: list[float]) -> list[dict]:
    sources = []
    seen_pages = set()  # deduplicate images per page — only send once per page
    for chunk, score in zip(chunks, scores):
        page_num = chunk.get("page_number", "?")
        page_key = (chunk.get("document_id", ""), page_num)
        first_on_page = page_key not in seen_pages
        if first_on_page:
            seen_pages.add(page_key)
        sources.append({
            "document_id":     chunk.get("document_id", ""),
            "document_name":   chunk.get("document_name", "Unknown"),
            "page_number":     page_num,
            "score":           round(score, 3),
            "figures":         chunk.get("figures", []) if first_on_page else [],
            "page_screenshot": chunk.get("page_screenshot") if first_on_page else None,
        })
    return sources


def retrieve_and_answer(query: str, document_id: str, user_id: str, top_k: int = 5) -> dict:
    embeddings   = get_embeddings()
    qdrant       = get_qdrant()
    query_vector = embeddings.embed_query(query)

    results = qdrant.query_points(
        collection_name=settings.qdrant_collection,
        query=query_vector,
        query_filter=_make_filter(document_id, user_id),
        limit=top_k,
        with_payload=True,
    ).points

    chunks     = [r.payload for r in results]
    scores     = [r.score   for r in results]
    best_score = max(scores) if scores else 0.0

    if best_score >= CONFIDENCE_THRESHOLD and chunks:
        context = "\n\n---\n\n".join(
            f"[Document: {c.get('document_name','?')} | Page {c.get('page_number','?')}]\n{c['text']}"
            for c in chunks
        )
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}"),
        ]
        answer_type = "doc"
        sources = _format_sources(chunks, scores)
    else:
        messages    = [SystemMessage(content=GK_SYSTEM_PROMPT), HumanMessage(content=query)]
        answer_type = "general"
        sources     = []

    response, model_used = invoke_with_fallback(messages)
    return {
        "answer":      response.content,
        "answer_type": answer_type,
        "sources":     sources,
        "model":       model_used,
        "best_score":  best_score,
    }


def retrieve_from_collection(query: str, collection_id: str, user_id: str, sb: Any, top_k: int = 6) -> dict:
    # Get all document IDs in this collection
    r = sb.table("collection_documents") \
          .select("document_id, documents(name)") \
          .eq("collection_id", collection_id) \
          .execute()

    if not r.data:
        raise ValueError("Collection has no documents")

    doc_ids   = [d["document_id"] for d in r.data]
    doc_names = {d["document_id"]: d.get("documents", {}).get("name", "Unknown") for d in r.data}

    embeddings   = get_embeddings()
    qdrant       = get_qdrant()
    query_vector = embeddings.embed_query(query)

    results = qdrant.query_points(
        collection_name=settings.qdrant_collection,
        query=query_vector,
        query_filter=_make_multi_filter(doc_ids, user_id),
        limit=top_k,
        with_payload=True,
    ).points

    chunks     = [r.payload for r in results]
    scores     = [r.score   for r in results]
    best_score = max(scores) if scores else 0.0

    # Attach document name from our lookup
    for chunk in chunks:
        doc_id = chunk.get("document_id", "")
        if not chunk.get("document_name"):
            chunk["document_name"] = doc_names.get(doc_id, "Unknown")

    if best_score >= CONFIDENCE_THRESHOLD and chunks:
        context = "\n\n---\n\n".join(
            f"[Document: {c.get('document_name','?')} | Page {c.get('page_number','?')}]\n{c['text']}"
            for c in chunks
        )
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}"),
        ]
        answer_type = "doc"
        sources = _format_sources(chunks, scores)
    else:
        messages    = [SystemMessage(content=GK_SYSTEM_PROMPT), HumanMessage(content=query)]
        answer_type = "general"
        sources     = []

    response, model_used = invoke_with_fallback(messages)
    return {
        "answer":      response.content,
        "answer_type": answer_type,
        "sources":     sources,
        "model":       model_used,
        "best_score":  best_score,
    }


def delete_document_vectors(document_id: str, user_id: str) -> None:
    try:
        qdrant = get_qdrant()
        qdrant.delete(
            collection_name=settings.qdrant_collection,
            points_selector={"filter": _make_filter(document_id, user_id)},
        )
    except Exception:
        pass