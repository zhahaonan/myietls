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


class ImageGenError(Exception):
    """Raised when image generation fails with a descriptive reason."""
    pass


async def generate_image(prompt: str) -> str:
    """Generate an image from a text prompt using DashScope Wanx.

    Returns the image URL on success.
    Raises ImageGenError with a human-readable message on failure.
    """
    api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
    if not api_key:
        raise ImageGenError("DASHSCOPE_API_KEY 未配置，无法生成图片")

    if not prompt or not prompt.strip():
        raise ImageGenError("图片生成提示词为空")

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
        detail = exc.read().decode("utf-8", errors="ignore")[:500]
        print(f"[ERROR] image_gen submit HTTP {exc.code}: {detail}")
        # Try to extract DashScope error code/message
        try:
            err_json = json.loads(detail)
            code = err_json.get("code", "")
            message = err_json.get("message", "")
            if code == "Arrearage":
                raise ImageGenError(f"DashScope 账户欠费 (Arrearage)，请充值后重试。详情: {message}")
            elif code:
                raise ImageGenError(f"DashScope API 错误 [{code}]: {message}")
        except (json.JSONDecodeError, ImageGenError) as parse_err:
            if isinstance(parse_err, ImageGenError):
                raise
        raise ImageGenError(f"DashScope 图片生成请求失败 (HTTP {exc.code}): {detail[:200]}")
    except Exception as e:
        print(f"[ERROR] image_gen submit failed: {e}")
        raise ImageGenError(f"图片生成请求异常: {e}")

    task_id = submit_data.get("output", {}).get("task_id", "")
    if not task_id:
        raise ImageGenError(f"DashScope 未返回 task_id: {str(submit_data)[:200]}")

    print(f"[INFO] image_gen: task submitted, task_id={task_id}")

    # Step 2: Poll for task completion (non-blocking)
    task_url = f"{DASHSCOPE_TASK_URL}/{task_id}"
    last_poll_error = ""
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
            last_poll_error = str(e)
            print(f"[WARN] image_gen poll attempt {attempt} failed: {e}")
            continue

        status = poll_data.get("output", {}).get("task_status", "")
        if status == "SUCCEEDED":
            results = poll_data.get("output", {}).get("results", [])
            if results:
                url = results[0].get("url", "")
                print(f"[INFO] image_gen: success, url={url[:80]}...")
                return url
            raise ImageGenError("图片生成成功但结果为空 (SUCCEEDED with no results)")
        elif status == "FAILED":
            msg = poll_data.get("output", {}).get("message", "unknown")
            print(f"[ERROR] image_gen: task FAILED: {msg}")
            raise ImageGenError(f"图片生成任务失败: {msg}")

    raise ImageGenError(f"图片生成超时 (60秒)，最后轮询错误: {last_poll_error or 'none'}")
