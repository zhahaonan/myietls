import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List


def _get_env_config() -> Dict[str, str]:
    # DashScope (百炼) takes priority
    dashscope_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if dashscope_key:
        base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        model = os.getenv("DASHSCOPE_MODEL", "qwen-plus").strip()
        return {"base_url": base_url, "api_key": dashscope_key, "model": model}

    # Fallback to OpenAI-compatible config
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "").strip()
    return {"base_url": base_url, "api_key": api_key, "model": model}


def chat(messages: List[Dict[str, Any]], temperature: float = 0.7) -> str:
    config = _get_env_config()
    if not config["api_key"]:
        raise RuntimeError("Missing DASHSCOPE_API_KEY or OPENAI_API_KEY environment variable.")
    if not config["model"]:
        raise RuntimeError("Missing DASHSCOPE_MODEL or OPENAI_MODEL environment variable.")

    payload = {
        "model": config["model"],
        "messages": messages,
        "temperature": temperature,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=f"{config['base_url']}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config['api_key']}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"LLM API request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"LLM API connection failed: {exc.reason}") from exc

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("LLM API returned empty assistant content.")
    return content
