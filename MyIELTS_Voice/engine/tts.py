import json
import os
import urllib.error
import urllib.request
from typing import Optional, Tuple

DASHSCOPE_TTS_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio"
DEFAULT_TTS_MODEL = "qwen3-tts-instruct-flash-realtime-2026-01-22"
DEFAULT_TTS_VOICE = "cherry"


def synthesize_speech(
    text: str,
    voice: Optional[str] = None,
    audio_format: str = "wav",
    model: Optional[str] = None,
) -> Tuple[bytes, str]:
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing DASHSCOPE_API_KEY environment variable.")

    normalized_format = (audio_format or "wav").lower()
    if normalized_format not in {"wav", "mp3"}:
        raise RuntimeError("Unsupported format. Use 'wav' or 'mp3'.")

    payload = {
        "model": model or os.getenv("DASHSCOPE_TTS_MODEL", DEFAULT_TTS_MODEL),
        "input": {"text": text},
        "parameters": {
            "voice": voice or os.getenv("DASHSCOPE_TTS_VOICE", DEFAULT_TTS_VOICE),
            "format": normalized_format,
            "sample_rate": 24000,
            "volume": 50,
            "rate": 1.0,
            "pitch": 1.0,
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=DASHSCOPE_TTS_ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "X-DashScope-Data-Inspection": "enable",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            audio_bytes = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"DashScope TTS request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DashScope TTS connection failed: {exc.reason}") from exc

    content_type = "audio/wav" if normalized_format == "wav" else "audio/mpeg"
    return audio_bytes, content_type
