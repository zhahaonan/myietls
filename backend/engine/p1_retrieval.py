import json
import random
import re
from pathlib import Path
from typing import Any

BANK_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "p1_bank.json"
STOPWORDS = {"do", "you", "the", "a", "an", "to", "is", "are", "of", "in", "on"}

_CACHE: list[dict[str, Any]] | None = None


def _load_bank() -> list[dict[str, Any]]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    if not BANK_PATH.exists():
        _CACHE = []
        return _CACHE

    try:
        data = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    except Exception:
        _CACHE = []
        return _CACHE

    if not isinstance(data, list):
        _CACHE = []
        return _CACHE

    cleaned: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        question = item.get("question")
        sample_answers = item.get("sample_answers")
        if not isinstance(question, str) or not question.strip():
            continue
        if not isinstance(sample_answers, list) or not sample_answers:
            continue
        answers = [str(a).strip() for a in sample_answers if isinstance(a, str) and a.strip()]
        if not answers:
            continue

        cleaned.append(
            {
                "id": str(item.get("id") or ""),
                "topic": str(item.get("topic") or "other"),
                "question": question.strip(),
                "sample_answers": answers,
            }
        )

    _CACHE = cleaned
    return _CACHE


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if w and w not in STOPWORDS}


def retrieve_examples(question: str, topic: str | None = None, top_k: int = 5) -> list[dict]:
    """
    Return top_k Part1 example records.
    Each record includes: id, topic, question, sample_answers
    """
    records = _load_bank()
    if not records or top_k <= 0:
        return []

    topic_norm = (topic or "").strip().lower()
    query_tokens = _tokenize(question)

    scored: list[tuple[int, dict[str, Any]]] = []
    for rec in records:
        rec_tokens = _tokenize(rec.get("question", ""))
        score = len(query_tokens & rec_tokens)
        if topic_norm and str(rec.get("topic", "")).lower() == topic_norm:
            score += 2
        scored.append((score, rec))

    matched = [(score, rec) for score, rec in scored if score > 0]
    matched.sort(key=lambda item: item[0], reverse=True)

    if matched:
        return [rec for _, rec in matched[:top_k]]

    fallback = records
    if topic_norm:
        same_topic = [rec for rec in records if str(rec.get("topic", "")).lower() == topic_norm]
        if same_topic:
            fallback = same_topic

    k = min(top_k, len(fallback))
    return random.sample(fallback, k)
