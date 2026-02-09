from typing import Any, Dict, List

from engine import openai_client
from engine.p1_retrieval import retrieve_examples

ALLOWED_BANDS = {"5.5", "6", "6.5", "7", "7.5", "8"}


def _profile_to_text(profile: Dict[str, Any]) -> str:
    if not profile:
        return "No profile provided."

    lines: List[str] = []
    for key in ["identity", "ageGroup", "city", "currentLevel", "targetScore", "partner"]:
        value = profile.get(key)
        if value:
            lines.append(f"- {key}: {value}")

    hobbies = profile.get("hobbies")
    if isinstance(hobbies, list) and hobbies:
        lines.append(f"- hobbies: {', '.join(str(x) for x in hobbies)}")

    if not lines:
        return "No useful profile fields provided."

    return "\n".join(lines)


def _fallback_answer(question: str, profile: Dict[str, Any], band: str) -> str:
    identity = str(profile.get("identity") or "a student")
    city = str(profile.get("city") or "my city")
    hobbies = profile.get("hobbies") if isinstance(profile.get("hobbies"), list) else []
    hobby_text = f" In my free time, I usually enjoy {', '.join(str(x) for x in hobbies[:2])}." if hobbies else ""

    return (
        f"As {identity}, I'd say this is quite important in my daily life, especially in {city}."
        f" I try to answer naturally and give one clear reason with a simple example.{hobby_text}"
        f" Overall, this topic is easy for me to talk about at around band {band}."
    )


def _build_reference_examples(examples: List[Dict[str, Any]]) -> str:
    if not examples:
        return "No strong examples found."
    blocks: List[str] = []
    for ex in examples:
        ex_q = str(ex.get("question", "")).strip()
        answers = ex.get("sample_answers")
        ex_a = ""
        if isinstance(answers, list) and answers:
            ex_a = str(answers[0]).strip()
        if ex_q and ex_a:
            blocks.append(f"Q: {ex_q}\nA: {ex_a}")
    return "\n\n".join(blocks) if blocks else "No strong examples found."


def generate_p1_answer(question: str, band: str, profile: Dict[str, Any]) -> str:
    topic = profile.get("topic") if isinstance(profile, dict) else None
    topic_str = str(topic).strip() if isinstance(topic, str) else None
    examples = retrieve_examples(question=question, topic=topic_str, top_k=5)
    print(f"[p1_answer] retrieved_example_ids={[e.get('id') for e in examples]}")
    references_block = _build_reference_examples(examples)

    system_prompt = (
        "你是一名雅思口语 Part 1 教练。"
        "使用参考资料作为风格指导，不要逐字复制。"
        "编写一个自然的英语口语回答，2-4 句话，不要使用要点。"
        "根据个人资料进行个性化定制，并严格匹配要求的分数段。"
    )

    user_prompt = (
        f"目标分数: {band}\n"
        f"问题: {question}\n"
        f"个人资料:\n{_profile_to_text(profile)}\n\n"
        "参考范例 (不要逐字复制):\n"
        f"{references_block}\n\n"
        "仅返回一个回答，雅思口语 Part 1 风格，2-4 句话。"
    )

    try:
        answer = openai_client.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
        )
    except RuntimeError:
        return _fallback_answer(question=question, profile=profile, band=band)

    cleaned = " ".join(answer.strip().split())
    if not cleaned:
        return _fallback_answer(question=question, profile=profile, band=band)

    return cleaned
