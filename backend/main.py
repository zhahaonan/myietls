from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
import os
import time
import json
import re
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
# 1. Try .env.local in the root directory (for unified config)
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env.local")
# 2. Try .env in the current directory (standard behavior)
load_dotenv()

from engine.camel_agents import CamelIELTSAgent
from engine.rag import AgenticRAG
from engine import openai_client
from engine.p1_service import ALLOWED_BANDS, generate_p1_answer
from engine.tts import synthesize_speech

app = FastAPI(title="MyIELTS Multi-Agent OpenAI-Style API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared AI key from environment
API_KEY = os.getenv("API_KEY")
camel_engine = CamelIELTSAgent(api_key=API_KEY)
rag_module = AgenticRAG()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "myielts-multi-agent"
    messages: List[ChatMessage]
    metadata: Optional[Dict[str, Any]] = None


class SpeechRequest(BaseModel):
    input: str
    voice: Optional[str] = None
    format: Literal["wav", "mp3"] = "wav"
    model: Optional[str] = None


def _get_last_user_message(messages: List[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content
    return ""


def _extract_error_code(error: Exception) -> str:
    message = str(error)

    if "Missing OPENAI_API_KEY" in message:
        return "missing_api_key"
    if "Missing OPENAI_MODEL" in message:
        return "missing_model"
    if "OpenAI API connection failed" in message:
        return "connection_error"

    m = re.search(r"OpenAI API request failed \((\d{3})\):\s*(.*)", message, re.DOTALL)
    if m:
        status = m.group(1)
        detail = m.group(2).strip()
        try:
            parsed = json.loads(detail)
            code = parsed.get("error", {}).get("code")
            if isinstance(code, str) and code.strip():
                return code
        except Exception:
            pass

        return f"http_{status}"

    return "unknown_error"

@app.post("/v1/ielts/evaluate")
async def ielts_evaluate(
    audio: Optional[UploadFile] = File(None),
    part: str = Form("P1"),
    question: str = Form(""),
    level: str = Form("6.0-6.5")
):
    """
    Multipart endpoint for IELTS evaluation.
    Handles multipart form data for audio processing via Camel Multi-Agent logic.
    """
    try:
        if not audio:
            raise HTTPException(status_code=400, detail="No audio file provided.")
            
        audio_bytes = await audio.read()
        
        # Execute the Camel Role-Playing Multi-Agent Workflow
        result = await camel_engine.run_roleplay_evaluation(
            audio_bytes=audio_bytes,
            question=question,
            target_level=level,
            part=part
        )
        
        # Structure response in OpenAI format
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "myielts-multi-agent",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": result["feedback"],
                        # Proprietary metadata for the specialized IELTS frontend
                        "metadata": {
                            "transcription": result["transcription"],
                            "scores": result["scores"],
                            "agent_thoughts": result["agent_thoughts"],
                            "xp_reward": result["xpReward"]
                        }
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": len(question.split()) + 50,
                "completion_tokens": len(result["feedback"].split()),
                "total_tokens": len(question.split()) + len(result["feedback"].split()) + 50
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/v1/chat/completions")
async def chat_completions(payload: ChatCompletionRequest):
    """
    Standard OpenAI-style JSON chat endpoint backed by an OpenAI-compatible model.
    """
    last_user_message = _get_last_user_message(payload.messages)
    metadata = payload.metadata or {}

    if metadata.get("task") == "p1_answer":
        band = str(metadata.get("band", "")).strip()
        if band not in ALLOWED_BANDS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid band '{band}'. Allowed bands: {sorted(ALLOWED_BANDS)}",
            )

        question = str(metadata.get("question") or last_user_message).strip()
        if not question:
            raise HTTPException(status_code=400, detail="Missing metadata.question for p1_answer.")

        profile = metadata.get("profile")
        if not isinstance(profile, dict):
            profile = {}

        content = generate_p1_answer(question=question, band=band, profile=profile)
    else:
        try:
            content = openai_client.chat(
                messages=[{"role": m.role, "content": m.content} for m in payload.messages]
            )
        except RuntimeError as exc:
            error_code = _extract_error_code(exc)
            fallback = last_user_message or "Sorry, I cannot answer that right now."
            content = f"LLM unavailable: {error_code}\nFallback: {fallback}"

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": os.getenv("OPENAI_MODEL", payload.model),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "finish_reason": "stop"
            }
        ]
    }


@app.post("/v1/audio/speech")
async def audio_speech(payload: SpeechRequest):
    text = payload.input.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Field 'input' cannot be empty.")

    try:
        audio_bytes, content_type = synthesize_speech(
            text=text,
            voice=payload.voice,
            audio_format=payload.format,
            model=payload.model,
        )
    except RuntimeError as exc:
        message = str(exc)
        status_code = 502
        if "Missing DASHSCOPE_API_KEY" in message:
            status_code = 500
        if "Unsupported format" in message:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=message) from exc

    return Response(content=audio_bytes, media_type=content_type)

@app.get("/api/question-bank")
async def get_bank():
    """Retrieve pre-loaded IELTS question bank."""
    return rag_module.get_question_context("all")


class PolishRequest(BaseModel):
    draft: str
    context: str = ""
    studentLevel: str = "6.0-6.5"
    targetBand: float = 6.5
    part: str = "P1"
    isDirectExample: bool = False


class TranslateWordRequest(BaseModel):
    word: str


@app.post("/api/polish")
async def polish_draft(req: PolishRequest):
    """Polish a draft answer using the LLM, return English + Chinese + imagePrompt."""
    prompt = f"""Student Level: {req.studentLevel}, Target Band: {req.targetBand}.
Type: Part {req.part}.
{req.context}
Draft: "{req.draft}".

Task:
1. {"Keep this text exactly as provided (do not refine it)." if req.isDirectExample else "Refine the draft into a Band 8.5 response."}
2. Translate the English text to Chinese.
3. Create a short image description for the scene.
4. Return JSON with keys: en, cn, imagePrompt"""

    try:
        raw = openai_client.chat(
            messages=[
                {"role": "system", "content": "You are an IELTS speaking coach. Always respond with valid JSON containing keys: en, cn, imagePrompt."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )
        result = json.loads(raw)
        return {"en": result.get("en", req.draft), "cn": result.get("cn", ""), "imagePrompt": result.get("imagePrompt", "")}
    except (json.JSONDecodeError, RuntimeError):
        return {"en": req.draft, "cn": "(翻译暂不可用)", "imagePrompt": ""}


@app.post("/api/translate_word")
async def translate_word(req: TranslateWordRequest):
    """Translate an English word/phrase to Chinese with an emoji."""
    prompt = f'Translate the English word/phrase "{req.word}" to Chinese contextually as used in IELTS. Also provide 1 relevant emoji. Return JSON {{ "translation": "...", "emoji": "..." }}'

    try:
        raw = openai_client.chat(
            messages=[
                {"role": "system", "content": "Always respond with valid JSON containing keys: translation, emoji."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        result = json.loads(raw)
        return {"translation": result.get("translation", ""), "emoji": result.get("emoji", "")}
    except (json.JSONDecodeError, RuntimeError):
        return {"translation": req.word, "emoji": "📝"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
