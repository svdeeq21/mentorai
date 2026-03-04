"""
api/pipeline.py
Handles document upload → background thread pipeline (no Celery needed locally).
Frontend polls /status/{job_id} for progress.
"""
from __future__ import annotations
import uuid
import threading
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
from supabase import create_client

from config import get_settings
from api.auth import get_current_user, get_user_tier, get_supabase_admin
from core.pipeline import run_pipeline

settings = get_settings()
router   = APIRouter()

SUPPORTED_TYPES = {
    "pdf", "docx", "pptx", "xlsx",
    "txt", "md", "html", "csv",
    "png", "jpg", "jpeg",
}

FREE_DOC_LIMIT = settings.free_max_docs


def _check_doc_limit(user_id: str, tier: str):
    if tier != "free":
        return
    sb = get_supabase_admin()
    r  = sb.table("documents").select("id", count="exact").eq("user_id", user_id).execute()
    if (r.count or 0) >= FREE_DOC_LIMIT:
        raise HTTPException(
            status_code=403,
            detail=f"Free plan allows {FREE_DOC_LIMIT} documents. Upgrade to Pro for unlimited."
        )


def _run_in_background(job_id: str, document_id: str, user_id: str,
                        filename: str, file_bytes: bytes, collection_id: str | None = None):
    """Run the pipeline in a background thread, updating Supabase as we go."""
    sb = get_supabase_admin()

    def update(status: str, progress: int, message: str = "", error: str = ""):
        try:
            payload = {"status": status, "progress": progress, "message": message}
            if error:
                payload["error"] = error
            if status == "complete":
                payload["completed_at"] = "now()"
            sb.table("jobs").update(payload).eq("id", job_id).execute()
        except Exception as e:
            print(f"Job update failed: {e}")

    def progress(message: str, percent: int):
        update("running", percent, message)

    try:
        update("running", 5, "Starting pipeline...")
        stats = run_pipeline(
            file_bytes=file_bytes,
            filename=filename,
            user_id=user_id,
            document_id=document_id,
            progress=progress,
        )
        sb.table("documents").update({
            "chunk_count": stats["chunks"],
            "page_count":  stats["pages"],
            "status":      "ready",
        }).eq("id", document_id).execute()
        # Auto-add to collection if requested
        if collection_id:
            try:
                sb.table("collection_documents").insert({
                    "collection_id": collection_id,
                    "document_id":   document_id,
                }).execute()
            except Exception as ce:
                print(f"Auto-add to collection failed: {ce}")
        update("complete", 100, "Document ready!")
    except Exception as e:
        print(f"Pipeline failed: {e}")
        update("failed", 0, "", str(e))
        sb.table("documents").update({"status": "failed"}).eq("id", document_id).execute()


@router.post("/upload")
@limiter.limit("10/minute")   # max 10 uploads per minute per IP
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    collection_id: str | None = Form(default=None),
    user=Depends(get_current_user),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    tier = get_user_tier(user.id)
    _check_doc_limit(user.id, tier)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."
        )

    sb          = get_supabase_admin()
    document_id = str(uuid.uuid4())
    job_id      = str(uuid.uuid4())

    sb.table("documents").insert({
        "id":        document_id,
        "user_id":   user.id,
        "name":      file.filename,
        "file_type": ext,
        "status":    "processing",
    }).execute()

    sb.table("jobs").insert({
        "id":          job_id,
        "user_id":     user.id,
        "document_id": document_id,
        "status":      "queued",
        "progress":    0,
        "message":     "Queued...",
    }).execute()

    # Run pipeline in a background thread — no Celery needed
    thread = threading.Thread(
        target=_run_in_background,
        args=(job_id, document_id, user.id, file.filename, file_bytes, collection_id),
        daemon=True,
    )
    thread.start()

    return {"document_id": document_id, "job_id": job_id, "message": "Pipeline started"}


@router.get("/status/{job_id}")
async def job_status(job_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r  = sb.table("jobs").select("*").eq("id", job_id).eq("user_id", user.id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return r.data[0]