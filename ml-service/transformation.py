"""
IP Protection System - ML Transformation & Forensics Engine
Detects evasive transformations applied to intellectual property:
- Images: Rotation, Horizontal/Vertical Flip, Cropping, Grayscale, Blurring, Rescaling
- Text: Synonym Substitution, Sentence Shuffling, Truncation/Expansion, Homoglyph Masking
"""

import io
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from PIL import Image, ImageFilter, ImageOps

from similarity import (
    dhash, ahash, phash, hamming_distance,
    preprocess_text, compute_tf, cosine_similarity_from_tf, sequence_ratio
)


# =====================================================================
# IMAGE TRANSFORMATION DETECTION
# =====================================================================

def generate_transformation_candidates(img: Image.Image) -> List[Dict[str, Any]]:
    """
    Generates common evasion transformation variants of an image to detect
    if the query is an altered derivative of a protected work.
    """
    candidates = []

    # 1. Rotations
    for angle in [90, 180, 270]:
        rotated = img.rotate(angle, expand=True)
        candidates.append({
            "type": f"ROTATION_{angle}_DEG",
            "image": rotated,
            "category": "geometric"
        })

    # 2. Horizontal Flip (Mirror)
    h_flip = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    candidates.append({
        "type": "HORIZONTAL_FLIP",
        "image": h_flip,
        "category": "geometric"
    })

    # 3. Vertical Flip
    v_flip = img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    candidates.append({
        "type": "VERTICAL_FLIP",
        "image": v_flip,
        "category": "geometric"
    })

    # 4. Center Crop (80% and 65%)
    w, h = img.size
    for pct in [0.80, 0.65]:
        left = int(w * (1 - pct) / 2)
        top = int(h * (1 - pct) / 2)
        right = int(w * (1 + pct) / 2)
        bottom = int(h * (1 + pct) / 2)
        if right > left and bottom > top:
            cropped = img.crop((left, top, right, bottom))
            candidates.append({
                "type": f"CENTER_CROP_{int(pct*100)}PCT",
                "image": cropped,
                "category": "spatial"
            })

    # 5. Grayscale / Desaturation
    gray = img.convert("L").convert("RGB")
    candidates.append({
        "type": "GRAYSCALE_CONVERSION",
        "image": gray,
        "category": "photometric"
    })

    # 6. Gaussian Blur
    blurred = img.filter(ImageFilter.GaussianBlur(radius=2))
    candidates.append({
        "type": "GAUSSIAN_BLUR",
        "image": blurred,
        "category": "filter"
    })

    return candidates


def detect_image_transformations(
    query_img: Image.Image,
    target_fingerprints: Dict[str, str]
) -> Dict[str, Any]:
    """
    Analyzes whether the query image is a transformed variation of a target image.
    Tests transformation hypotheses against target fingerprints.
    """
    target_phash = target_fingerprints.get("phash", "")
    target_dhash = target_fingerprints.get("dhash", "")

    if not target_phash:
        return {"is_transformed": False, "transformations": []}

    # First evaluate base image
    base_phash = phash(query_img)
    base_dist = hamming_distance(base_phash, target_phash)
    base_sim = max(0.0, 1.0 - (base_dist / 64.0))

    detected_transforms = []
    candidates = generate_transformation_candidates(query_img)

    for cand in candidates:
        cand_img = cand["image"]
        c_phash = phash(cand_img)
        c_dhash = dhash(cand_img)

        c_dist = hamming_distance(c_phash, target_phash)
        c_sim = max(0.0, 1.0 - (c_dist / 64.0))

        # If applying inverse transformation to candidate closes distance significantly:
        # e.g., candidate matches target with >= 0.75 similarity
        if c_sim >= 0.75:
            detected_transforms.append({
                "transformation_type": cand["type"],
                "category": cand["category"],
                "confidence": round(c_sim, 4),
                "hamming_distance": c_dist,
                "description": f"Image matches protected asset when adjusting for {cand['type'].replace('_', ' ').lower()}."
            })

    # Sort detected transformations by confidence
    detected_transforms.sort(key=lambda x: x["confidence"], reverse=True)

    is_transformed = len(detected_transforms) > 0 and (
        len(detected_transforms) > 0 and detected_transforms[0]["confidence"] > (base_sim + 0.10)
    )

    return {
        "is_transformed": is_transformed,
        "base_similarity": round(base_sim, 4),
        "top_transformation": detected_transforms[0] if detected_transforms else None,
        "all_detected_transformations": detected_transforms[:4],
        "verdict": (
            f"Derivative detected! Content matches protected IP via {detected_transforms[0]['transformation_type']}."
            if is_transformed else
            "No adversarial transformation pattern detected."
        )
    }


# =====================================================================
# TEXT TRANSFORMATION DETECTION
# =====================================================================

def detect_text_transformations(query_text: str, reference_text: str) -> Dict[str, Any]:
    """
    Detects evasion techniques applied to text:
    - Paraphrase & Structural Shuffling (high vocab overlap but low sequential order)
    - Truncation / Derivative excerpting
    - Character homoglyph or spacing obfuscation
    """
    p_query = preprocess_text(query_text)
    p_ref = preprocess_text(reference_text)

    if not p_query or not p_ref:
        return {"is_transformed": False, "transformations": []}

    q_words = p_query.split()
    r_words = p_ref.split()

    if not q_words or not r_words:
        return {"is_transformed": False, "transformations": []}

    # 1. Bag of Words TF Cosine
    tf_q = compute_tf(q_words)
    tf_r = compute_tf(r_words)
    bow_cosine = cosine_similarity_from_tf(tf_q, tf_r)

    # 2. Sequential alignment
    seq_ratio = sequence_ratio(p_query[:1000], p_ref[:1000])

    # 3. Word containment ratio
    q_set = set(q_words)
    r_set = set(r_words)
    containment = len(q_set.intersection(r_set)) / len(q_set) if q_set else 0.0

    detected_transforms = []

    # Case A: Shuffled / Paraphrased (High vocabulary overlap, significantly lower sentence order)
    if bow_cosine > 0.65 and seq_ratio < (bow_cosine - 0.20):
        detected_transforms.append({
            "type": "SYNTACTIC_REORDERING_PARAPHRASE",
            "confidence": round(bow_cosine, 3),
            "evidence": f"Vocabulary cosine is {round(bow_cosine*100)}% but word sequence alignment is only {round(seq_ratio*100)}%, indicating structural sentence rephrasing."
        })

    # Case B: Excerpt / Sub-document extraction
    len_ratio = len(q_words) / max(1, len(r_words))
    if containment > 0.70 and len_ratio < 0.6:
        detected_transforms.append({
            "type": "SELECTIVE_EXCERPT_EXTRACTION",
            "confidence": round(containment, 3),
            "evidence": f"{round(containment*100)}% of query vocabulary is directly lifted from a subset of the registered work."
        })

    # Case C: Character substitution / spacing anomalies
    raw_special_count = sum(1 for c in query_text if ord(c) > 127)
    if raw_special_count > 5:
        detected_transforms.append({
            "type": "HOMOGLYPH_OR_UNICODE_MASKING",
            "confidence": min(1.0, raw_special_count / 15.0),
            "evidence": f"Found {raw_special_count} non-ASCII or homoglyph characters often used to evade keyword filters."
        })

    is_transformed = len(detected_transforms) > 0

    return {
        "is_transformed": is_transformed,
        "vocabulary_cosine": round(bow_cosine, 4),
        "sequence_ratio": round(seq_ratio, 4),
        "word_containment": round(containment, 4),
        "detected_transformations": detected_transforms,
        "verdict": (
            "Derivative text detected with intentional structural reordering or excerpting."
            if is_transformed else
            "No adversarial rephrasing or obfuscation detected."
        )
    }
