"""
Local Wav2Lip avatar generator.
Replaces D-ID API with fully local, free GPU inference on the RTX 3070.
Runs inside the wav2lip_env (Python 3.11 + PyTorch CUDA) as a subprocess
so the main FastAPI process (Python 3.14) doesn't need torch installed.
"""

import os
import asyncio
import logging

logger = logging.getLogger(__name__)

# Project root is 3 levels up from backend/app/utils/
_PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

WAV2LIP_INFER  = os.path.join(_PROJECT_ROOT, "wav2lip_setup", "wav2lip_infer.py")
WAV2LIP_PYTHON = os.path.join(_PROJECT_ROOT, "wav2lip_env",   "Scripts", "python.exe")

# Default teacher face image — place your photo at <project_root>/static/teacher_face.jpg
DEFAULT_FACE = os.path.join(_PROJECT_ROOT, "static", "teacher_face.jpg")


async def generate_wav2lip_avatar(
    audio_local_path: str,
    topic_id: str,
    face_path: str | None = None,
    resize_factor: int = 2,       # 2 = half resolution — much faster, still good quality
) -> str:
    """
    Generate a lip-synced talking-head video using local Wav2Lip on the RTX 3070.

    Args:
        audio_local_path: Local filesystem path to the narration MP3/WAV
        topic_id:         Used to name output file
        face_path:        Path to teacher face image (defaults to static/teacher_face.jpg)
        resize_factor:    1=full res (~2 min), 2=half res (~45 sec), 4=quarter (~20 sec)

    Returns:
        URL path e.g. /static/videos/avatar_{topic_id}.mp4
    """
    face = face_path or DEFAULT_FACE
    if not os.path.exists(face):
        raise ValueError(
            f"Teacher face image not found at {face}. "
            "Upload a photo to static/teacher_face.jpg"
        )
    if not os.path.exists(WAV2LIP_PYTHON):
        raise RuntimeError(
            f"wav2lip_env Python not found at {WAV2LIP_PYTHON}. "
            "Run setup: py -3.11 -m venv wav2lip_env && install PyTorch"
        )

    os.makedirs("static/videos", exist_ok=True)
    output_path = f"static/videos/avatar_{topic_id}.mp4"

    return await asyncio.to_thread(
        _run_wav2lip_sync, face, audio_local_path, output_path, topic_id, resize_factor
    )


def _run_wav2lip_sync(
    face_path: str,
    audio_path: str,
    output_path: str,
    topic_id: str,
    resize_factor: int,
) -> str:
    import subprocess

    cmd = [
        WAV2LIP_PYTHON, WAV2LIP_INFER,
        "--face",   face_path,
        "--audio",  audio_path,
        "--out",    output_path,
        "--resize", str(resize_factor),
    ]

    logger.info(f"Starting Wav2Lip inference for {output_path} …")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Wav2Lip failed (exit {result.returncode}):\n"
            f"{result.stderr[-600:]}"
        )

    if not os.path.exists(output_path):
        raise RuntimeError(f"Wav2Lip ran but output not found: {output_path}")

    logger.info(f"Avatar saved: {output_path}")
    return f"/static/videos/avatar_{topic_id}.mp4"
