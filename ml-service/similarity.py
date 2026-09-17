"""
IP Protection System - ML Similarity Engine
Provides text and image similarity algorithms:
- Text: Multi-gram TF-IDF Cosine Similarity, Jaccard Index, Sequence Alignment
- Image: Multi-Perceptual Hashing (dHash, aHash, pHash), Color Histograms
- Corpus Indexing and Similarity Search
"""

import os
import io
import re
import json
import math
from typing import Dict, List, Tuple, Any, Optional
from difflib import SequenceMatcher

import numpy as np
from PIL import Image

# Path to persistent corpus database
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
CORPUS_FILE = os.path.join(MODEL_DIR, "corpus_db.json")


def ensure_model_dir():
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR, exist_ok=True)


# =====================================================================
# TEXT SIMILARITY ENGINE
# =====================================================================

def preprocess_text(text: str) -> str:
    """Normalize text by lowering, removing unwanted symbols, and squashing whitespace."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_ngrams(tokens: List[str], n: int) -> List[str]:
    """Generate n-grams from a list of tokens."""
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Calculate term frequency for tokens."""
    tf: Dict[str, float] = {}
    if not tokens:
        return tf
    total = len(tokens)
    for t in tokens:
        tf[t] = tf.get(t, 0.0) + 1.0
    for t in tf:
        tf[t] /= total
    return tf


def cosine_similarity_from_tf(tf1: Dict[str, float], tf2: Dict[str, float]) -> float:
    """Compute cosine similarity between two term frequency dictionaries."""
    all_keys = set(tf1.keys()).union(set(tf2.keys()))
    if not all_keys:
        return 0.0
    dot = sum(tf1.get(k, 0.0) * tf2.get(k, 0.0) for k in all_keys)
    mag1 = math.sqrt(sum(v * v for v in tf1.values()))
    mag2 = math.sqrt(sum(v * v for v in tf2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot / (mag1 * mag2)


def jaccard_similarity(set1: set, set2: set) -> float:
    """Calculate Jaccard similarity index."""
    if not set1 or not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0


def sequence_ratio(text1: str, text2: str) -> float:
    """Sequence matcher ratio for contiguous substring alignment."""
    if not text1 or not text2:
        return 0.0
    return SequenceMatcher(None, text1, text2).ratio()


def calculate_text_similarity(text1: str, text2: str) -> Dict[str, Any]:
    """
    Computes an aggregate multi-metric text similarity score between two texts.
    Returns composite score, word-level cosine, character n-gram cosine, and matched fragments.
    """
    p1 = preprocess_text(text1)
    p2 = preprocess_text(text2)

    if not p1 or not p2:
        return {
            "score": 0.0,
            "word_cosine": 0.0,
            "ngram_cosine": 0.0,
            "sequence_similarity": 0.0,
            "jaccard": 0.0,
            "matched_sentences": []
        }

    words1 = p1.split()
    words2 = p2.split()

    # 1. Word unigram & bigram TF
    unigrams1 = words1
    unigrams2 = words2
    bigrams1 = get_ngrams(words1, 2)
    bigrams2 = get_ngrams(words2, 2)

    tokens1 = unigrams1 + bigrams1
    tokens2 = unigrams2 + bigrams2

    tf1 = compute_tf(tokens1)
    tf2 = compute_tf(tokens2)
    word_cosine = cosine_similarity_from_tf(tf1, tf2)

    # 2. Character 4-gram TF (resistant to typo injection & minor phrasing shifts)
    char_ngrams1 = [p1[i:i + 4] for i in range(max(0, len(p1) - 3))]
    char_ngrams2 = [p2[i:i + 4] for i in range(max(0, len(p2) - 3))]
    char_tf1 = compute_tf(char_ngrams1)
    char_tf2 = compute_tf(char_ngrams2)
    char_cosine = cosine_similarity_from_tf(char_tf1, char_tf2)

    # 3. Jaccard & Asymmetric Containment
    vocab_jaccard = jaccard_similarity(set(words1), set(words2))
    set1, set2 = set(words1), set(words2)
    containment1 = len(set1.intersection(set2)) / max(1, len(set1))
    containment2 = len(set1.intersection(set2)) / max(1, len(set2))
    max_containment = max(containment1, containment2)

    # 4. Sequence alignment
    sample_len = 1000
    seq_sim = sequence_ratio(p1[:sample_len], p2[:sample_len])

    # Weighted Composite Score (0.0 to 1.0)
    # Give strong weight to containment when a short text is an excerpt of a longer work
    base_score = (
        0.35 * word_cosine +
        0.20 * char_cosine +
        0.15 * vocab_jaccard +
        0.15 * seq_sim +
        0.15 * max_containment
    )
    # If one text is almost entirely contained in the other, boost score
    if max_containment > 0.80:
        base_score = max(base_score, 0.70 + 0.30 * (max_containment - 0.80) / 0.20)

    composite = min(1.0, max(0.0, base_score))

    # Identify matching sentence chunks
    sents1 = [s.strip() for s in re.split(r"[.!?\n]+", text1) if len(s.strip()) > 20]
    sents2 = [s.strip() for s in re.split(r"[.!?\n]+", text2) if len(s.strip()) > 20]
    matched_sents = []

    for s1 in sents1[:15]:
        ps1 = preprocess_text(s1)
        for s2 in sents2[:25]:
            ps2 = preprocess_text(s2)
            if sequence_ratio(ps1, ps2) > 0.75:
                matched_sents.append({
                    "query_excerpt": s1[:120],
                    "matched_excerpt": s2[:120],
                    "match_ratio": round(sequence_ratio(ps1, ps2), 3)
                })
                break

    # If there is an exact or near-exact sentence match, ensure plagiarism threshold
    if matched_sents and max(m["match_ratio"] for m in matched_sents) >= 0.85:
        composite = max(composite, 0.75)

    return {
        "score": round(composite, 4),
        "word_cosine": round(word_cosine, 4),
        "ngram_cosine": round(char_cosine, 4),
        "sequence_similarity": round(seq_sim, 4),
        "jaccard": round(vocab_jaccard, 4),
        "matched_sentences": matched_sents[:5]
    }


# =====================================================================
# IMAGE SIMILARITY ENGINE
# =====================================================================

def dhash(image: Image.Image, hash_size: int = 8) -> str:
    """
    Difference Hash (dHash).
    Calculates differences between adjacent pixels.
    """
    resized = image.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.BILINEAR)
    pixels = np.array(resized)
    diff = pixels[:, 1:] > pixels[:, :-1]
    return "".join("1" if b else "0" for b in diff.flatten())


def ahash(image: Image.Image, hash_size: int = 8) -> str:
    """
    Average Hash (aHash).
    Calculates whether pixels are above or below average luminance.
    """
    resized = image.convert("L").resize((hash_size, hash_size), Image.Resampling.BILINEAR)
    pixels = np.array(resized)
    avg = pixels.mean()
    bits = pixels > avg
    return "".join("1" if b else "0" for b in bits.flatten())


def phash(image: Image.Image, hash_size: int = 8, highfreq_factor: int = 4) -> str:
    """
    Perceptual Hash (pHash) using discrete cosine transform (DCT) approximation.
    Captures low-frequency luminance distribution.
    """
    img_size = hash_size * highfreq_factor
    resized = image.convert("L").resize((img_size, img_size), Image.Resampling.BILINEAR)
    pixels = np.asarray(resized, dtype=np.float32)

    # 2D DCT calculation
    def dct1d(arr):
        n = len(arr)
        result = np.zeros(n, dtype=np.float32)
        factor = np.pi / (2 * n)
        for k in range(n):
            c = np.cos((2 * np.arange(n) + 1) * k * factor)
            result[k] = np.sum(arr * c)
        return result

    # Perform row-wise and column-wise DCT
    dct_rows = np.apply_along_axis(dct1d, 1, pixels)
    dct = np.apply_along_axis(dct1d, 0, dct_rows)

    # Extract top-left 8x8 low frequencies (excluding DC component at 0,0)
    dct_low = dct[:hash_size, :hash_size]
    median = np.median(dct_low.flatten()[1:])
    bits = dct_low > median
    return "".join("1" if b else "0" for b in bits.flatten())


def hamming_distance(hash1: str, hash2: str) -> int:
    """Calculates Hamming distance between two binary hash strings."""
    if len(hash1) != len(hash2):
        return max(len(hash1), len(hash2))
    return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))


def color_histogram_similarity(img1: Image.Image, img2: Image.Image) -> float:
    """
    Calculates histogram intersection of RGB color distributions.
    """
    rgb1 = img1.convert("RGB").resize((100, 100), Image.Resampling.NEAREST)
    rgb2 = img2.convert("RGB").resize((100, 100), Image.Resampling.NEAREST)

    arr1 = np.array(rgb1)
    arr2 = np.array(rgb2)

    # 16-bin per channel histogram
    hist1, _ = np.histogramdd(arr1.reshape(-1, 3), bins=(8, 8, 8), range=[(0, 256), (0, 256), (0, 256)])
    hist2, _ = np.histogramdd(arr2.reshape(-1, 3), bins=(8, 8, 8), range=[(0, 256), (0, 256), (0, 256)])

    hist1 = hist1 / (np.sum(hist1) + 1e-9)
    hist2 = hist2 / (np.sum(hist2) + 1e-9)

    intersection = np.sum(np.minimum(hist1, hist2))
    return float(np.clip(intersection, 0.0, 1.0))


def compute_image_fingerprints(img: Image.Image) -> Dict[str, str]:
    """Generates all perceptual hashes for an image."""
    return {
        "dhash": dhash(img),
        "ahash": ahash(img),
        "phash": phash(img)
    }


def compare_image_fingerprints(fp1: Dict[str, str], fp2: Dict[str, str]) -> Dict[str, Any]:
    """Compares perceptual hashes between two images."""
    d_dist = hamming_distance(fp1.get("dhash", ""), fp2.get("dhash", ""))
    a_dist = hamming_distance(fp1.get("ahash", ""), fp2.get("ahash", ""))
    p_dist = hamming_distance(fp1.get("phash", ""), fp2.get("phash", ""))

    d_sim = max(0.0, 1.0 - (d_dist / 64.0))
    a_sim = max(0.0, 1.0 - (a_dist / 64.0))
    p_sim = max(0.0, 1.0 - (p_dist / 64.0))

    # pHash carries the highest weight as it is most invariant to transformations
    composite = 0.50 * p_sim + 0.35 * d_sim + 0.15 * a_sim

    return {
        "composite_similarity": round(composite, 4),
        "phash_similarity": round(p_sim, 4),
        "dhash_similarity": round(d_sim, 4),
        "ahash_similarity": round(a_sim, 4),
        "hamming_distances": {
            "phash": p_dist,
            "dhash": d_dist,
            "ahash": a_dist
        }
    }


# =====================================================================
# CORPUS DATABASE & SEARCH
# =====================================================================

class CorpusManager:
    """Manages the registered IP corpus for similarity and plagiarism checks."""

    def __init__(self):
        ensure_model_dir()
        self.corpus: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        if os.path.exists(CORPUS_FILE):
            try:
                with open(CORPUS_FILE, "r", encoding="utf-8-sig") as f:
                    self.corpus = json.load(f)
            except Exception as e:
                print(f"[CorpusManager] Failed to load corpus: {e}")
                self.corpus = []
        else:
            self._seed_default_corpus()

    def save(self):
        ensure_model_dir()
        with open(CORPUS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.corpus, f, indent=2)

    def _seed_default_corpus(self):
        """Pre-populate sample benchmark IP records."""
        self.corpus = [
            {
                "id": 0,
                "title": "Decentralized Autonomous Intellectual Property Protocol",
                "type": "text",
                "cid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
                "content_preview": "This specification describes a decentralized autonomous protocol for managing intellectual property on Ethereum with fractional license ownership and dynamic bonding curve pricing.",
                "text_content": "This specification describes a decentralized autonomous protocol for managing intellectual property on Ethereum with fractional license ownership and dynamic bonding curve pricing. Creators register verifiable digital assets and retain royalty shares while licensing rights are transferred transparently.",
                "owner": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "registered_at": "2026-09-10T10:00:00Z"
            },
            {
                "id": 1,
                "title": "ChainLicense Geometric Shield Logo",
                "type": "image",
                "cid": "QmZtmD2qt8fJpq3CLDHtaogZbaY4nd6aebPxZNJkLkN2R5",
                "fingerprints": {
                    "dhash": "1010101010101010110011001100110000110011001100111111000011110000",
                    "ahash": "1111111110000001100110011001100110011001100110011000000111111111",
                    "phash": "1100100110010110001111001100001110100101010110101111000000001111"
                },
                "owner": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "registered_at": "2026-09-11T12:00:00Z"
            }
        ]
        self.save()

    def get_all(self) -> List[Dict[str, Any]]:
        return self.corpus

    def find_duplicate(self, cid: Optional[str] = None, img: Optional[Image.Image] = None, text: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Checks if an identical or duplicate asset already exists in the corpus."""
        for item in self.corpus:
            # 1. Exact CID match
            if cid and item.get("cid") and item.get("cid") == cid:
                return {
                    "reason": "EXACT_CID_MATCH",
                    "matched_item": item,
                    "similarity": 1.0
                }
            # 2. Duplicate Image Fingerprint (exact or near-identical perceptual hash)
            if img is not None and item.get("type") == "image" and item.get("fingerprints"):
                fps = compute_image_fingerprints(img)
                cmp_res = compare_image_fingerprints(fps, item["fingerprints"])
                if cmp_res["composite_similarity"] >= 0.95:
                    return {
                        "reason": "DUPLICATE_IMAGE_FINGERPRINT",
                        "matched_item": item,
                        "similarity": cmp_res["composite_similarity"]
                    }
            # 3. Duplicate Text Content
            if text is not None and item.get("type") == "text" and item.get("text_content"):
                sim_res = calculate_text_similarity(text, item["text_content"])
                if sim_res["score"] >= 0.90:
                    return {
                        "reason": "DUPLICATE_TEXT_CONTENT",
                        "matched_item": item,
                        "similarity": sim_res["score"]
                    }
        return None

    def add_text_asset(self, asset_id: Any, title: str, text: str, cid: str, owner: str = "") -> Dict[str, Any]:
        dup = self.find_duplicate(cid=cid, text=text)
        if dup:
            matched = dup["matched_item"]
            raise ValueError(
                f"Duplicate asset rejected: Asset already registered in corpus as Property #{matched['id']} ('{matched['title']}')."
            )
        record = {
            "id": asset_id,
            "title": title or f"IP Asset #{asset_id}",
            "type": "text",
            "cid": cid,
            "content_preview": text[:200] + ("..." if len(text) > 200 else ""),
            "text_content": text,
            "owner": owner,
            "registered_at": "2026-09-15T12:00:00Z"
        }
        self.corpus.append(record)
        self.save()
        return record

    def add_image_asset(self, asset_id: Any, title: str, img: Image.Image, cid: str, owner: str = "") -> Dict[str, Any]:
        dup = self.find_duplicate(cid=cid, img=img)
        if dup:
            matched = dup["matched_item"]
            raise ValueError(
                f"Duplicate asset rejected: Asset already registered in corpus as Property #{matched['id']} ('{matched['title']}')."
            )
        fps = compute_image_fingerprints(img)
        record = {
            "id": asset_id,
            "title": title or f"IP Asset #{asset_id}",
            "type": "image",
            "cid": cid,
            "fingerprints": fps,
            "owner": owner,
            "registered_at": "2026-09-15T12:00:00Z"
        }
        self.corpus.append(record)
        self.save()
        return record

    def check_text_plagiarism(self, query_text: str) -> Dict[str, Any]:
        """
        Scans query_text against all text assets in the corpus.
        Returns top match, similarity breakdown, and risk assessment.
        """
        highest_score = 0.0
        best_match = None
        all_matches = []

        for item in self.corpus:
            if item.get("type") != "text" or not item.get("text_content"):
                continue

            sim_result = calculate_text_similarity(query_text, item["text_content"])
            score = sim_result["score"]

            match_info = {
                "id": item["id"],
                "title": item["title"],
                "cid": item["cid"],
                "score": score,
                "word_cosine": sim_result["word_cosine"],
                "ngram_cosine": sim_result["ngram_cosine"],
                "sequence_similarity": sim_result["sequence_similarity"],
                "jaccard": sim_result["jaccard"],
                "matched_sentences": sim_result["matched_sentences"]
            }
            all_matches.append(match_info)

            if score > highest_score:
                highest_score = score
                best_match = match_info

        all_matches.sort(key=lambda x: x["score"], reverse=True)

        # Risk Classification:
        # LOW: < 35% similarity (Clean / Original)
        # MEDIUM: 35% - 70% similarity (Suspect / Partial Overlap)
        # HIGH: >= 70% similarity (Plagiarism / Infringement Alert)
        if highest_score >= 0.70:
            risk = "HIGH"
            status = "PLAGIARISM_DETECTED"
            verdict = "High similarity detected! This content appears to infringe on an existing registered IP."
        elif highest_score >= 0.35:
            risk = "MEDIUM"
            status = "SUSPECT_OVERLAP"
            verdict = "Moderate similarity detected. Substantial text excerpts overlap with existing IP."
        else:
            risk = "LOW"
            status = "CLEAN"
            verdict = "Original content. No significant similarity found with registered IP assets."

        return {
            "highest_similarity": round(highest_score, 4),
            "percentage": round(highest_score * 100, 1),
            "risk_level": risk,
            "status": status,
            "verdict": verdict,
            "best_match": best_match,
            "top_matches": all_matches[:5]
        }

    def check_image_similarity(self, query_img: Image.Image) -> Dict[str, Any]:
        """
        Scans query_img against all image assets in the corpus.
        Returns top match, fingerprint distances, and infringement classification.
        """
        query_fps = compute_image_fingerprints(query_img)
        highest_score = 0.0
        best_match = None
        all_matches = []

        for item in self.corpus:
            if item.get("type") != "image" or not item.get("fingerprints"):
                continue

            cmp_res = compare_image_fingerprints(query_fps, item["fingerprints"])
            score = cmp_res["composite_similarity"]

            match_info = {
                "id": item["id"],
                "title": item["title"],
                "cid": item["cid"],
                "score": score,
                "phash_similarity": cmp_res["phash_similarity"],
                "dhash_similarity": cmp_res["dhash_similarity"],
                "hamming_distances": cmp_res["hamming_distances"]
            }
            all_matches.append(match_info)

            if score > highest_score:
                highest_score = score
                best_match = match_info

        all_matches.sort(key=lambda x: x["score"], reverse=True)

        if highest_score >= 0.75:
            risk = "HIGH"
            status = "INFRINGING_COPY"
            verdict = "Visual match detected! The image closely matches an existing registered property."
        elif highest_score >= 0.50:
            risk = "MEDIUM"
            status = "SUSPECT_SIMILARITY"
            verdict = "Visual similarity detected. Perceptual fingerprints share notable structural patterns."
        else:
            risk = "LOW"
            status = "CLEAN"
            verdict = "Original image. Perceptual fingerprints are distinct from all registered properties."

        return {
            "highest_similarity": round(highest_score, 4),
            "percentage": round(highest_score * 100, 1),
            "risk_level": risk,
            "status": status,
            "verdict": verdict,
            "query_fingerprints": query_fps,
            "best_match": best_match,
            "top_matches": all_matches[:5]
        }


# Global singleton corpus instance
corpus_manager = CorpusManager()
