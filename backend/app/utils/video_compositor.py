"""
FFmpeg video compositor.
Uses the FFmpeg binary bundled inside imageio-ffmpeg — no system install required.
Overlays the D-ID talking-head avatar as a picture-in-picture (bottom-right)
on top of the whiteboard animation video.
"""

import os
import shutil
import subprocess
import asyncio
import logging

logger = logging.getLogger(__name__)


def _get_ffmpeg() -> str:
    """Return path to FFmpeg: system binary first, then imageio-ffmpeg bundle."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise RuntimeError(
            "FFmpeg not found. Install: pip install imageio-ffmpeg"
        )


async def composite_video(
    whiteboard_local: str,
    avatar_local: str,
    topic_id: str,
    avatar_scale: float = 0.27,   # avatar occupies ~27 % of frame width
    margin: int = 20,
) -> str:
    """
    Overlay avatar PiP on whiteboard background.
    Audio track comes from the D-ID avatar (already synced to lip movements).

    Args:
        whiteboard_local: local filesystem path to whiteboard MP4
        avatar_local:     local filesystem path to D-ID avatar MP4
        topic_id:         used to name the output file
        avatar_scale:     fraction of frame width for avatar (default 0.27 → ~346 px)
        margin:           pixel gap from frame edges

    Returns URL path e.g. /static/videos/topic_{id}_final.mp4
    """
    return await asyncio.to_thread(
        _composite_sync, whiteboard_local, avatar_local, topic_id, avatar_scale, margin
    )


def _composite_sync(
    whiteboard_local: str,
    avatar_local: str,
    topic_id: str,
    avatar_scale: float,
    margin: int,
) -> str:
    ffmpeg = _get_ffmpeg()
    os.makedirs("static/videos", exist_ok=True)
    output_path = f"static/videos/topic_{topic_id}_final.mp4"

    # avatar_width = round(1280 * avatar_scale)  → ~346 px
    # FFmpeg filter:
    #   [1:v] scale the avatar to avatar_width wide (preserve aspect ratio)
    #   overlay at (W-w-margin : H-h-margin) = bottom-right corner
    #   audio from stream 1 (D-ID avatar) — already synced to lip movement
    scale_expr = f"iw*{avatar_scale:.3f}"
    filter_complex = (
        f"[1:v]scale={scale_expr}:-2[av];"
        f"[0:v][av]overlay=W-w-{margin}:H-h-{margin}[vout]"
    )

    cmd = [
        ffmpeg, "-y",
        "-i", whiteboard_local,   # stream 0: whiteboard (no audio)
        "-i", avatar_local,       # stream 1: D-ID avatar (has audio)
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "1:a",            # use D-ID audio
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",              # trim to the shorter stream (avatar)
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info(f"Compositing video for topic {topic_id} …")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg compositing failed (exit {result.returncode}):\n"
            f"{result.stderr[-600:]}"
        )

    logger.info(f"Final video composited: {output_path}")
    return f"/static/videos/topic_{topic_id}_final.mp4"


# ── Teacher PiP compositor ─────────────────────────────────────────────────────

async def composite_teacher_pip(
    whiteboard_local: str,
    teacher_video_local: str,
    topic_id: str,
    pip_size: int = 240,    # diameter of circular face cam in pixels
    pip_margin: int = 24,   # px from bottom-right corner
) -> str:
    """
    Overlay teacher's recorded face-cam as a circular PiP on the whiteboard animation.

    - Whiteboard fills the full 1280×720 frame (visuals + TTS audio muted)
    - Teacher's video is cropped to a circle and placed in the bottom-right corner
    - Teacher's own microphone audio becomes the final audio track
    - No GPU / AI required — pure FFmpeg

    Returns URL path e.g. /static/videos/final_{topic_id}.mp4
    """
    return await asyncio.to_thread(
        _composite_pip_sync,
        whiteboard_local, teacher_video_local, topic_id, pip_size, pip_margin,
    )


def _composite_pip_sync(
    whiteboard_local: str,
    teacher_video_local: str,
    topic_id: str,
    pip_size: int,
    pip_margin: int,
) -> str:
    ffmpeg = _get_ffmpeg()
    os.makedirs("static/videos", exist_ok=True)
    output_path = f"static/videos/final_{topic_id}.mp4"

    pip_r = pip_size // 2  # radius

    # Filter graph:
    # 1. Scale teacher video to pip_size × pip_size square
    # 2. Convert to RGBA so we can apply per-pixel alpha
    # 3. geq: keep pixel if inside circle (hypot from centre < radius), else transparent
    # 4. Overlay on whiteboard at bottom-right, pip_margin from edges
    # 5. Audio from teacher recording (stream 1)
    filter_complex = (
        f"[1:v]scale={pip_size}:{pip_size},format=rgba,"
        f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)'"
        f":a='if(gt(hypot(X-{pip_r},Y-{pip_r}),{pip_r - 2}),0,255)'[pip];"
        f"[0:v][pip]overlay=main_w-{pip_size + pip_margin}:main_h-{pip_size + pip_margin}[vout]"
    )

    cmd = [
        ffmpeg, "-y",
        "-i", whiteboard_local,       # stream 0: animated whiteboard
        "-i", teacher_video_local,    # stream 1: teacher recording (video + audio)
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "1:a",                # teacher's mic audio is the soundtrack
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info(f"Compositing teacher PiP for topic {topic_id} …")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg teacher PiP composite failed (exit {result.returncode}):\n"
            f"{result.stderr[-800:]}"
        )

    logger.info(f"Teacher PiP video: {output_path}")
    return f"/static/videos/final_{topic_id}.mp4"
