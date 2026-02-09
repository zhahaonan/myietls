import gradio as gr
import os
import tempfile
from pathlib import Path
from engine.camel_agents import CamelIELTSAgent
from engine.rag import AgenticRAG
from engine import openai_client
from engine.p1_service import ALLOWED_BANDS, generate_p1_answer
from engine.tts import synthesize_speech
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


# Load environment variables
from dotenv import load_dotenv
# 只加载当前目录下的.env文件，避免在云端环境中出现路径问题
load_dotenv()

# 初始化FastAPI应用以添加CORS支持
fastapi_app = FastAPI()

# 添加CORS中间件以支持前端访问
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该指定具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 如果存在前端静态文件，提供静态文件服务
static_dir = Path(__file__).parent / "dist"
if static_dir.exists():
    fastapi_app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    
    @fastapi_app.get("/")
    async def serve_frontend():
        return FileResponse(str(static_dir / "index.html"))
    
    @fastapi_app.get("/app")
    async def serve_app():
        return FileResponse(str(static_dir / "index.html"))
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


def process_ielts_evaluation(audio_file, question, level, part="P1"):
    """处理IELTS评估"""
    if not audio_file:
        return "请上传音频文件。", "", {}, "", 0
    
    if not question:
        return "请输入问题。", "", {}, "", 0
    
    if not level:
        return "请选择目标分数。", "", {}, "", 0
    
    if camel_engine is None:
        return "AI引擎未初始化，请检查API密钥配置。", "", {}, "", 0
    
    try:
        # 读取音频文件
        with open(audio_file, 'rb') as f:
            audio_bytes = f.read()
        
        # 执行评估
        result = camel_engine.run_roleplay_evaluation(
            audio_bytes=audio_bytes,
            question=question,
            target_level=level,
            part=part
        )
        
        # 构造返回结果
        transcription = result.get("transcription", "")
        scores = result.get("scores", {})
        feedback = result.get("feedback", "")
        xp_reward = result.get("xpReward", 0)
        agent_thoughts = "\n".join(result.get("agent_thoughts", []))
        
        return feedback, transcription, scores, agent_thoughts, xp_reward
        
    except Exception as e:
        return f"处理出错: {str(e)}", "", {}, "", 0


def generate_p1_response(question, band, profile=None):
    """生成Part 1回答"""
    if not question:
        return "请输入问题。"
    
    if not band:
        return "请选择目标分数。"
    
    if band not in ALLOWED_BANDS:
        return f"无效的目标分数。允许的分数: {sorted(ALLOWED_BANDS)}"
    
    try:
        content = generate_p1_answer(question=question, band=band, profile=profile or {})
        return content
    except Exception as e:
        return f"生成回答出错: {str(e)}"


def text_to_speech(text, voice=None, audio_format="wav"):
    """文字转语音"""
    if not text:
        return None, "请输入要转换的文字。"
    
    if not DASHSCOPE_API_KEY:
        return None, "缺少DASHSCOPE_API_KEY环境变量。"
    
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
        
        return temp_filename, "语音合成成功。"
    except Exception as e:
        return None, f"语音合成出错: {str(e)}"


def get_question_bank():
    """获取题库"""
    if rag_module is None:
        return "RAG模块未初始化，请检查配置。"
    try:
        questions = rag_module.get_question_context("all")
        return str(questions)
    except Exception as e:
        return f"获取题库出错: {str(e)}"


# Gradio界面定义
with gr.Blocks(title="MyIELTS Voice Practice Platform") as demo:
    gr.Markdown("# MyIELTS Voice Practice Platform")
    gr.Markdown("提升您的雅思口语技能，获得专业的反馈和评分。")
    
    with gr.Tab("IELTS口语评估"):
        with gr.Row():
            with gr.Column():
                gr.Markdown("### 上传音频并获得评估")
                audio_input = gr.Audio(type="filepath", label="上传您的回答音频")
                question_input = gr.Textbox(label="问题", placeholder="请输入雅思口语问题")
                level_input = gr.Dropdown(
                    choices=["4.0-4.5", "5.0-5.5", "6.0-6.5", "7.0-7.5", "8.0-8.5"], 
                    label="目标分数", 
                    value="6.0-6.5"
                )
                part_input = gr.Dropdown(
                    choices=["P1", "P2", "P3"], 
                    label="考试部分", 
                    value="P1"
                )
                eval_btn = gr.Button("评估", variant="primary")
                
            with gr.Column():
                gr.Markdown("### 评估结果")
                feedback_output = gr.Textbox(label="反馈", interactive=False)
                transcription_output = gr.Textbox(label="转录文本", interactive=False)
                scores_output = gr.JSON(label="评分详情")
                xp_output = gr.Number(label="经验值")
                thoughts_output = gr.Textbox(label="评估过程", interactive=False)
        
        eval_btn.click(
            fn=process_ielts_evaluation,
            inputs=[audio_input, question_input, level_input, part_input],
            outputs=[feedback_output, transcription_output, scores_output, thoughts_output, xp_output]
        )
    
    with gr.Tab("Part 1 回答生成"):
        with gr.Row():
            with gr.Column():
                gr.Markdown("### 获取参考答案")
                p1_question_input = gr.Textbox(label="问题", placeholder="请输入雅思Part 1话题问题")
                p1_band_input = gr.Dropdown(
                    choices=sorted(list(ALLOWED_BANDS)), 
                    label="目标分数", 
                    value="6.0-6.5"
                )
                p1_gen_btn = gr.Button("生成答案", variant="primary")
                
            with gr.Column():
                gr.Markdown("### 参考答案")
                p1_answer_output = gr.Textbox(label="参考答案", interactive=False)
        
        p1_gen_btn.click(
            fn=generate_p1_response,
            inputs=[p1_question_input, p1_band_input],
            outputs=[p1_answer_output]
        )
    
    with gr.Tab("文字转语音"):
        with gr.Row():
            with gr.Column():
                gr.Markdown("### 文字转语音")
                tts_text_input = gr.Textbox(label="输入文本", lines=5, placeholder="请输入要转换为语音的文本")
                tts_voice_input = gr.Textbox(label="声音类型", placeholder="可选的声音类型")
                tts_format_input = gr.Dropdown(
                    choices=["wav", "mp3"], 
                    label="音频格式", 
                    value="wav"
                )
                tts_btn = gr.Button("生成语音", variant="primary")
                
            with gr.Column():
                gr.Markdown("### 语音输出")
                tts_audio_output = gr.Audio(label="语音输出")
                tts_status_output = gr.Textbox(label="状态信息", interactive=False)
        
        tts_btn.click(
            fn=text_to_speech,
            inputs=[tts_text_input, tts_voice_input, tts_format_input],
            outputs=[tts_audio_output, tts_status_output]
        )
    
    with gr.Tab("题库查询"):
        gr.Markdown("### 雅思口语题库")
        bank_btn = gr.Button("获取题库", variant="primary")
        bank_output = gr.Textbox(label="题库内容", lines=10, interactive=False)
        
        bank_btn.click(
            fn=get_question_bank,
            inputs=[],
            outputs=[bank_output]
        )


def modelscope_quickstart():
    """魔搭创空间快速启动函数"""
    return demo


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)