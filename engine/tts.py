import json
import os
import urllib.error
import urllib.request
from typing import Optional, Tuple

DASHSCOPE_TTS_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
)
DEFAULT_TTS_MODEL = "qwen-tts"
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
        "model": model or DEFAULT_TTS_MODEL,
        "input": {"text": text},
        "parameters": {
            "voice": voice or DEFAULT_TTS_VOICE,
            "format": normalized_format,
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url=DASHSCOPE_TTS_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"DashScope TTS request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DashScope TTS connection failed: {exc.reason}") from exc

    audio_url = (
        data.get("output", {})
        .get("audio", {})
        .get("url", "")
    )
    if not audio_url:
        raise RuntimeError("DashScope TTS returned no audio URL.")

    # Download the audio file from the returned URL
    try:
        audio_req = urllib.request.Request(url=audio_url)
        with urllib.request.urlopen(audio_req, timeout=30) as audio_resp:
            audio_bytes = audio_resp.read()
    except Exception as exc:
        raise RuntimeError(f"Failed to download TTS audio: {exc}") from exc

    if not audio_bytes:
        raise RuntimeError("Downloaded TTS audio is empty.")

    content_type = "audio/wav" if normalized_format == "wav" else "audio/mpeg"
    return audio_bytes, content_type
