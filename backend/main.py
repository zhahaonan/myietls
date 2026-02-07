from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import time
import json
from engine.camel_agents import CamelIELTSAgent
from engine.rag import AgenticRAG

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
    Standard OpenAI-style JSON chat endpoint (minimal STEP1 implementation).
    """
    last_user_message = ""
    for message in reversed(payload.messages):
        if message.role == "user":
            last_user_message = message.content
            break

    content = last_user_message or "No user message provided."

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": payload.model,
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

@app.get("/api/question-bank")
async def get_bank():
    """Retrieve pre-loaded IELTS question bank."""
    return rag_module.get_question_context("all")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
