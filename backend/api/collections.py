# FILE: backend/api/collections.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from api.auth import get_current_user, get_supabase_admin

router = APIRouter()

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionAddDoc(BaseModel):
    document_id: str

@router.get("/")
async def list_collections(user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r = sb.table("collections").select("*, collection_documents(document_id)") \
          .eq("user_id", user.id).order("created_at", desc=True).execute()
    return r.data or []

@router.post("/")
async def create_collection(body: CollectionCreate, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r = sb.table("collections").insert({
        "user_id": user.id,
        "name": body.name,
        "description": body.description,
    }).execute()
    if not r.data:
        raise HTTPException(status_code=500, detail="Failed to create collection")
    return r.data[0]

@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r = sb.table("collections").select("id").eq("id", collection_id).eq("user_id", user.id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Collection not found")
    sb.table("collections").delete().eq("id", collection_id).execute()
    return {"deleted": True}

@router.post("/{collection_id}/documents")
async def add_document(collection_id: str, body: CollectionAddDoc, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    # verify collection belongs to user
    c = sb.table("collections").select("id").eq("id", collection_id).eq("user_id", user.id).execute()
    if not c.data:
        raise HTTPException(status_code=404, detail="Collection not found")
    # verify doc belongs to user
    d = sb.table("documents").select("id").eq("id", body.document_id).eq("user_id", user.id).execute()
    if not d.data:
        raise HTTPException(status_code=404, detail="Document not found")
    sb.table("collection_documents").upsert({
        "collection_id": collection_id,
        "document_id": body.document_id,
    }).execute()
    return {"added": True}

@router.delete("/{collection_id}/documents/{document_id}")
async def remove_document(collection_id: str, document_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    c = sb.table("collections").select("id").eq("id", collection_id).eq("user_id", user.id).execute()
    if not c.data:
        raise HTTPException(status_code=404, detail="Collection not found")
    sb.table("collection_documents").delete() \
      .eq("collection_id", collection_id).eq("document_id", document_id).execute()
    return {"removed": True}

@router.get("/{collection_id}")
async def get_collection(collection_id: str, user=Depends(get_current_user)):
    sb = get_supabase_admin()
    c = sb.table("collections").select("*, collection_documents(document_id)") \
          .eq("id", collection_id).eq("user_id", user.id).execute()
    if not c.data:
        raise HTTPException(status_code=404, detail="Collection not found")
    col = c.data[0]
    doc_ids = [d["document_id"] for d in col.get("collection_documents", [])]
    docs = []
    if doc_ids:
        dr = sb.table("documents").select("id, name, status, file_type, chunk_count") \
               .in_("id", doc_ids).execute()
        docs = dr.data or []
    col["documents"] = docs
    return col
