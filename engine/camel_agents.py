import os
import json
import base64
from typing import List, Dict, Any
import google.generativeai as genai
from .rag import AgenticRAG

class CamelIELTSAgent:
    """
    Orchestrates a CAMEL-style Role-Playing interaction between AI Agents.
    Personas:
    1. Examiner (Expert Assessment)
    2. Critic (Linguistic Reviewer)
    3. Game Master ( Gamification & Rewards)
    """
    def __init__(self, api_key: str = None):
        # If no API key is provided, try to get it from environment variables
        if not api_key:
            api_key = os.getenv("API_KEY") or os.getenv("GEMINI_API_KEY")
        
        if api_key:
            genai.configure(api_key=api_key)
        else:
            print("Warning: No API key provided for Gemini. Please set API_KEY or GEMINI_API_KEY environment variable.")
        
        self.primary_model = 'gemini-3-pro-preview'
        self.rag = AgenticRAG()

    async def run_roleplay_evaluation(self, audio_bytes: bytes, question: str, target_level: str, part: str):
        thoughts = []
        
        # PHASE 0: Signal Processing (Native Audio STT)
        thoughts.append("Agent: [AudioNode] 正在通过 Gemini Native Audio 解码考生回答...")
        stt_model = genai.GenerativeModel('gemini-2.5-flash-native-audio-preview-12-2025')
        stt_resp = stt_model.generate_content([
            {"mime_type": "audio/wav", "data": audio_bytes},
            f"请提供雅思问题 '{question}' 的逐字听写文本。"
        ])
        transcription = stt_resp.text or "转写失败。"
        thoughts.append(f"Agent: [AudioNode] 信号已锁定。内容: '{transcription[:60]}...'")

        # PHASE 1: Knowledge Retrieval (RAG)
        thoughts.append(f"Agent: [Critic] 正在获取目标分数 {target_level} 的 RAG 评分标准...")
        rag_data = self.rag.retrieve_ielts_knowledge(transcription, target_level)

        # PHASE 2: Role-Playing Loop (CAMEL Style)
        # Agent A: The Examiner
        thoughts.append("Agent: [Examiner] 正在根据官方评分标准评估回答...")
        examiner_system = "你是一名资深雅思考官。根据流利度 (Fluency)、词汇 (Lexical) 和语法 (Grammar) 评估学生。保持专业。"
        ex_model = genai.GenerativeModel(self.primary_model, system_instruction=examiner_system)
        ex_resp = ex_model.generate_content(f"听写文本: {transcription}\n上下文: {rag_data}")
        initial_assessment = ex_resp.text
        
        # Agent B: The Critic (Peer Review)
        thoughts.append("Agent: [Critic] 正在复审考官评估并提出升级建议...")
        critic_system = "你是一名语言评论家。审查考官的报告。提出 3 个高级搭配来替换学生回答中的基础词汇。"
        cr_model = genai.GenerativeModel(self.primary_model, system_instruction=critic_system)
        cr_resp = cr_model.generate_content(f"听写文本: {transcription}\n考官报告: {initial_assessment}")
        critic_report = cr_resp.text
        
        # Agent C: The Game Master (Consolidation)
        thoughts.append("Agent: [GM] 正在合成最终 JSON 报告并计算游戏化奖励...")
        gm_system = "你是游戏管理员 (GM)。将分数和报告定稿为 JSON 格式。"
        gm_model = genai.GenerativeModel(
            self.primary_model, 
            system_instruction=gm_system,
            generation_config={"response_mime_type": "application/json"}
        )
        
        gm_prompt = (
            f"整合: \n"
            f"考官: {initial_assessment}\n"
            f"评论家: {critic_report}\n"
            f"返回 JSON: {{ 'scores': {{ 'fluency': float, 'lexical': float, 'grammar': float, 'pronunciation': float }}, 'report': str, 'xp': int }}"
        )
        
        gm_resp = gm_model.generate_content(gm_prompt)
        final_json = json.loads(gm_resp.text)
        
        return {
            "transcription": transcription,
            "scores": final_json.get("scores", {}),
            "agent_thoughts": thoughts,
            "feedback": f"{final_json.get('report')}\n\n语言升级建议:\n{critic_report}",
            "xpReward": final_json.get("xp", 100)
        }