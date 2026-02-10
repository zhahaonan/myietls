import os
import re
import json
import time
import base64
import urllib.request
import urllib.error
from typing import List, Dict, Any
from . import llm_client
from .rag import AgenticRAG

DASHSCOPE_ASR_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription"
)
DASHSCOPE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks"


def _parse_llm_json(raw: str):
    """Strip markdown fences and parse JSON from LLM output."""
    text = raw.strip()
    # Remove ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()
    return json.loads(text)


def _transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio using DashScope SenseVoice (async API with base64)."""
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        return "(语音转写不可用: 缺少 DASHSCOPE_API_KEY)"

    # Step 1: Base64 encode audio and build data URI
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    data_uri = f"data:audio/wav;base64,{b64}"

    # Step 2: Submit async transcription task
    payload = json.dumps({
        "model": "sensevoice-v1",
        "input": {"file_urls": [data_uri]},
    }).encode("utf-8")

    req = urllib.request.Request(
        url=DASHSCOPE_ASR_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "X-DashScope-Async": "enable",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            submit_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:200]
        return f"(语音转写提交失败: HTTP {exc.code} - {detail})"
    except Exception as e:
        return f"(语音转写提交失败: {str(e)[:100]})"

    task_id = submit_data.get("output", {}).get("task_id", "")
    if not task_id:
        return "(语音转写失败: 未获取到 task_id)"

    # Step 3: Poll for task completion
    task_url = f"{DASHSCOPE_TASK_URL}/{task_id}"
    for _ in range(30):  # max 30 seconds
        time.sleep(1)
        try:
            poll_req = urllib.request.Request(
                url=task_url,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            with urllib.request.urlopen(poll_req, timeout=10) as resp:
                poll_data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue

        status = poll_data.get("output", {}).get("task_status", "")
        if status == "SUCCEEDED":
            results = poll_data.get("output", {}).get("results", [])
            if not results:
                return "(转写结果为空)"
            transcription_url = results[0].get("transcription_url", "")
            if not transcription_url:
                return "(转写结果为空)"

            # Step 4: Fetch transcription JSON
            try:
                with urllib.request.urlopen(transcription_url, timeout=10) as tr:
                    tr_data = json.loads(tr.read().decode("utf-8"))
                raw_text = tr_data.get("transcripts", [{}])[0].get("text", "")
                # Strip SenseVoice tags like <|Speech|> and <|/Speech|>
                clean = re.sub(r"<\|[^|]*\|>", "", raw_text).strip().rstrip(".")
                return clean if clean else "(转写结果为空)"
            except Exception as e:
                return f"(转写结果获取失败: {str(e)[:100]})"

        elif status == "FAILED":
            msg = poll_data.get("output", {}).get("message", "unknown error")
            return f"(语音转写失败: {msg[:100]})"

    return "(语音转写超时)"


def _analyze_pronunciation(transcription: str, anchor_words: List[str]) -> List[Dict[str, Any]]:
    """Use LLM to compare STT transcription against anchor words for pronunciation feedback."""
    if not anchor_words:
        return []

    words_str = ", ".join(anchor_words)
    prompt = (
        f"You are a pronunciation analysis expert.\n"
        f"The student was supposed to use these anchor words: [{words_str}]\n"
        f"The speech-to-text system transcribed their speech as:\n\"{transcription}\"\n\n"
        f"For EACH anchor word, determine:\n"
        f"1. \"correct\" - the word appears correctly in the transcription (allow minor punctuation/case differences)\n"
        f"2. \"mispronounced\" - a phonetically similar but wrong form appears (e.g. routine→root teen, fulfillment→fulfill meant)\n"
        f"3. \"missing\" - the word was not said at all\n\n"
        f"Return ONLY a JSON array. Each element:\n"
        f'{{"word":"<anchor>","status":"correct|mispronounced|missing","recognized_as":"<what STT heard or null>","ipa":"/<IPA of correct pronunciation>/","hint":"<short Chinese tip, max 15 chars>"}}\n'
        f"For correct words, ipa and hint can be empty strings. recognized_as should be null for correct and missing."
    )

    try:
        raw = llm_client.chat(
            messages=[
                {"role": "system", "content": "You are a pronunciation analysis expert. Return only valid JSON array, nothing else."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        # Strip markdown fences if present
        return _parse_llm_json(raw)
    except (json.JSONDecodeError, RuntimeError):
        # Fallback: simple string matching, no IPA
        result = []
        lower_trans = transcription.lower()
        for w in anchor_words:
            if w.lower() in lower_trans:
                result.append({"word": w, "status": "correct", "recognized_as": None, "ipa": "", "hint": ""})
            else:
                result.append({"word": w, "status": "missing", "recognized_as": None, "ipa": "", "hint": ""})
        return result


class CamelIELTSAgent:
    """
    Orchestrates a CAMEL-style Role-Playing interaction between AI Agents.
    Uses DashScope Qwen for LLM and SenseVoice for STT.
    """

    def __init__(self):
        self.rag = AgenticRAG()

    async def run_roleplay_evaluation(
        self, audio_bytes: bytes, question: str, target_level: str, part: str,
        anchor_words: List[str] = None,
    ):
        thoughts = []

        # PHASE 0: Signal Processing (STT)
        thoughts.append("Agent: [AudioNode] 正在通过 SenseVoice 解码考生回答...")
        transcription = _transcribe_audio(audio_bytes)
        thoughts.append(
            f"Agent: [AudioNode] 信号已锁定。内容: '{transcription[:60]}...'"
        )

        # PHASE 0.5: Pronunciation Analysis (anchor words)
        pronunciation_feedback = []
        if anchor_words:
            thoughts.append("Agent: [PronunciationCoach] 正在分析锚点词发音准确性...")
            pronunciation_feedback = _analyze_pronunciation(transcription, anchor_words)
            correct_count = sum(1 for p in pronunciation_feedback if p.get("status") == "correct")
            thoughts.append(
                f"Agent: [PronunciationCoach] 分析完成: {correct_count}/{len(anchor_words)} 个锚点词发音正确"
            )

        # PHASE 1: Knowledge Retrieval (RAG)
        thoughts.append(
            f"Agent: [Critic] 正在获取目标分数 {target_level} 的 RAG 评分标准..."
        )
        rag_data = self.rag.retrieve_ielts_knowledge(transcription, target_level)

        # PHASE 2: Role-Playing Loop (CAMEL Style)
        # Agent A: The Examiner
        thoughts.append("Agent: [Examiner] 正在根据官方评分标准评估回答...")
        initial_assessment = llm_client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "你是一名资深雅思考官。根据流利度 (Fluency)、词汇 (Lexical) 和语法 (Grammar) 评估学生。保持专业。",
                },
                {
                    "role": "user",
                    "content": f"听写文本: {transcription}\n上下文: {rag_data}",
                },
            ],
            temperature=0.5,
        )

        # Agent B: The Critic (Peer Review)
        thoughts.append("Agent: [Critic] 正在复审考官评估并提出升级建议...")
        critic_report = llm_client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "你是一名语言评论家。审查考官的报告。提出 3 个高级搭配来替换学生回答中的基础词汇。",
                },
                {
                    "role": "user",
                    "content": f"听写文本: {transcription}\n考官报告: {initial_assessment}",
                },
            ],
            temperature=0.5,
        )

        # Agent C: The Game Master (Consolidation)
        thoughts.append("Agent: [GM] 正在合成最终 JSON 报告并计算游戏化奖励...")
        gm_raw = llm_client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "你是游戏管理员 (GM)。将分数和报告定稿为 JSON 格式。只返回有效的 JSON，不要任何其他内容。不要用 markdown 代码块包裹。",
                },
                {
                    "role": "user",
                    "content": (
                        f"整合:\n"
                        f"考官: {initial_assessment}\n"
                        f"评论家: {critic_report}\n"
                        f'返回 JSON: {{ "scores": {{ "fluency": float, "lexical": float, "grammar": float, "pronunciation": float }}, "report": str, "xp": int, '
                        f'"errors": [{{ "type": "grammar|lexical|pronunciation|fluency", "original": "学生原始表达", "correction": "正确表达", "explanation": "中文解释(20字内)" }}] }}'
                    ),
                },
            ],
            temperature=0.3,
        )

        try:
            final_json = _parse_llm_json(gm_raw)
        except json.JSONDecodeError:
            # If the LLM didn't return valid JSON, provide defaults
            final_json = {
                "scores": {
                    "fluency": 5.0,
                    "lexical": 5.0,
                    "grammar": 5.0,
                    "pronunciation": 5.0,
                },
                "report": gm_raw,
                "xp": 100,
            }

        return {
            "transcription": transcription,
            "scores": final_json.get("scores", {}),
            "agent_thoughts": thoughts,
            "feedback": f"{final_json.get('report')}\n\n语言升级建议:\n{critic_report}",
            "xpReward": final_json.get("xp", 100),
            "pronunciation_feedback": pronunciation_feedback,
            "detected_errors": final_json.get("errors", []),
        }
