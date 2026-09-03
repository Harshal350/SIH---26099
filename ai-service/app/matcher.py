"""
Matching engine: multi-layer matching pipeline.
Layers: exact -> fuzzy -> semantic -> attribute -> conflict -> classification -> confidence.
"""

import re
import numpy as np
from rapidfuzz import fuzz, process

from . import analyzer

_embedder = None

def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("paraphrase-MiniLM-L6-v2")
        except Exception:
            _embedder = False
    return _embedder if _embedder else None

def _fuzzy_score(a: str, b: str) -> float:
    a = analyzer.normalize_description(a)
    b = analyzer.normalize_description(b)
    if not a or not b:
        return 0.0
    return max(
        fuzz.ratio(a, b),
        fuzz.token_sort_ratio(a, b),
        fuzz.token_set_ratio(a, b),
    ) / 100.0

def _semantic_score(a: str, b: str) -> float:
    model = _get_embedder()
    if model is None:
        # Fallback: token-overlap cosine (word embeddings unavailable offline)
        return _token_semantic(a, b)
    va = model.encode([a], normalize_embeddings=True)[0]
    vb = model.encode([b], normalize_embeddings=True)[0]
    return float(np.dot(va, vb))

def _token_semantic(a: str, b: str) -> float:
    na = set(re.findall(r"[a-z0-9]+", a.lower()))
    nb = set(re.findall(r"[a-z0-9]+", b.lower()))
    if not na or not nb:
        return 0.0
    return len(na & nb) / max(1.0, len(na | nb))

def _norm_dna(dna: dict) -> dict:
    d = dict(dna or {})
    for k, v in d.items():
        if isinstance(v, str):
            d[k] = v.strip().upper()
        elif v is None:
            d[k] = None
    return d

_ATTRIBUTE_KEYS = ["material", "grade", "diameter", "length", "size",
                   "pressure_rating", "voltage", "capacity", "type", "standard"]

def _attr_compare(a: dict, b: dict):
    """Returns list of (attribute, valA, valB, status) where status is SAME/DIFF/MISSING."""
    a = _norm_dna(a)
    b = _norm_dna(b)
    results = []
    for key in _ATTRIBUTE_KEYS:
        va = a.get(key)
        vb = b.get(key)
        if va in (None, "", "None") and vb in (None, "", "None"):
            results.append((key, None, None, "MISSING"))
        elif va in (None, "", "None"):
            results.append((key, None, vb, "MISSING"))
        elif vb in (None, "", "None"):
            results.append((key, va, None, "MISSING"))
        elif va == vb:
            results.append((key, va, vb, "SAME"))
        else:
            results.append((key, va, vb, "DIFF"))
    return results

def _has_conflict(attr_results: list, dna_a: dict, dna_b: dict) -> tuple:
    """Critical technical attribute conflicts -> prevent auto-merge."""
    conflicts = []
    for key, va, vb, status in attr_results:
        if status == "DIFF":
            # For diameters/lengths, a difference is technically material
            conflicts.append({
                "attribute": key,
                "source": va,
                "candidate": vb,
                "note": "A differing technical specification prevents automatic combination."
            })
    return bool(conflicts), conflicts

def _classification(description_sim: float, attr_same: int, attr_total: int, has_conflict: bool):
    if has_conflict:
        return "POTENTIAL_MATCH"
    match_ratio = attr_same / max(1, attr_total)
    if description_sim >= 0.97:
        return "IDENTICAL"
    if description_sim >= 0.90 and match_ratio >= 0.8:
        return "DUPLICATE"
    if description_sim >= 0.75:
        return "NEAR_DUPLICATE"
    if match_ratio >= 0.7 or description_sim >= 0.6:
        return "FUNCTIONALLY_EQUIVALENT"
    return "POTENTIAL_MATCH"

def compare(a_desc: str, dna_a: dict, b_desc: str, dna_b: dict) -> dict:
    fuzzy = _fuzzy_score(a_desc, b_desc)
    semantic = _semantic_score(a_desc, b_desc)

    attr_results = _attr_compare(dna_a, dna_b)
    attr_same = sum(1 for _, _, _, s in attr_results if s == "SAME")
    attr_missing = sum(1 for _, _, _, s in attr_results if s == "MISSING")
    attr_diff = sum(1 for _, _, _, s in attr_results if s == "DIFF")
    attr_total = len(attr_results)

    has_conflict, conflicts = _has_conflict(attr_results, dna_a, dna_b)

    # Description agreement between the two records
    desc_agreement = 0.7 * fuzzy + 0.3 * semantic

    # Technical agreement measured over attributes that are PRESENT in either record
    present = attr_total - attr_missing
    tech_agreement = attr_same / max(1, present)

    desc_signal = desc_agreement
    attr_match_ratio = tech_agreement

    # Confidence built from both description and technical agreement
    base_confidence = 0.55 * desc_agreement + 0.45 * tech_agreement

    # Uncertainty penalties for missing critical attributes (honest: we are less sure)
    uncertainty = 0.0
    notes = []
    if (dna_a or {}).get("grade") in (None, "") or (dna_b or {}).get("grade") in (None, ""):
        uncertainty += 0.06
        notes.append("Grade is missing on one or both records; this adds uncertainty to the assessment.")
    if (dna_a or {}).get("diameter") in (None, "") or (dna_b or {}).get("diameter") in (None, ""):
        uncertainty += 0.03
    if (dna_a or {}).get("category") and (dna_b or {}).get("category") \
            and str((dna_a or {}).get("category")).upper() != str((dna_b or {}).get("category")).upper():
        uncertainty += 0.05
        notes.append("The material categories differ; this adds substantial uncertainty.")

    confidence = base_confidence - uncertainty

    # A technical conflict must prevent automatic combination and cap confidence
    if has_conflict:
        confidence = min(confidence * 0.45, 0.6)

    confidence = max(0.0, min(0.99, confidence))

    classification = _classification(desc_signal, attr_same, attr_total, has_conflict)

    explanation_lines = []
    reasons = []
    if _same(dna_a, dna_b, "material"):
        reasons.append("Same material")
    if _same(dna_a, dna_b, "grade"):
        reasons.append("Same grade")
    if _same(dna_a, dna_b, "diameter"):
        reasons.append("Same diameter")
    if _same(dna_a, dna_b, "length"):
        reasons.append("Same length")
    if fuzzy >= 0.7:
        reasons.append("Similar description")
    if not has_conflict and not attr_diff:
        reasons.append("No conflicting technical details")
    if has_conflict:
        reasons.append("Technical difference found")
    for n in notes:
        reasons.append(n)

    explanation_lines.append("AI assessment based on description and technical details.")
    explanation_lines.append("Match Confidence reflects evidence from the available description and attributes. "
                             "This is an AI recommendation, not a final decision.")

    return {
        "confidence": round(confidence, 3),
        "classification": classification,
        "fuzzy": round(fuzzy, 3),
        "semantic": round(semantic, 3),
        "attribute_same": attr_same,
        "attribute_diff": attr_diff,
        "attribute_missing": attr_missing,
        "attribute_total": attr_total,
        "attribute_match_ratio": round(attr_match_ratio, 3),
        "has_conflict": bool(has_conflict),
        "conflicts": conflicts,
        "reasons": reasons,
        "explanation": "\n".join(explanation_lines),
        "detail": {
            "description_similarity": round(desc_signal, 3),
            "meaning_similarity": round(semantic, 3),
            "attribute_matching": {
                "same": attr_same,
                "different": attr_diff,
                "missing": attr_missing,
                "total": attr_total,
            },
            "speculative": not has_conflict,
        },
        "uncertainty_v3": round(uncertainty, 3),
    }

def _same(a, b, key):
    va = a.get(key)
    vb = b.get(key)
    if va in (None, "", "None") or vb in (None, "", "None"):
        return False
    return str(va).strip().upper() == str(vb).strip().upper()
