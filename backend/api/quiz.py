"""
api/quiz.py
Generate MCQ quizzes from document/collection context using Qdrant retrieval.
Save quiz attempts to Supabase quiz_sessions table.
"""

import json
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user, get_supabase_admin
from core.pipeline import get_embeddings, get_qdrant
from core.llm import invoke_with_fallback
from config import get_settings
from qdrant_client.models import Filter, FieldCondition, MatchValue
from langchain_core.messages import SystemMessage, HumanMessage

settings = get_settings()
router = APIRouter()


class GenerateRequest(BaseModel):
    context_type: str        # 'document' | 'collection'
    context_id:   str
    difficulty:   str = "medium"   # 'easy' | 'medium' | 'hard'
    num_questions: int = 5


class SubmitRequest(BaseModel):
    context_type:  str
    context_id:    str
    difficulty:    str
    questions:     list[dict]   # the original questions with correct answers
    user_answers:  dict         # {question_index: selected_option_index}


def _get_context_chunks(context_type: str, context_id: str, user_id: str, n: int = 20) -> list[str]:
    """Retrieve a broad sample of chunks for quiz generation."""
    qdrant = get_qdrant()

    if context_type == "document":
        must = [
            FieldCondition(key="document_id", match=MatchValue(value=context_id)),
            FieldCondition(key="user_id",     match=MatchValue(value=user_id)),
        ]
    else:
        # collection — get all document IDs first
        sb = get_supabase_admin()
        r  = sb.table("collection_documents").select("document_id").eq("collection_id", context_id).execute()
        if not r.data:
            raise HTTPException(status_code=400, detail="Collection has no documents")
        doc_ids = [d["document_id"] for d in r.data]
        must = [
            FieldCondition(key="user_id", match=MatchValue(value=user_id)),
            Filter(should=[
                FieldCondition(key="document_id", match=MatchValue(value=did))
                for did in doc_ids
            ])
        ]

    # Use a random vector to get a diverse spread of chunks rather than topically clustered ones
    import random
    random_vec = [random.uniform(-1, 1) for _ in range(384)]
    # Normalize
    mag = sum(x**2 for x in random_vec) ** 0.5
    random_vec = [x / mag for x in random_vec]

    results = qdrant.query_points(
        collection_name=settings.qdrant_collection,
        query=random_vec,
        query_filter=Filter(must=must),
        limit=n,
        with_payload=True,
    ).points

    return [r.payload.get("text", "") for r in results if r.payload.get("text")]


QUIZ_SYSTEM = """You are an expert educator creating multiple-choice quiz questions.
Given document content, generate {num_q} quiz questions at {difficulty} difficulty.

Rules:
- Each question must be directly answerable from the provided content
- Easy: factual recall, definitions
- Medium: comprehension, applying concepts
- Hard: analysis, inference, comparing ideas

Respond ONLY with a valid JSON array, no markdown fences, no extra text:
[
  {{
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": 0,
    "explanation": "Brief explanation of why this is correct"
  }},
  ...
]
The "correct" field is the 0-based index of the correct option."""


@router.post("/generate")
async def generate_quiz(req: GenerateRequest, user=Depends(get_current_user)):
    num_q = max(3, min(10, req.num_questions))

    chunks = _get_context_chunks(req.context_type, req.context_id, user.id, n=20)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content found to generate quiz from")

    # Use a good spread of chunks as context
    context = "\n\n---\n\n".join(chunks[:15])

    messages = [
        SystemMessage(content=QUIZ_SYSTEM.format(num_q=num_q, difficulty=req.difficulty)),
        HumanMessage(content=f"Document content:\n\n{context}\n\nGenerate {num_q} questions."),
    ]

    response, _ = invoke_with_fallback(messages)
    raw = response.content.strip()

    # Strip markdown fences if model added them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        questions = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse quiz questions from AI response")

    # Validate structure
    validated = []
    for q in questions:
        if not all(k in q for k in ("question", "options", "correct", "explanation")):
            continue
        if len(q["options"]) != 4:
            continue
        if not isinstance(q["correct"], int) or q["correct"] not in range(4):
            continue
        validated.append(q)

    if not validated:
        raise HTTPException(status_code=500, detail="AI returned invalid quiz format")

    return {"questions": validated, "difficulty": req.difficulty}


@router.post("/submit")
async def submit_quiz(req: SubmitRequest, user=Depends(get_current_user)):
    """Score the quiz and save result to Supabase."""
    questions    = req.questions
    user_answers = req.user_answers
    total        = len(questions)
    correct      = 0
    results      = []

    for i, q in enumerate(questions):
        user_ans  = user_answers.get(str(i))
        is_correct = (user_ans == q.get("correct"))
        if is_correct:
            correct += 1
        results.append({
            "question":    q["question"],
            "options":     q["options"],
            "correct":     q["correct"],
            "user_answer": user_ans,
            "is_correct":  is_correct,
            "explanation": q.get("explanation", ""),
        })

    score_pct = round((correct / total) * 100) if total else 0

    # Save to Supabase
    try:
        sb = get_supabase_admin()
        sb.table("quiz_sessions").insert({
            "user_id":      user.id,
            "context_type": req.context_type,
            "context_id":   req.context_id,
            "difficulty":   req.difficulty,
            "score":        correct,
            "total":        total,
            "score_pct":    score_pct,
        }).execute()
    except Exception as e:
        print(f"Quiz save failed: {e}")

    return {
        "correct":   correct,
        "total":     total,
        "score_pct": score_pct,
        "results":   results,
    }


@router.get("/history")
async def quiz_history(user=Depends(get_current_user)):
    """Return recent quiz attempts for this user."""
    sb = get_supabase_admin()
    r  = sb.table("quiz_sessions").select("*") \
           .eq("user_id", user.id) \
           .order("created_at", desc=True) \
           .limit(20).execute()
    return r.data or []
