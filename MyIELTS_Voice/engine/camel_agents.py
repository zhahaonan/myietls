import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any
from . import openai_client
from .rag import AgenticRAG


def _transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio using DashScope-compatible Whisper API, fallback to OPENAI_BASE_URL."""
    dashscope_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if dashscope_key:
        base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        api_key = dashscope_key
        model = "sensevoice-v1"
    else:
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        model = "whisper-1"

    if not api_key:
        return "(语音转写不可用: 缺少 API 密钥)"

    # Build multipart form data
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
    body += b"Content-Type: audio/wav\r\n\r\n"
    body += audio_bytes
    body += f"\r\n--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="model"\r\n\r\n'
    body += f"{model}\r\n".encode()
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        url=f"{base_url}/audio/transcriptions",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("text", "(转写结果为空)")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:200]
        return f"(语音转写失败: HTTP {exc.code} - {detail})"
    except Exception as e:
        return f"(语音转写失败: {str(e)[:100]})"


class CamelIELTSAgent:
    """
    Orchestrates a CAMEL-style Role-Playing interaction between AI Agents.
    Uses openai_client for LLM calls and DashScope SenseVoice for STT.
    """

    def __init__(self, api_key: str = None):
        self.rag = AgenticRAG()

    async def run_roleplay_evaluation(
        self, audio_bytes: bytes, question: str, target_level: str, part: str
    ):
        thoughts = []

        # PHASE 0: Signal Processing (STT)
        thoughts.append("Agent: [AudioNode] 正在通过 SenseVoice 解码考生回答...")
        transcription = _transcribe_audio(audio_bytes)
        thoughts.append(
            f"Agent: [AudioNode] 信号已锁定。内容: '{transcription[:60]}...'"
        )

        # PHASE 1: Knowledge Retrieval (RAG)
        thoughts.append(
            f"Agent: [Critic] 正在获取目标分数 {target_level} 的 RAG 评分标准..."
        )
        rag_data = self.rag.retrieve_ielts_knowledge(transcription, target_level)

        # PHASE 2: Role-Playing Loop (CAMEL Style)
        # Agent A: The Examiner
        thoughts.append("Agent: [Examiner] 正在根据官方评分标准评估回答...")
        initial_assessment = openai_client.chat(
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
        critic_report = openai_client.chat(
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
        gm_raw = openai_client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "你是游戏管理员 (GM)。将分数和报告定稿为 JSON 格式。只返回有效的 JSON，不要任何其他内容。",
                },
                {
                    "role": "user",
                    "content": (
                        f"整合:\n"
                        f"考官: {initial_assessment}\n"
                        f"评论家: {critic_report}\n"
                        f'返回 JSON: {{ "scores": {{ "fluency": float, "lexical": float, "grammar": float, "pronunciation": float }}, "report": str, "xp": int }}'
                    ),
                },
            ],
            temperature=0.3,
        )

        try:
            final_json = json.loads(gm_raw)
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
        }
