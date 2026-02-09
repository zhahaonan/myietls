import os
import tempfile
from pathlib import Path
from typing import Dict, Any
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from engine.camel_agents import CamelIELTSAgent
from engine.rag import AgenticRAG
from engine import openai_client
from engine.p1_service import ALLOWED_BANDS, generate_p1_answer
from engine.tts import synthesize_speech


# Load environment variables
from dotenv import load_dotenv
load_dotenv()


# 初始化FastAPI应用以添加CORS支持
fastapi_app = FastAPI(title="MyIELTS Voice API")

# 添加CORS中间件以支持前端访问
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该指定具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API密钥配置
API_KEY = os.getenv("API_KEY") or os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")


# 延迟初始化AI引擎，避免在缺少API密钥时立即报错
try:
    camel_engine = CamelIELTSAgent(api_key=API_KEY)
except Exception as e:
    print(f"警告: Camel代理初始化失败: {e}")
    camel_engine = None

try:
    rag_module = AgenticRAG()
except Exception as e:
    print(f"警告: RAG模块初始化失败: {e}")
    rag_module = None


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


# 配置静态文件服务 - 指向项目根目录的dist文件夹
frontend_dist_path = Path(__file__).parent.parent / "dist"
if frontend_dist_path.exists():
    # 挂载前端静态文件
    fastapi_app.mount("/", StaticFiles(directory=str(frontend_dist_path)), name="frontend")
else:
    # 如果没有构建的前端，则提供一个简单的API说明页
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

    # SPA路由处理 - 将所有未匹配的路由指向API
    @fastapi_app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        return {
            "message": "MyIELTS Voice API 服务运行中",
            "endpoint": f"/{full_path}",
            "available_endpoints": [
                "/api/health",
                "/api/process_evaluation",
                "/api/generate_p1_response", 
                "/api/text_to_speech",
                "/api/question_bank"
            ]
        }


def modelscope_quickstart():
    """魔搭创空间快速启动函数"""
    import uvicorn
    
    # 使用uvicorn运行FastAPI应用
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=7860,
        log_level="info"
    )


if __name__ == "__main__":
    import uvicorn
    
    # 在魔搭创空间环境下运行FastAPI应用
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=7860,
        log_level="info"
    )