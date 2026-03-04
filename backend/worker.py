"""
worker.py — Celery worker for MentorAI pipeline jobs.
"""
from __future__ import annotations
import os
from celery import Celery
from supabase import create_client

from config import get_settings
from core.pipeline import run_pipeline

settings = get_settings()

import ssl

celery_app = Celery(
    "mentorai",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=None,   # retry forever
    broker_heartbeat=10,                  # send heartbeat every 10s
    broker_heartbeat_checkrate=2,
    worker_prefetch_multiplier=1,
    # Upstash Redis SSL
    broker_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE} if settings.redis_url.startswith("rediss://") else None,
    redis_backend_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE} if settings.redis_url.startswith("rediss://") else None,
)


def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _update_job(job_id: str, status: str, progress: int, message: str = "", error: str = ""):
    try:
        sb = get_supabase()
        payload = {"status": status, "progress": progress, "message": message}
        if error:
            payload["error"] = error
        if status == "complete":
            payload["completed_at"] = "now()"
        sb.table("jobs").update(payload).eq("id", job_id).execute()
    except Exception as e:
        print(f"Failed to update job {job_id}: {e}")


def _save_document(job_id: str, user_id: str, document_id: str, filename: str, stats: dict):
    try:
        sb = get_supabase()
        sb.table("documents").update({
            "chunk_count": stats["chunks"],
            "page_count":  stats["pages"],
            "status":      "ready",
        }).eq("id", document_id).execute()
    except Exception as e:
        print(f"Failed to save document {document_id}: {e}")


@celery_app.task(bind=True, name="run_pipeline_task")
def run_pipeline_task(self, job_id: str, document_id: str, user_id: str,
                      filename: str, file_bytes_hex: str):
    try:
        _update_job(job_id, "running", 5, "Starting pipeline...")
        file_bytes = bytes.fromhex(file_bytes_hex)

        def progress(message: str, percent: int):
            _update_job(job_id, "running", percent, message)
            self.update_state(state="PROGRESS", meta={"message": message, "percent": percent})

        stats = run_pipeline(
            file_bytes=file_bytes,
            filename=filename,
            user_id=user_id,
            document_id=document_id,
            progress=progress,
        )

        _save_document(job_id, user_id, document_id, filename, stats)
        _update_job(job_id, "complete", 100, "Document ready!")
        return {"status": "complete", "stats": stats}

    except Exception as e:
        _update_job(job_id, "failed", 0, "", str(e))
        raise
