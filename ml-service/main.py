"""
IP Protection System - ML Microservice API
FastAPI service exposing plagiarism detection, transformation forensics,
and IP asset corpus indexing endpoints.
"""

import os
import io
import json
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

try:
    import pypdf
except ImportError:
    pypdf = None

from similarity import (
    corpus_manager,
    calculate_text_similarity,
    compute_image_fingerprints,
    compare_image_fingerprints
)
from transformation import (
    detect_image_transformations,
    detect_text_transformations
)

app = FastAPI(
    title="IP Protection ML Service",
    description="Machine Learning service for Intellectual Property plagiarism detection and transformation forensics.",
    version="2.0.0"
)

# Enable CORS for frontend and backend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# REQUEST SCHEMAS
# =====================================================================

class TextCheckRequest(BaseModel):
    text: str
    title: Optional[str] = None


class RegisterTextAssetRequest(BaseModel):
    id: int
    title: str
    text: str
    cid: str
    owner: Optional[str] = ""


# =====================================================================
# HELPER FUNCTIONS
# =====================================================================

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts plain text from PDF stream."""
    if pypdf is None:
        return pdf_bytes.decode("utf-8", errors="ignore")
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        return "\n".join(pages_text)
    except Exception as e:
        return pdf_bytes.decode("utf-8", errors="ignore")


# =====================================================================
# API ENDPOINTS
# =====================================================================

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "IP Protection ML Service",
        "version": "2.0.0",
        "corpus_assets_count": len(corpus_manager.get_all())
    }


@app.get("/corpus")
def get_corpus():
    """Returns all registered IP assets currently indexed in the ML corpus."""
    return {
        "count": len(corpus_manager.get_all()),
        "assets": corpus_manager.get_all()
    }


@app.post("/check/text")
def check_text(req: TextCheckRequest):
    """
    Evaluates text plagiarism against registered IP corpus.
    Runs multi-gram TF-IDF cosine, vocabulary Jaccard, sequence alignment,
    and transformation reordering forensics.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    plag_result = corpus_manager.check_text_plagiarism(req.text)

    # If best match found, perform transformation forensics
    transformations = {"is_transformed": False, "detected_transformations": []}
    if plag_result.get("best_match"):
        matched_id = plag_result["best_match"]["id"]
        # Find raw text in corpus
        for item in corpus_manager.get_all():
            if item["id"] == matched_id and item.get("text_content"):
                transformations = detect_text_transformations(req.text, item["text_content"])
                break

    return {
        "type": "text",
        "similarity_score": plag_result["highest_similarity"],
        "percentage": plag_result["percentage"],
        "risk_level": plag_result["risk_level"],
        "status": plag_result["status"],
        "verdict": plag_result["verdict"],
        "best_match": plag_result["best_match"],
        "top_matches": plag_result["top_matches"],
        "transformation_analysis": transformations
    }


@app.post("/check/image")
async def check_image(file: UploadFile = File(...)):
    """
    Evaluates image similarity and transformation forensics against protected works.
    Detects rotations, horizontal/vertical flips, crops, and desaturation.
    """
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    sim_result = corpus_manager.check_image_similarity(img)

    # If matches exist, evaluate transformation candidates
    transformation_report = {"is_transformed": False, "all_detected_transformations": []}
    if sim_result.get("best_match"):
        matched_id = sim_result["best_match"]["id"]
        for item in corpus_manager.get_all():
            if item["id"] == matched_id and item.get("fingerprints"):
                transformation_report = detect_image_transformations(img, item["fingerprints"])
                break

    # If transformation detection found a derivative with higher confidence, update final verdict
    final_score = sim_result["highest_similarity"]
    if transformation_report.get("is_transformed"):
        top_conf = transformation_report["top_transformation"]["confidence"]
        if top_conf > final_score:
            final_score = top_conf
            sim_result["risk_level"] = "HIGH"
            sim_result["status"] = "TRANSFORMED_DERIVATIVE_DETECTED"
            sim_result["verdict"] = transformation_report["verdict"]

    return {
        "type": "image",
        "similarity_score": round(final_score, 4),
        "percentage": round(final_score * 100, 1),
        "risk_level": sim_result["risk_level"],
        "status": sim_result["status"],
        "verdict": sim_result["verdict"],
        "best_match": sim_result["best_match"],
        "top_matches": sim_result["top_matches"],
        "query_fingerprints": sim_result.get("query_fingerprints"),
        "transformation_analysis": transformation_report
    }


@app.post("/verify")
async def verify_file_or_text(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None)
):
    """
    Unified Verification Endpoint:
    Accepts any uploaded document (PDF, TXT, PNG, JPG, JPEG) or raw text string.
    Automatically directs through text or visual ML forensics pipeline.
    """
    if file is not None:
        filename = file.filename.lower() if file.filename else ""
        content_type = file.content_type or ""

        # 1. Image Files
        if any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]) or "image/" in content_type:
            return await check_image(file)

        # 2. PDF Files
        if filename.endswith(".pdf") or "pdf" in content_type:
            contents = await file.read()
            extracted_text = extract_text_from_pdf_bytes(contents)
            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract readable text from PDF.")
            req = TextCheckRequest(text=extracted_text, title=file.filename)
            res = check_text(req)
            res["filename"] = file.filename
            res["extracted_char_count"] = len(extracted_text)
            return res

        # 3. Plain Text / Markdown / Code Files
        contents = await file.read()
        try:
            text_str = contents.decode("utf-8")
        except UnicodeDecodeError:
            text_str = contents.decode("latin-1", errors="ignore")

        req = TextCheckRequest(text=text_str, title=file.filename)
        res = check_text(req)
        res["filename"] = file.filename
        return res

    elif raw_text and raw_text.strip():
        req = TextCheckRequest(text=raw_text)
        return check_text(req)

    else:
        raise HTTPException(status_code=400, detail="Please provide either a file upload or raw_text parameter.")


@app.post("/corpus/register")
async def register_asset_to_corpus(
    id: int = Form(...),
    title: str = Form(...),
    cid: str = Form(...),
    owner: str = Form(""),
    file: Optional[UploadFile] = File(None),
    text_content: Optional[str] = Form(None)
):
    """
    Registers a new intellectual property asset into the ML corpus.
    Computes fingerprints/features and persists to corpus_db.json.
    """
    if file is not None:
        filename = file.filename.lower() if file.filename else ""
        content_type = file.content_type or ""

        # Image registration
        if any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]) or "image/" in content_type:
            contents = await file.read()
            img = Image.open(io.BytesIO(contents)).convert("RGB")
            record = corpus_manager.add_image_asset(
                asset_id=id,
                title=title,
                img=img,
                cid=cid,
                owner=owner
            )
            return {"status": "success", "message": "Image asset registered into ML corpus", "record": record}

        # PDF registration
        if filename.endswith(".pdf") or "pdf" in content_type:
            contents = await file.read()
            extracted = extract_text_from_pdf_bytes(contents)
            record = corpus_manager.add_text_asset(
                asset_id=id,
                title=title,
                text=extracted,
                cid=cid,
                owner=owner
            )
            return {"status": "success", "message": "PDF text registered into ML corpus", "record": record}

        # Text file registration
        contents = await file.read()
        try:
            t = contents.decode("utf-8")
        except UnicodeDecodeError:
            t = contents.decode("latin-1", errors="ignore")

        record = corpus_manager.add_text_asset(
            asset_id=id,
            title=title,
            text=t,
            cid=cid,
            owner=owner
        )
        return {"status": "success", "message": "Text asset registered into ML corpus", "record": record}

    elif text_content and text_content.strip():
        record = corpus_manager.add_text_asset(
            asset_id=id,
            title=title,
            text=text_content,
            cid=cid,
            owner=owner
        )
        return {"status": "success", "message": "Text content registered into ML corpus", "record": record}

    else:
        raise HTTPException(status_code=400, detail="Missing file or text_content for registration.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
