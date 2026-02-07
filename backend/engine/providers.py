
import os
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List

class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, file_path: str) -> str:
        pass

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_instruction: str = "") -> str:
        pass

    @abstractmethod
    async def extract_json(self, prompt: str, schema: Dict) -> Dict:
        pass

# --- 增强实现 ---

class GroqLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3.1-70b-versatile"):
        self.api_key = api_key
        self.model = model

    async def generate(self, prompt: str, system_instruction: str = "") -> str:
        # 实际生产环境这里封装 Groq SDK
        # 针对稳定性，增加 Chain-of-Thought 引导
        return f"CoT: Analyzing... Result for {prompt[:20]}"

    async def extract_json(self, prompt: str, schema: Dict) -> Dict:
        # 模拟模型输出稳定的 JSON 结构
        # 幻觉控制：在这里可以加入对 schema 的硬校验
        return {
            "fluency": 7.5,
            "lexical": 8.0,
            "grammar": 7.0,
            "logic_coherence": 8.5
        }

class AIProviderFactory:
    @staticmethod
    def get_stt_provider() -> STTProvider:
        return GroqSTTProvider(api_key=os.getenv("GROQ_API_KEY", ""))

    @staticmethod
    def get_llm_provider() -> LLMProvider:
        return GroqLLMProvider(api_key=os.getenv("GROQ_API_KEY", ""))

class GroqSTTProvider(STTProvider):
    def __init__(self, api_key: str): self.api_key = api_key
    async def transcribe(self, file_path: str) -> str:
        return "The impact of technology on privacy is profound as data collection becomes ubiquitous."
