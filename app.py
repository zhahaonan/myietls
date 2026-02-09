import os
import json
import re
import time
import tempfile
import uvicorn
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel


# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# 初始化FastAPI应用
fastapi_app = FastAPI(title="MyIELTS Voice API")

# 添加CORS中间件
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API密钥配置
API_KEY = os.getenv("API_KEY") or os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")


# 延迟初始化AI引擎，避免在缺少依赖或API密钥时崩溃
camel_engine = None
rag_module = None
ALLOWED_BANDS = {"5.5", "6", "6.5", "7", "7.5", "8"}

try:
    from engine.camel_agents import CamelIELTSAgent
    camel_engine = CamelIELTSAgent(api_key=API_KEY)
except Exception as e:
    print(f"警告: Camel代理初始化失败: {e}")

try:
    from engine.rag import AgenticRAG
    rag_module = AgenticRAG()
except Exception as e:
    print(f"警告: RAG模块初始化失败: {e}")

try:
    from engine.p1_service import ALLOWED_BANDS, generate_p1_answer
except Exception as e:
    print(f"警告: P1服务导入失败: {e}")
    def generate_p1_answer(**kwargs):
        return "服务暂不可用"

try:
    from engine.tts import synthesize_speech
except Exception as e:
    print(f"警告: TTS服务导入失败: {e}")
    def synthesize_speech(**kwargs):
        raise RuntimeError("TTS服务不可用")

try:
    from engine import openai_client
except Exception as e:
    print(f"警告: openai_client导入失败: {e}")
    openai_client = None


# 请求模型定义
class EvaluationRequest(BaseModel):
    question: str
    level: str
    part: str = "P1"


class P1ResponseRequest(BaseModel):
    question: str
    band: str
    profile: Dict[str, Any] = {}


class TTSRequest(BaseModel):
    text: str
    voice: str = None
    audio_format: str = "wav"


# API路由定义
@fastapi_app.post("/api/process_evaluation")
async def api_process_evaluation(
    question: str = Form(...),
    level: str = Form(...),
    part: str = Form("P1"),
    audio_file: UploadFile = File(...)
):
    """处理IELTS口语评估API接口，接收上传的音频文件"""
    if not audio_file:
        return {"error": "请上传音频文件。"}
    
    if not question:
        return {"error": "请输入问题。"}
    
    if not level:
        return {"error": "请选择目标分数。"}
    
    if camel_engine is None:
        return {"error": "AI引擎未初始化，请检查API密钥配置。"}

    try:
        # 保存上传的音频文件到临时位置
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(await audio_file.read())
            temp_filename = temp_file.name

        # 读取音频文件
        with open(temp_filename, 'rb') as f:
            audio_bytes = f.read()

        # 执行评估
        result = camel_engine.run_roleplay_evaluation(
            audio_bytes=audio_bytes,
            question=question,
            target_level=level,
            part=part
        )

        # 删除临时文件
        os.unlink(temp_filename)

        return result

    except Exception as e:
        return {"error": f"处理出错: {str(e)}"}


@fastapi_app.post("/api/generate_p1_response")
async def api_generate_p1_response(request: P1ResponseRequest):
    """生成Part 1回答API接口"""
    question = request.question
    band = request.band
    profile = request.profile

    if not question:
        return {"error": "请输入问题。"}

    if not band:
        return {"error": "请选择目标分数。"}

    if band not in ALLOWED_BANDS:
        return {"error": f"无效的目标分数。允许的分数: {sorted(ALLOWED_BANDS)}"}

    try:
        content = generate_p1_answer(question=question, band=band, profile=profile)
        return {"content": content}
    except Exception as e:
        return {"error": f"生成回答出错: {str(e)}"}


@fastapi_app.post("/api/text_to_speech")
async def api_text_to_speech(request: TTSRequest):
    """文字转语音API接口"""
    text = request.text
    voice = request.voice
    audio_format = request.audio_format

    if not text:
        return {"error": "请输入要转换的文字。"}

    if not DASHSCOPE_API_KEY:
        return {"error": "缺少DASHSCOPE_API_KEY环境变量。"}

    try:
        audio_bytes, content_type = synthesize_speech(
            text=text,
            voice=voice,
            audio_format=audio_format
        )

        # 创建临时文件保存音频
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{audio_format}") as temp_file:
            temp_file.write(audio_bytes)
            temp_filename = temp_file.name

        return {"audio_file": temp_filename, "message": "语音合成成功。"}
    except Exception as e:
        return {"error": f"语音合成出错: {str(e)}"}


@fastapi_app.get("/api/question_bank")
async def api_get_question_bank():
    """获取题库API接口"""
    if rag_module is None:
        return {"error": "RAG模块未初始化，请检查配置。"}

    try:
        questions = rag_module.get_question_context("all")
        return {"questions": questions}
    except Exception as e:
        return {"error": f"获取题库出错: {str(e)}"}


@fastapi_app.get("/api/health")
async def health_check():
    """API健康检查"""
    return {
        "status": "healthy", 
        "camel_engine": camel_engine is not None, 
        "rag_module": rag_module is not None,
        "api_keys_configured": bool(API_KEY and DASHSCOPE_API_KEY)
    }


class PolishRequest(BaseModel):
    draft: str
    context: str = ""
    studentLevel: str = "6.0-6.5"
    targetBand: float = 6.5
    part: str = "P1"
    isDirectExample: bool = False


class TranslateWordRequest(BaseModel):
    word: str


@fastapi_app.post("/api/polish")
async def polish_draft(req: PolishRequest):
    """Polish a draft answer using the LLM, return English + Chinese + imagePrompt."""
    if openai_client is None:
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


@fastapi_app.post("/api/translate_word")
async def translate_word(req: TranslateWordRequest):
    """Translate an English word/phrase to Chinese with an emoji."""
    if openai_client is None:
        return {"translation": req.word, "emoji": "📝"}

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


# ============================================================
# /v1 系列端点 - 前端 apiService.ts 和 TTSProvider.ts 所需
# ============================================================

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


@fastapi_app.post("/v1/ielts/evaluate")
async def ielts_evaluate(
    audio: Optional[UploadFile] = File(None),
    part: str = Form("P1"),
    question: str = Form(""),
    level: str = Form("6.0-6.5")
):
    """IELTS评估端点，与前端apiService.ts的callIELTSAgent对接。"""
    if not audio:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    if camel_engine is None:
        raise HTTPException(status_code=503, detail="AI引擎未初始化，请检查API密钥配置。")

    try:
        audio_bytes = await audio.read()
        result = await camel_engine.run_roleplay_evaluation(
            audio_bytes=audio_bytes,
            question=question,
            target_level=level,
            part=part
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
                        "xp_reward": result["xpReward"]
                    }
                },
                "finish_reason": "stop"
            }]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fastapi_app.post("/v1/chat/completions")
async def chat_completions(payload: ChatCompletionRequest):
    """OpenAI风格的chat端点，与前端generateP1Answer对接。"""
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
        if openai_client is None:
            content = f"LLM unavailable\nFallback: {last_user_message or 'Sorry.'}"
        else:
            try:
                content = openai_client.chat(
                    messages=[{"role": m.role, "content": m.content} for m in payload.messages]
                )
            except RuntimeError:
                content = f"LLM unavailable\nFallback: {last_user_message or 'Sorry.'}"

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": os.getenv("OPENAI_MODEL", payload.model),
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop"
        }]
    }


@fastapi_app.post("/v1/audio/speech")
async def audio_speech(payload: SpeechRequest):
    """TTS端点，与前端TTSProvider.ts对接。"""
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


# 配置前端静态文件服务
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
        return {
            "message": "MyIELTS Voice API 服务运行中",
            "endpoints": [
                "/api/health",
                "/api/process_evaluation",
                "/api/generate_p1_response", 
                "/api/text_to_speech",
                "/api/question_bank"
            ],
            "frontend": "React前端未找到，需要先构建前端项目"
        }


if __name__ == "__main__":
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=7860,
        log_level="info"
    )
