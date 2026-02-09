import json
import os
import time
import urllib.error
import urllib.request

DASHSCOPE_IMAGE_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
)
DASHSCOPE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks"
DEFAULT_IMAGE_MODEL = "wanx2.1-t2i-turbo"


def generate_image(prompt: str) -> str:
    """Generate an image from a text prompt using DashScope Wanx.

    Returns the image URL on success, or empty string on failure.
    """
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        return ""

    if not prompt or not prompt.strip():
        return ""

    # Step 1: Submit async image generation task
    payload = json.dumps({
        "model": DEFAULT_IMAGE_MODEL,
        "input": {"prompt": prompt.strip()},
        "parameters": {"n": 1, "size": "512*512"},
    }).encode("utf-8")

    req = urllib.request.Request(
        url=DASHSCOPE_IMAGE_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "X-DashScope-Async": "enable",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            submit_data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return ""

    task_id = submit_data.get("output", {}).get("task_id", "")
    if not task_id:
        return ""

    # Step 2: Poll for task completion
    task_url = f"{DASHSCOPE_TASK_URL}/{task_id}"
    for _ in range(30):  # max 60 seconds (poll every 2s)
        time.sleep(2)
        try:
            poll_req = urllib.request.Request(
                url=task_url,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            with urllib.request.urlopen(poll_req, timeout=10) as resp:
                poll_data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue

        status = poll_data.get("output", {}).get("task_status", "")
        if status == "SUCCEEDED":
            results = poll_data.get("output", {}).get("results", [])
            if results:
                return results[0].get("url", "")
            return ""
        elif status == "FAILED":
            return ""

    return ""
