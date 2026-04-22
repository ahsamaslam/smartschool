"""
D-ID Talking Avatar API client.
Docs: https://docs.d-id.com/reference/talks
Pricing: ~$0.10/video-minute on Pay-As-You-Go; free trial = 20 short videos.
Sign up at https://studio.d-id.com/
"""

import os
import re
import base64
import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

DID_API = "https://api.d-id.com"

# Stock presenter image bundled by D-ID (always publicly accessible)
DEFAULT_PRESENTER = (
    "https://d-id-public-bucket.s3.us-east-1.amazonaws.com/alice.jpg"
)


async def generate_did_avatar(
    script: str,
    topic_id: str,
    api_key: str,
    presenter_url: str = DEFAULT_PRESENTER,
    voice_id: str = "en-US-JennyNeural",
) -> str:
    """
    Generate a talking-head avatar video via D-ID.
    - Strips [VISUAL: ...] markers from the script before sending to TTS.
    - Polls until the video is ready (up to 5 minutes).
    - Downloads the result to static/videos/avatar_{topic_id}.mp4.
    Returns the local URL path e.g. /static/videos/avatar_{topic_id}.mp4
    """
    if not api_key:
        raise ValueError(
            "D-ID API key not set. Add DID_API_KEY=<your_key> to backend/.env "
            "and restart the server. Sign up at https://studio.d-id.com/"
        )

    # Clean script for TTS
    clean = re.sub(r'\[VISUAL:[^\]]*\]', '', script)
    clean = re.sub(r'\b(HOOK|CORE CONCEPT|EXAMPLES|DEEP DIVE|SUMMARY)\s*[:\-]\s*', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()

    # D-ID limits ~5 000 chars (~750 words) per talk
    if len(clean) > 4_900:
        clean = clean[:4_890] + "..."

    # D-ID uses HTTP Basic auth: api_key as username, empty password
    creds = base64.b64encode(f"{api_key}:".encode()).decode()
    headers = {
        "Authorization": f"Basic {creds}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "source_url": presenter_url,
        "script": {
            "type": "text",
            "input": clean,
            "provider": {
                "type": "microsoft",
                "voice_id": voice_id,
            },
        },
        "config": {
            "fluent": True,
            "pad_audio": 0.0,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Create talk ────────────────────────────────────────────────────────
        resp = await client.post(f"{DID_API}/talks", headers=headers, json=payload)
        if resp.status_code not in (200, 201):
            raise ValueError(
                f"D-ID /talks failed ({resp.status_code}): {resp.text[:300]}"
            )
        talk_id = resp.json()["id"]
        logger.info(f"D-ID talk created: {talk_id}")

        # ── Poll for completion (max 5 min) ────────────────────────────────────
        for attempt in range(60):   # 60 × 5 s = 5 minutes
            await asyncio.sleep(5)
            poll = await client.get(f"{DID_API}/talks/{talk_id}", headers=headers)
            data = poll.json()
            status = data.get("status")

            if status == "done":
                result_url = data.get("result_url") or data.get("video_url")
                if not result_url:
                    raise ValueError("D-ID returned 'done' but no result_url")
                logger.info(f"D-ID talk done → {result_url}")
                break
            elif status == "error":
                raise ValueError(
                    f"D-ID render error: {data.get('error', {}).get('description', 'unknown')}"
                )
            else:
                logger.info(f"D-ID talk {talk_id}: {status} (poll {attempt + 1}/60)")
        else:
            raise TimeoutError(f"D-ID video for topic {topic_id} timed out after 5 min")

    # ── Download result ────────────────────────────────────────────────────────
    os.makedirs("static/videos", exist_ok=True)
    local_path = f"static/videos/avatar_{topic_id}.mp4"

    async with httpx.AsyncClient(timeout=120.0) as client:
        dl = await client.get(result_url)
        dl.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(dl.content)

    logger.info(f"Avatar saved: {local_path}")
    return f"/static/videos/avatar_{topic_id}.mp4"
