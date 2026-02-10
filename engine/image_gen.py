import asyncio
import json
import os
import urllib.error
import urllib.request

DASHSCOPE_IMAGE_URL = (
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
)
DASHSCOPE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks"
DEFAULT_IMAGE_MODEL = "wanx2.1-t2i-turbo"


async def generate_image(prompt: str) -> str:
    """Generate an image from a text prompt using DashScope Wanx.

    Returns the image URL on success, or empty string on failure.
    """
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        print("[WARN] image_gen: DASHSCOPE_API_KEY is missing")
        return ""

    if not prompt or not prompt.strip():
        print("[WARN] image_gen: empty prompt")
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
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:300]
        print(f"[ERROR] image_gen submit HTTP {exc.code}: {detail}")
        return ""
    except Exception as e:
        print(f"[ERROR] image_gen submit failed: {e}")
        return ""

    task_id = submit_data.get("output", {}).get("task_id", "")
    if not task_id:
        print(f"[ERROR] image_gen: no task_id in response: {str(submit_data)[:200]}")
        return ""

    print(f"[INFO] image_gen: task submitted, task_id={task_id}")

    # Step 2: Poll for task completion (non-blocking)
    task_url = f"{DASHSCOPE_TASK_URL}/{task_id}"
    for attempt in range(30):  # max 60 seconds (poll every 2s)
        await asyncio.sleep(2)
        try:
            poll_req = urllib.request.Request(
                url=task_url,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            with urllib.request.urlopen(poll_req, timeout=10) as resp:
                poll_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[WARN] image_gen poll attempt {attempt} failed: {e}")
            continue

        status = poll_data.get("output", {}).get("task_status", "")
        if status == "SUCCEEDED":
            results = poll_data.get("output", {}).get("results", [])
            if results:
                url = results[0].get("url", "")
                print(f"[INFO] image_gen: success, url={url[:80]}...")
                return url
            print("[WARN] image_gen: SUCCEEDED but no results")
            return ""
        elif status == "FAILED":
            msg = poll_data.get("output", {}).get("message", "unknown")
            print(f"[ERROR] image_gen: task FAILED: {msg}")
            return ""

    print("[ERROR] image_gen: task timed out after 60s")
    return ""
