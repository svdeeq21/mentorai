"""
core/pipeline.py
Document ingestion pipeline.
Tier 1: unstructured hi_res (detectron2 layout model) — extracts text + figures/tables
Tier 2: unstructured fast (fallback if hi_res unavailable)
Tier 3: PyMuPDF text layer
Tier 4: Tesseract OCR
Then chunks → embeds → upserts into Qdrant.
"""
from __future__ import annotations
import base64
import hashlib
import os
import tempfile
from pathlib import Path
from typing import Callable

from langchain_huggingface import HuggingFaceEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from config import get_settings

settings = get_settings()

_embeddings: HuggingFaceEmbeddings | None = None

def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.embed_model,
            model_kwargs={"device": "cpu"},
        )
    return _embeddings


_qdrant: QdrantClient | None = None

def get_qdrant() -> QdrantClient:
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            timeout=120,
        )
        _ensure_collection(_qdrant)
    return _qdrant


def _ensure_collection(client: QdrantClient) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )


# ── Image helpers ─────────────────────────────────────────

def _element_to_base64(element) -> str | None:
    """Extract base64 image data from an unstructured Image/Figure element."""
    try:
        # unstructured stores image data in metadata.image_base64
        if hasattr(element, "metadata"):
            b64 = getattr(element.metadata, "image_base64", None)
            if b64:
                return b64
        # fallback: read from image_path if present
        if hasattr(element, "metadata"):
            img_path = getattr(element.metadata, "image_path", None)
            if img_path and os.path.exists(img_path):
                with open(img_path, "rb") as f:
                    return base64.b64encode(f.read()).decode()
    except Exception:
        pass
    return None


def _page_screenshot(pdf_path: str, page_number: int, dpi: int = 120) -> str | None:
    """Render a single PDF page as a base64 PNG (fallback visual context)."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        page = doc[page_number - 1]
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        result = base64.b64encode(pix.tobytes("png")).decode()
        doc.close()
        return result
    except Exception:
        return None


def _all_page_screenshots(pdf_path: str, dpi: int = 120) -> dict[int, str]:
    """Render all pages — used as fallback when hi_res unavailable."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        out = {}
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            out[page.number + 1] = base64.b64encode(pix.tobytes("png")).decode()
        doc.close()
        return out
    except Exception:
        return {}


# ── PDF extraction (4-tier) ───────────────────────────────

def _extract_pdf_hires(path: str, progress: Callable) -> tuple[list, dict[int, list[str]]]:
    """
    Tier 1: unstructured hi_res strategy.
    Returns (elements, {page_num: [base64_figure, ...]}).
    Raises ImportError / RuntimeError if hi_res not available.
    """
    from unstructured.partition.pdf import partition_pdf

    # Use a temp dir for extracted images so unstructured can write them
    with tempfile.TemporaryDirectory() as img_dir:
        elements = partition_pdf(
            filename=path,
            strategy="hi_res",
            infer_table_structure=True,
            extract_images_in_pdf=True,
            extract_image_block_types=["Image", "Figure", "Table"],
            extract_image_block_output_dir=img_dir,
            extract_image_block_to_payload=True,   # puts base64 in metadata
        )
        progress(f"hi_res: {len(elements)} elements extracted")

        # Collect figures per page
        figures_by_page: dict[int, list[str]] = {}
        for el in elements:
            el_type = type(el).__name__
            if el_type in ("Image", "FigureCaption", "Table"):
                b64 = _element_to_base64(el)
                if b64:
                    page_num = getattr(el.metadata, "page_number", None)
                    if page_num:
                        figures_by_page.setdefault(page_num, []).append(b64)

        return elements, figures_by_page


def _extract_pdf(path: str, progress: Callable) -> tuple[list, dict[int, list[str]], dict[int, str]]:
    """
    Try hi_res → fast → PyMuPDF → OCR.
    Returns (elements, figures_by_page, page_screenshots).
    """
    elements       = []
    figures_by_page: dict[int, list[str]] = {}
    page_screenshots: dict[int, str]     = {}

    # Tier 1 — hi_res
    try:
        elements, figures_by_page = _extract_pdf_hires(path, lambda m: progress(m, 15))
        progress(f"hi_res complete: {len(figures_by_page)} pages with figures", 20)
        # Still capture low-res screenshots for pages WITHOUT figures (text context)
        try:
            import fitz
            doc = fitz.open(path)
            matrix = fitz.Matrix(100 / 72, 100 / 72)
            for page in doc:
                pn = page.number + 1
                if pn not in figures_by_page:
                    pix = page.get_pixmap(matrix=matrix, alpha=False)
                    page_screenshots[pn] = base64.b64encode(pix.tobytes("png")).decode()
            doc.close()
        except Exception:
            pass
        return elements, figures_by_page, page_screenshots
    except Exception as e:
        progress(f"hi_res unavailable ({type(e).__name__}): falling back", 12)

    # Tier 2 — unstructured fast
    try:
        from unstructured.partition.pdf import partition_pdf
        elements = partition_pdf(filename=path, strategy="fast",
                                 infer_table_structure=True)
        progress(f"fast: {len(elements)} elements", 20)
    except Exception as e:
        progress(f"fast failed: {e}", 15)

    # Tier 3 — PyMuPDF
    if not elements:
        try:
            import fitz
            from unstructured.documents.elements import Text, Title
            doc = fitz.open(path)
            for page in doc:
                page_text = page.get_text("text").strip()
                if page_text:
                    blocks = [b.strip() for b in page_text.split("\n\n") if b.strip()]
                    for j, block in enumerate(blocks):
                        el = Title(text=block) if j == 0 and len(block) < 120 else Text(text=block)
                        el.metadata.page_number = page.number + 1
                        elements.append(el)
            doc.close()
            progress(f"PyMuPDF: {len(elements)} elements", 20)
        except Exception as e:
            progress(f"PyMuPDF failed: {e}", 15)

    # Tier 4 — OCR
    if not elements:
        try:
            import fitz, pytesseract, io
            from PIL import Image as PILImage
            from unstructured.documents.elements import Text
            doc = fitz.open(path)
            for page in doc:
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                img = PILImage.open(io.BytesIO(pix.tobytes("png")))
                ocr_text = pytesseract.image_to_string(img).strip()
                if ocr_text:
                    for block in [b.strip() for b in ocr_text.split("\n\n") if b.strip()]:
                        el = Text(text=block)
                        el.metadata.page_number = page.number + 1
                        elements.append(el)
            doc.close()
            progress(f"OCR: {len(elements)} elements", 20)
        except Exception as e:
            progress(f"OCR failed: {e}", 15)

    # For fallback tiers, use PyMuPDF embedded image extraction
    try:
        import fitz
        doc = fitz.open(path)
        for page in doc:
            pn = page.number + 1
            # Low-res screenshot for every page
            pix = page.get_pixmap(matrix=fitz.Matrix(100/72, 100/72), alpha=False)
            page_screenshots[pn] = base64.b64encode(pix.tobytes("png")).decode()
            # Extract embedded bitmap images as figures
            for img_info in page.get_images(full=True):
                try:
                    base_img = doc.extract_image(img_info[0])
                    img_bytes = base_img["image"]
                    # Skip small images (icons, logos, decorations)
                    # Require at least 30KB — real figures are almost always larger
                    if len(img_bytes) < 30_000:
                        continue
                    # Skip images with extreme aspect ratios (thin banners, dividers)
                    try:
                        import io
                        from PIL import Image as _PIL
                        _img = _PIL.open(io.BytesIO(img_bytes))
                        w, h = _img.size
                        ratio = max(w, h) / max(min(w, h), 1)
                        if ratio > 8:   # very wide/tall = banner/divider, not a figure
                            continue
                        if w < 100 or h < 100:  # too small regardless of file size
                            continue
                    except Exception:
                        pass
                    b64 = base64.b64encode(img_bytes).decode()
                    figures_by_page.setdefault(pn, []).append(b64)
                except Exception:
                    pass
        doc.close()
    except Exception:
        pass

    return elements, figures_by_page, page_screenshots


# ── Non-PDF extraction ────────────────────────────────────

def _extract_other(path: str, ext: str) -> list:
    if ext == "docx":
        from unstructured.partition.docx import partition_docx
        return partition_docx(filename=path)
    elif ext == "pptx":
        from unstructured.partition.pptx import partition_pptx
        return partition_pptx(filename=path)
    elif ext == "xlsx":
        from unstructured.partition.xlsx import partition_xlsx
        return partition_xlsx(filename=path)
    elif ext in ("txt", "md"):
        from unstructured.partition.text import partition_text
        return partition_text(filename=path)
    elif ext == "html":
        from unstructured.partition.html import partition_html
        return partition_html(filename=path)
    elif ext == "csv":
        from unstructured.partition.csv import partition_csv
        return partition_csv(filename=path)
    else:
        from unstructured.partition.auto import partition
        return partition(filename=path)


# ── Chunking ──────────────────────────────────────────────

def chunk_elements(elements: list) -> list:
    try:
        from unstructured.chunking.title import chunk_by_title
        return chunk_by_title(
            elements,
            max_characters=3000,
            new_after_n_chars=2400,
            combine_text_under_n_chars=500,
        )
    except Exception:
        class _Chunk:
            def __init__(self, text: str):
                self.text = text
                class _M:
                    page_number = None
                    orig_elements = []
                self.metadata = _M()
        all_text = "\n\n".join(
            el.text for el in elements if hasattr(el, "text") and el.text
        )
        return [
            _Chunk(all_text[i:i+3000])
            for i in range(0, len(all_text), 3000)
            if all_text[i:i+3000].strip()
        ]


# ── Main pipeline ─────────────────────────────────────────

def run_pipeline(
    file_bytes: bytes,
    filename: str,
    user_id: str,
    document_id: str,
    progress: Callable[[str, int], None],
) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower()

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        progress("Extracting content...", 10)

        figures_by_page:  dict[int, list[str]] = {}
        page_screenshots: dict[int, str]       = {}

        if ext == "pdf":
            elements, figures_by_page, page_screenshots = _extract_pdf(
                tmp_path, lambda m, p: progress(m, p)
            )
        else:
            elements = _extract_other(tmp_path, ext)

        if not elements:
            raise ValueError(
                "Could not extract any content from this document. "
                "It may be corrupted or password-protected."
            )

        total_figs = sum(len(v) for v in figures_by_page.values())
        progress(f"{len(elements)} elements, {total_figs} figures extracted", 30)

        progress("Chunking content...", 40)
        chunks = chunk_elements(elements)
        progress(f"{len(chunks)} chunks created", 50)

        progress("Embedding and indexing...", 55)
        embeddings = get_embeddings()
        qdrant     = get_qdrant()

        points = []
        for i, chunk in enumerate(chunks):
            text = chunk.text if hasattr(chunk, "text") else str(chunk)
            if not text.strip():
                continue

            vector   = embeddings.embed_query(text)
            chunk_id = hashlib.md5(f"{document_id}_{i}_{text[:50]}".encode()).hexdigest()

            page_num = None
            if hasattr(chunk, "metadata"):
                page_num = getattr(chunk.metadata, "page_number", None)

            points.append(PointStruct(
                id=int(chunk_id[:8], 16),
                vector=vector,
                payload={
                    "text":            text,
                    "document_id":     document_id,
                    "user_id":         user_id,
                    "page_number":     page_num,
                    "figures":         figures_by_page.get(page_num, []) if page_num else [],
                    "page_screenshot": page_screenshots.get(page_num) if page_num else None,
                    "chunk_index":     i,
                }
            ))

            if i % 10 == 0:
                pct = 55 + int((i / max(len(chunks), 1)) * 35)
                progress(f"Indexed {i+1}/{len(chunks)} chunks...", pct)

        batch_size = 50
        for i in range(0, len(points), batch_size):
            qdrant.upsert(
                collection_name=settings.qdrant_collection,
                points=points[i:i+batch_size],
            )

        progress("Indexing complete!", 100)
        return {
            "chunks":   len(points),
            "pages":    len(page_screenshots) + len(figures_by_page),
            "elements": len(elements),
            "figures":  total_figs,
        }

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass