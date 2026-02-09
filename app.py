import os
import json
import time
import uvicorn
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

# -----------------------------------------------------------
# FastAPI App
# -----------------------------------------------------------
fastapi_app = FastAPI(title="MyIELTS Voice API")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()

# -----------------------------------------------------------
# Lazy-init AI engines
# -----------------------------------------------------------
camel_engine = None
rag_module = None
ALLOWED_BANDS = {"5.5", "6", "6.5", "7", "7.5", "8"}

try:
    from engine.camel_agents import CamelIELTSAgent
    camel_engine = CamelIELTSAgent()
except Exception as e:
    print(f"[WARN] CamelIELTSAgent init failed: {e}")

try:
    from engine.rag import AgenticRAG
    rag_module = AgenticRAG()
except Exception as e:
    print(f"[WARN] RAG init failed: {e}")

try:
    from engine.p1_service import ALLOWED_BANDS, generate_p1_answer
except Exception as e:
    print(f"[WARN] p1_service import failed: {e}")
    def generate_p1_answer(**kwargs):
        return "服务暂不可用"

try:
    from engine.tts import synthesize_speech
except Exception as e:
    print(f"[WARN] TTS import failed: {e}")
    def synthesize_speech(**kwargs):
        raise RuntimeError("TTS 服务不可用")

try:
    from engine import llm_client
except Exception as e:
    print(f"[WARN] llm_client import failed: {e}")
    llm_client = None


# -----------------------------------------------------------
# Request Models
# -----------------------------------------------------------
class PolishRequest(BaseModel):
    draft: str
    context: str = ""
    studentLevel: str = "6.0-6.5"
    targetBand: float = 6.5
    part: str = "P1"
    isDirectExample: bool = False

class TranslateWordRequest(BaseModel):
    word: str

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

class ImageRequest(BaseModel):
    prompt: str


# -----------------------------------------------------------
# /api/* endpoints (used by PracticeBank.tsx)
# -----------------------------------------------------------
@fastapi_app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "camel_engine": camel_engine is not None,
        "rag_module": rag_module is not None,
        "dashscope_configured": bool(DASHSCOPE_API_KEY),
    }


@fastapi_app.post("/api/polish")
async def polish_draft(req: PolishRequest):
    if llm_client is None:
        return {"en": req.draft, "cn": "(翻译暂不可用)", "imagePrompt": ""}

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
        raw = llm_client.chat(
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


@fastapi_app.post("/api/translate_word")
async def translate_word(req: TranslateWordRequest):
    if llm_client is None:
        return {"translation": req.word, "emoji": "📝"}

    prompt = f'Translate the English word/phrase "{req.word}" to Chinese contextually as used in IELTS. Also provide 1 relevant emoji. Return JSON {{ "translation": "...", "emoji": "..." }}'

    try:
        raw = llm_client.chat(
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


@fastapi_app.get("/api/question_bank")
async def api_get_question_bank():
    if rag_module is None:
        return {"error": "RAG 模块未初始化"}
    try:
        questions = rag_module.get_question_context("all")
        return {"questions": questions}
    except Exception as e:
        return {"error": f"获取题库出错: {str(e)}"}


@fastapi_app.post("/api/generate-image")
async def api_generate_image(req: ImageRequest):
    if not req.prompt or not req.prompt.strip():
        return {"url": ""}
    try:
        from engine.image_gen import generate_image
        url = generate_image(req.prompt)
        return {"url": url}
    except Exception as e:
        print(f"[WARN] Image generation failed: {e}")
        return {"url": ""}


# -----------------------------------------------------------
# /v1/* endpoints (used by apiService.ts & TTSProvider.ts)
# -----------------------------------------------------------
@fastapi_app.post("/v1/ielts/evaluate")
async def ielts_evaluate(
    audio: Optional[UploadFile] = File(None),
    part: str = Form("P1"),
    question: str = Form(""),
    level: str = Form("6.0-6.5"),
):
    if not audio:
        raise HTTPException(status_code=400, detail="No audio file provided.")
    if camel_engine is None:
        raise HTTPException(status_code=503, detail="AI 引擎未初始化")

    try:
        audio_bytes = await audio.read()
        result = await camel_engine.run_roleplay_evaluation(
            audio_bytes=audio_bytes,
            question=question,
            target_level=level,
            part=part,
        )
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "myielts-multi-agent",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": result["feedback"],
                    "metadata": {
                        "transcription": result["transcription"],
                        "scores": result["scores"],
                        "agent_thoughts": result["agent_thoughts"],
                        "xp_reward": result["xpReward"],
                    },
                },
                "finish_reason": "stop",
            }],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fastapi_app.post("/v1/chat/completions")
async def chat_completions(payload: ChatCompletionRequest):
    last_user_message = ""
    for message in reversed(payload.messages):
        if message.role == "user":
            last_user_message = message.content
            break

    metadata = payload.metadata or {}

    if metadata.get("task") == "p1_answer":
        band = str(metadata.get("band", "")).strip()
        if band not in ALLOWED_BANDS:
            raise HTTPException(status_code=400, detail=f"Invalid band '{band}'.")
        question = str(metadata.get("question") or last_user_message).strip()
        if not question:
            raise HTTPException(status_code=400, detail="Missing question.")
        profile = metadata.get("profile") or {}
        content = generate_p1_answer(question=question, band=band, profile=profile)
    else:
        if llm_client is None:
            content = f"LLM 不可用\n{last_user_message or ''}"
        else:
            try:
                content = llm_client.chat(
                    messages=[{"role": m.role, "content": m.content} for m in payload.messages]
                )
            except RuntimeError:
                content = f"LLM 调用失败\n{last_user_message or ''}"

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": os.getenv("DASHSCOPE_MODEL", "qwen-plus"),
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
        }],
    }


@fastapi_app.post("/v1/audio/speech")
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
        raise HTTPException(status_code=status_code, detail=message)

    return Response(content=audio_bytes, media_type=content_type)


# -----------------------------------------------------------
# Static frontend (dist/)
# -----------------------------------------------------------
frontend_dist_path = Path(__file__).parent / "dist"
if frontend_dist_path.exists():
    assets_dir = frontend_dist_path / "assets"
    if assets_dir.exists():
        fastapi_app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @fastapi_app.get("/")
    async def serve_frontend():
        return FileResponse(str(frontend_dist_path / "index.html"))

    @fastapi_app.get("/app")
    async def serve_app():
        return FileResponse(str(frontend_dist_path / "index.html"))
else:
    @fastapi_app.get("/")
    async def root():
        return {"message": "MyIELTS Voice API running", "frontend": "dist/ not found"}


if __name__ == "__main__":
    uvicorn.run(fastapi_app, host="0.0.0.0", port=7860, log_level="info")
