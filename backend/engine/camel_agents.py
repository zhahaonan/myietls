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
    def __init__(self, api_key: str):
        if api_key:
            genai.configure(api_key=api_key)
        self.primary_model = 'gemini-3-pro-preview'
        self.rag = AgenticRAG()

    async def run_roleplay_evaluation(self, audio_bytes: bytes, question: str, target_level: str, part: str):
        thoughts = []
        
        # PHASE 0: Signal Processing (Native Audio STT)
        thoughts.append("Agent: [AudioNode] Decoding candidate response via Gemini Native Audio...")
        stt_model = genai.GenerativeModel('gemini-2.5-flash-native-audio-preview-12-2025')
        stt_resp = stt_model.generate_content([
            {"mime_type": "audio/wav", "data": audio_bytes},
            f"Provide a verbatim transcription for the IELTS question: '{question}'."
        ])
        transcription = stt_resp.text or "Transcription failed."
        thoughts.append(f"Agent: [AudioNode] Signal locked. Content: '{transcription[:60]}...'")

        # PHASE 1: Knowledge Retrieval (RAG)
        thoughts.append(f"Agent: [Critic] Fetching Agentic RAG descriptors for target band {target_level}...")
        rag_data = self.rag.retrieve_ielts_knowledge(transcription, target_level)

        # PHASE 2: Role-Playing Loop (CAMEL Style)
        # Agent A: The Examiner
        thoughts.append("Agent: [Examiner] Evaluating response against Official Band Descriptors...")
        examiner_system = "You are a Senior IELTS Examiner. Assess the student based on Fluency, Lexical, and Grammar. Be professional."
        ex_model = genai.GenerativeModel(self.primary_model, system_instruction=examiner_system)
        ex_resp = ex_model.generate_content(f"Transcription: {transcription}\nContext: {rag_data}")
        initial_assessment = ex_resp.text
        
        # Agent B: The Critic (Peer Review)
        thoughts.append("Agent: [Critic] Peer-reviewing Examiner assessment for accuracy and proposing upgrades...")
        critic_system = "You are a Linguistic Critic. Review the Examiner's report. Propose 3 advanced collocations to replace basic words in the student's answer."
        cr_model = genai.GenerativeModel(self.primary_model, system_instruction=critic_system)
        cr_resp = cr_model.generate_content(f"Transcription: {transcription}\nExaminer Report: {initial_assessment}")
        critic_report = cr_resp.text
        
        # Agent C: The Game Master (Consolidation)
        thoughts.append("Agent: [GM] Synthesizing final JSON report and calculating gamification multipliers...")
        gm_system = "You are the Game Master. Finalize the scores and report into JSON format."
        gm_model = genai.GenerativeModel(
            self.primary_model, 
            system_instruction=gm_system,
            generation_config={"response_mime_type": "application/json"}
        )
        
        gm_prompt = (
            f"Consolidate: \n"
            f"Examiner: {initial_assessment}\n"
            f"Critic: {critic_report}\n"
            f"Return JSON: {{ 'scores': {{ 'fluency': float, 'lexical': float, 'grammar': float, 'pronunciation': float }}, 'report': str, 'xp': int }}"
        )
        
        gm_resp = gm_model.generate_content(gm_prompt)
        final_json = json.loads(gm_resp.text)
        
        return {
            "transcription": transcription,
            "scores": final_json.get("scores", {}),
            "agent_thoughts": thoughts,
            "feedback": f"{final_json.get('report')}\n\nLinguistic Upgrades:\n{critic_report}",
            "xpReward": final_json.get("xp", 100)
        }