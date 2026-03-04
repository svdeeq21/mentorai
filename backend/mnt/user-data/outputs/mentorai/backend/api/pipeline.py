"""
api/pipeline.py
Handles document upload → job creation → Celery dispatch.
Frontend polls /status/{job_id} for progress.
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from supabase import create_client

from config import get_settings
from api.auth import get_current_user, get_user_tier, get_supabase_admin
from worker import run_pipeline_task

settings = get_settings()
router   = APIRouter()

SUPPORTED_TYPES = {
    "pdf", "docx", "pptx", "xlsx",
    "txt", "md", "html", "csv",
    "png", "jpg", "jpeg",
}

FREE_PAGE_LIMIT = settings.free_max_pages
FREE_DOC_LIMIT  = settings.free_max_docs


def _check_doc_limit(user_id: str, tier: str):
    """Raise 403 if free user has hit their document limit."""
    if tier != "free":
        return
    sb = get_supabase_admin()
    r  = sb.table("documents").select("id", count="exact") \
           .eq("user_id", user_id).execute()
    count = r.count or 0
    if count >= FREE_DOC_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free plan allows {FREE_DOC_LIMIT} documents. "
                   f"Upgrade to Pro for unlimited documents."
        )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """
    Upload a document and start the background pipeline.
    Returns {document_id, job_id} immediately.
    Frontend polls /pipeline/status/{job_id} for progress.
    """
    # validate file type
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}"
        )

    # check plan limits
    tier = get_user_tier(user.id)
    _check_doc_limit(user.id, tier)

    # read file
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    sb          = get_supabase_admin()
    document_id = str(uuid.uuid4())
    job_id      = str(uuid.uuid4())

    # create document record (status: processing)
    sb.table("documents").insert({
        "id":        document_id,
        "user_id":   user.id,
        "name":      file.filename,
        "file_type": ext,
        "status":    "processing",
    }).execute()

    # create job record
    sb.table("jobs").insert({
        "id":          job_id,
        "user_id":     user.id,
        "document_id": document_id,
        "status":      "queued",
        "progress":    0,
        "message":     "Queued...",
    }).execute()

    # dispatch to Celery worker
    run_pipeline_task.delay(
        job_id=job_id,
        document_id=document_id,
        user_id=user.id,
        filename=file.filename,
        file_bytes_hex=file_bytes.hex(),
    )

    return {
        "document_id": document_id,
        "job_id":      job_id,
        "message":     "Pipeline started",
    }


@router.get("/status/{job_id}")
async def job_status(job_id: str, user=Depends(get_current_user)):
    """Poll this endpoint to get pipeline progress."""
    sb = get_supabase_admin()
    r  = sb.table("jobs").select("*") \
           .eq("id", job_id) \
           .eq("user_id", user.id) \
           .single().execute()

    if not r.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return r.data
