#!/usr/bin/env python3
"""Build IELTS Part1 bank from a source PDF into structured JSON."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader

QUESTION_PREFIX = re.compile(r"^\s*[\-•·]\s*")
CHINESE_CHAR = re.compile(r"[\u4e00-\u9fff]")
ASCII_TEXT = re.compile(r"[A-Za-z]")
VALID_QUESTION = re.compile(r"^[A-Za-z0-9 ,.'()\-/?:]+\?$")
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "be",
    "can",
    "did",
    "do",
    "does",
    "for",
    "from",
    "have",
    "how",
    "in",
    "is",
    "it",
    "like",
    "of",
    "or",
    "that",
    "the",
    "there",
    "this",
    "to",
    "what",
    "where",
    "who",
    "why",
    "with",
    "would",
    "you",
    "your",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Part1 question bank JSON from PDF")
    parser.add_argument("--input", required=True, help="Path to source PDF")
    parser.add_argument("--output", required=True, help="Path to output JSON")
    return parser.parse_args()


def normalize_space(text: str) -> str:
    return " ".join(text.replace("\u00a0", " ").split())


def sanitize_question(raw: str) -> str | None:
    text = normalize_space(QUESTION_PREFIX.sub("", raw))
    if not text:
        return None

    if CHINESE_CHAR.search(text):
        first_cn = CHINESE_CHAR.search(text)
        if first_cn:
            text = text[: first_cn.start()].strip()

    if "/" in text:
        parts = [normalize_space(p) for p in text.split("/")]
        candidates = [p for p in parts if "?" in p]
        if candidates:
            text = candidates[0]

    text = text.rstrip("。！？! ")
    if not text.endswith("?"):
        if ASCII_TEXT.search(text):
            text = f"{text}?"

    text = normalize_space(text)
    if len(text) < 8 or len(text) > 220:
        return None
    if not VALID_QUESTION.match(text):
        return None
    return text


def classify_topic(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ("study", "subject", "major", "school")):
        return "study"
    if any(k in q for k in ("work", "job", "career", "colleague", "office")):
        return "work"
    if any(k in q for k in ("hometown", "city", "neighborhood", "neighbour", "area", "live", "home", "apartment", "house")):
        return "hometown"
    if any(k in q for k in ("daily", "week", "morning", "afternoon", "technology", "weather", "room", "transport")):
        return "daily_life"
    return "other"


def extract_keywords(question: str, topic: str, limit: int = 5) -> list[str]:
    words = re.findall(r"[a-z]+", question.lower())
    out: list[str] = []
    for word in words:
        if word in STOPWORDS or len(word) < 3:
            continue
        if word not in out:
            out.append(word)
        if len(out) >= limit:
            break
    if topic not in out:
        out.insert(0, topic)
    return out[:limit]


def is_answer_line(line: str) -> bool:
    text = normalize_space(line)
    if not text:
        return False
    if ".mp3" in text.lower():
        return False
    if CHINESE_CHAR.search(text):
        return False
    if text.lower().startswith(("part 1", "part1", "study", "work", "learning")) and len(text) < 30:
        return False
    if "?" in text:
        return False
    if not ASCII_TEXT.search(text):
        return False
    if len(text) < 30 or len(text) > 320:
        return False
    if text.endswith(":"):
        return False
    return True


def fallback_answers(question: str, topic: str) -> list[str]:
    return [
        f"For me, this is linked to my {topic.replace('_', ' ')} life, and it affects my routine quite a lot.",
        f"It depends on the situation, but overall I would answer this based on my own experience with {question[:-1].lower()}.",
    ]


def parse_pdf_records(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    lines: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines.extend([normalize_space(line) for line in text.splitlines() if normalize_space(line)])

    question_positions: list[tuple[int, str]] = []
    for idx, line in enumerate(lines):
        if not line.startswith(("•", "-", "·")):
            continue
        question = sanitize_question(line)
        if question:
            question_positions.append((idx, question))

    records: list[dict] = []
    for i, (q_idx, question) in enumerate(question_positions):
        next_idx = question_positions[i + 1][0] if i + 1 < len(question_positions) else len(lines)
        sample_answers: list[str] = []
        for line in lines[q_idx + 1 : next_idx]:
            if not is_answer_line(line):
                continue
            if line not in sample_answers:
                sample_answers.append(line)
            if len(sample_answers) >= 3:
                break

        if not is_valid_question(question):
            continue

        cleaned_answers = clean_and_merge_answers(sample_answers)

        if not cleaned_answers:
            continue

        topic = classify_topic(question)
        record_id = f"p1_{topic}_{len(records) + 1:03d}"
        keywords = extract_keywords(question, topic)

        record = {
            "id": record_id,
            "topic": topic,
            "question": question.strip(),
            "sample_answers": cleaned_answers,
            "keywords": keywords,
        }
        records.append(record)

    return records

def clean_and_merge_answers(answers: list[str]) -> list[str]:
    """
    Merge broken answer lines caused by PDF line breaks.
    """
    merged = []
    buffer = ""

    for line in answers:
        line = line.strip()
        if not line:
            continue

        # If buffer is empty, start it
        if not buffer:
            buffer = line
            continue

        # If buffer does not end with sentence punctuation,
        # and current line starts with lowercase or continuation
        if not re.search(r"[.!?]$", buffer) and re.match(r"^[a-z]", line):
            buffer += " " + line
        else:
            merged.append(buffer)
            buffer = line

    if buffer:
        merged.append(buffer)

    # Final cleanup
    return [m.strip() for m in merged if len(m.strip()) > 10]


def is_valid_question(question: str) -> bool:
    """
    Filter out obviously broken or dirty questions.
    """
    q = question.strip()

    # Too short
    if len(q) < 10:
        return False

    # Must look like a question
    if "?" not in q:
        return False

    # Obvious garbage
    blacklist = [
        ".mp3",
        ".wav",
        ".pdf",
        "audio",
    ]
    for bad in blacklist:
        if bad in q.lower():
            return False

    # OCR-style errors
    if re.search(r"\bDoyou\b", q):
        return False

    return True


def ensure_minimum_records(records: Iterable[dict], minimum: int = 50) -> list[dict]:
    out = list(records)
    if len(out) < minimum:
        raise ValueError(f"Only generated {len(out)} records, expected at least {minimum}")
    return out


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input PDF not found: {input_path}")

    records = ensure_minimum_records(parse_pdf_records(input_path), minimum=50)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} records to {output_path}")


if __name__ == "__main__":
    main()
