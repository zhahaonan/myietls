import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List

DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


def _get_config() -> Dict[str, str]:
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    model = os.getenv("DASHSCOPE_MODEL", "qwen-plus").strip()
    return {"base_url": DASHSCOPE_BASE_URL, "api_key": api_key, "model": model}


def chat(messages: List[Dict[str, Any]], temperature: float = 0.7) -> str:
    config = _get_config()
    if not config["api_key"]:
        raise RuntimeError("Missing DASHSCOPE_API_KEY environment variable.")

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
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"DashScope API request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DashScope API connection failed: {exc.reason}") from exc

    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("DashScope API returned empty content.")
    return content
