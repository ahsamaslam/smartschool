"""
Animated interactive slide video generator.
Per-frame animation with Pillow:
  - Typewriter text reveal on headings and title
  - Hand-drawn wavy animated underlines
  - Bullet-by-bullet fade-in reveal with numbered circles
  - Smooth cross-fade transitions between slides
  - Animated diagram cards with progressive text
  - Summary card with tick-reveal animation
  - Optional audio mux via FFmpeg
"""

import os
import re
import math
import shutil
import subprocess
import asyncio
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── Palette ────────────────────────────────────────────────────────────────────
BG   = (248, 249, 255)
DARK = (15,  23,  42)
BLUE = (37,  99,  235)
GRAY = (100, 116, 139)

SECTION_META = {
    "Hook":                {"color": (124, 58, 237),  "label": "HOOK"},
    "Context":             {"color": (37,  99, 235),  "label": "CONTEXT"},
    "Core Concept":        {"color": (37,  99, 235),  "label": "CORE CONCEPT"},
    "Worked Example":      {"color": (22,  163, 74),  "label": "WORKED EXAMPLE"},
    "Common Mistakes":     {"color": (220, 38,  38),  "label": "COMMON MISTAKES"},
    "Deeper Insight":      {"color": (217, 70,   0),  "label": "DEEPER INSIGHT"},
    "Summary":             {"color": (15,  118, 110), "label": "SUMMARY"},
    "Introduction":        {"color": (37,  99,  235), "label": "INTRODUCTION"},
    "Key Concepts":        {"color": (37,  99,  235), "label": "KEY CONCEPTS"},
    "Examples":            {"color": (22,  163, 74),  "label": "EXAMPLES"},
    "Examples & Practice": {"color": (22,  163, 74),  "label": "PRACTICE"},
    "Deep Dive":           {"color": (217, 70,   0),  "label": "DEEP DIVE"},
}

def _get_meta(heading: str) -> dict:
    return SECTION_META.get(heading, {"color": BLUE, "label": heading.upper()})


# ── Public API ─────────────────────────────────────────────────────────────────

def _get_ffmpeg() -> str:
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise RuntimeError("FFmpeg not found. Run: pip install imageio-ffmpeg")


async def generate_whiteboard_video(
    script: str,
    visual_elements: List[str],
    topic_title: str,
    topic_id: str,
    audio_path: Optional[str] = None,   # local filesystem path to MP3/WAV
) -> str:
    """
    Render a whiteboard-style MP4 for a topic, optionally muxed with audio.
    Runs in a thread pool to avoid blocking the event loop.
    Returns URL path e.g. /static/videos/whiteboard_{id}.mp4
    """
    return await asyncio.to_thread(
        _render_whiteboard_sync,
        script, visual_elements, topic_title, topic_id, audio_path,
    )


# ── Internal rendering ─────────────────────────────────────────────────────────

def _render_whiteboard_sync(
    script: str,
    visual_elements: List[str],
    topic_title: str,
    topic_id: str,
    audio_path: Optional[str] = None,
) -> str:
    try:
        from PIL import Image, ImageDraw, ImageFont
        import imageio
        import numpy as np
    except ImportError as e:
        raise RuntimeError(f"Missing dependency: {e}. Run: pip install Pillow imageio imageio-ffmpeg numpy")

    W, H  = 1280, 720
    FPS   = 24

    # ── Fonts ──────────────────────────────────────────────────────────────────
    def get_font(size: int):
        for path in [
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
        return ImageFont.load_default()

    f_xl = get_font(52)
    f_lg = get_font(38)
    f_md = get_font(26)
    f_sm = get_font(20)
    f_xs = get_font(15)

    # ── Text wrapping ──────────────────────────────────────────────────────────
    _measure_img  = Image.new("RGB", (1, 1))
    _measure_draw = ImageDraw.Draw(_measure_img)

    def wrap(text: str, font, max_w: int) -> List[str]:
        words = text.split()
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            if _measure_draw.textbbox((0, 0), test, font=font)[2] > max_w and cur:
                lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            lines.append(cur)
        return lines

    # ── Animation primitives ───────────────────────────────────────────────────
    def crossfade(a: "np.ndarray", b: "np.ndarray", n: int = 8) -> List["np.ndarray"]:
        fa, fb = a.astype(float), b.astype(float)
        return [(fa * (1 - (i+1)/n) + fb * ((i+1)/n)).astype(np.uint8) for i in range(n)]

    def fade_from_white(frame: "np.ndarray", n: int = 10) -> List["np.ndarray"]:
        white = np.full_like(frame, 255)
        return crossfade(white, frame, n)

    def hold(frame: "np.ndarray", n: int) -> List["np.ndarray"]:
        return [frame] * n

    # ── Hand-drawn wavy underline ──────────────────────────────────────────────
    def wavy_line(draw: "ImageDraw.Draw", x0: int, y: int, x1: int,
                  color: tuple, width: int = 3, progress: float = 1.0) -> None:
        end_x = int(x0 + progress * (x1 - x0))
        prev = None
        for x in range(x0, end_x + 1, 3):
            yy = y + int(2.5 * math.sin(x * 0.09))
            if prev:
                draw.line([prev, (x, yy)], fill=color, width=width)
            prev = (x, yy)

    # ── Shared slide chrome ────────────────────────────────────────────────────
    def make_base_image(accent: tuple, label: str, slide_num: int, total: int) -> "Image.Image":
        img  = Image.new("RGB", (W, H), BG)
        draw = ImageDraw.Draw(img)
        # Subtle grid
        for gy in range(82, H - 8, 54):
            draw.line([(0, gy), (W, gy)], fill=(228, 232, 242), width=1)
        # Header bar
        draw.rectangle([0, 0, W, 74], fill=accent)
        # Left accent strip
        draw.rectangle([0, 0, 8, H], fill=accent)
        # Header text
        draw.text((28, 37), label, fill="white", anchor="lm", font=f_sm)
        draw.text((W - 20, 37), "Smart School", fill=(220, 230, 255), anchor="rm", font=f_xs)
        # Progress bar
        draw.rectangle([0, H - 7, W, H], fill=(220, 226, 242))
        pw = int(W * slide_num / max(total, 1))
        if pw > 0:
            draw.rectangle([0, H - 7, pw, H], fill=accent)
        return img

    # ── TITLE SLIDE (animated) ─────────────────────────────────────────────────
    def make_title_frames() -> List["np.ndarray"]:
        base = Image.new("RGB", (W, H), BG)
        db = ImageDraw.Draw(base)
        db.rectangle([0, 0, W, 12], fill=BLUE)
        db.rectangle([0, 0, 10, H], fill=BLUE)
        db.rectangle([0, H - 7, W, H], fill=BLUE)

        pill = "Smart School  ·  Interactive Lecture"
        pb   = _measure_draw.textbbox((0, 0), pill, font=f_xs)
        pw   = pb[2] - pb[0] + 28

        title_lines = wrap(topic_title, f_xl, W - 160)
        total_chars = sum(len(l) for l in title_lines)

        def render(n_chars: int, ul_prog: float) -> "np.ndarray":
            img  = base.copy()
            draw = ImageDraw.Draw(img)
            draw.rounded_rectangle([W//2 - pw//2, 46, W//2 + pw//2, 72],
                                   radius=13, fill=(219, 234, 254))
            draw.text((W//2, 59), pill, fill=BLUE, anchor="mm", font=f_xs)

            left = n_chars
            y    = H // 2 - len(title_lines) * 37
            last_y = y
            for line in title_lines:
                shown = line[:left]
                if shown:
                    draw.text((W//2, y), shown, fill=DARK, anchor="mm", font=f_xl)
                left   = max(0, left - len(line))
                last_y = y
                y     += 74

            if ul_prog > 0:
                wavy_line(draw, W//2 - 200, last_y + 46, W//2 + 200, BLUE, 4, ul_prog)

            if n_chars >= total_chars:
                draw.text((W//2, H - 48), "Teacher Explained  ·  AI Animated",
                          fill=GRAY, anchor="mm", font=f_sm)
            # cursor blink
            if n_chars < total_chars:
                draw.rectangle([W//2 + 8, H//2 - 30, W//2 + 14, H//2 + 10], fill=BLUE)
            return np.array(img)

        frames: List["np.ndarray"] = []
        # Type in
        CPF = 5
        for f in range(max(1, total_chars // CPF + 1)):
            frames.append(render(min(total_chars, (f + 1) * CPF), 0.0))
        # Draw underline
        for f in range(18):
            frames.append(render(total_chars, (f + 1) / 18))
        # Hold
        frames.extend(hold(render(total_chars, 1.0), int(2.5 * FPS)))
        return frames

    # ── SECTION SLIDE (animated) ───────────────────────────────────────────────
    def make_section_frames(heading: str, bullets: List[str],
                            slide_num: int, total: int) -> List["np.ndarray"]:
        meta   = _get_meta(heading)
        accent = meta["color"]
        label  = meta["label"]
        base   = make_base_image(accent, label, slide_num, total)
        base_a = np.array(base)

        h_lines     = wrap(heading, f_lg, W - 120)
        total_hchrs = sum(len(l) for l in h_lines)
        h_y0        = 84

        def blend_color(c: tuple, alpha: float) -> tuple:
            return tuple(int(c[i] * alpha + BG[i] * (1 - alpha)) for i in range(3))

        def render(n_hchrs: int, ul_prog: float,
                   n_bullets: int, b_alpha: float) -> "np.ndarray":
            img  = Image.fromarray(base_a.copy())
            draw = ImageDraw.Draw(img)

            # Heading typewriter
            left = n_hchrs
            hy   = h_y0
            for line in h_lines:
                shown = line[:left]
                if shown:
                    draw.text((60, hy), shown, fill=DARK, font=f_lg)
                left = max(0, left - len(line))
                hy  += 50

            # Wavy underline
            if ul_prog > 0 and n_hchrs >= total_hchrs:
                wavy_line(draw, 58, h_y0 + 50 * len(h_lines) + 4,
                          W - 60, accent, 3, ul_prog)

            # Bullets
            by = h_y0 + 50 * len(h_lines) + 30
            for bi, bullet in enumerate(bullets[:5]):
                if bi >= n_bullets or by > H - 52:
                    break
                b_lines  = wrap(bullet, f_md, W - 140)
                block_h  = min(len(b_lines), 3) * 36
                is_cur   = (bi == n_bullets - 1)
                alpha    = b_alpha if is_cur else 1.0

                cx, cy = 46, by + block_h // 2
                draw.ellipse([cx-16, cy-16, cx+16, cy+16], fill=blend_color(accent, alpha))
                draw.text((cx, cy), str(bi + 1), fill=blend_color((255,255,255), alpha),
                          anchor="mm", font=f_xs)
                draw.rectangle([66, by, 70, by + block_h], fill=blend_color(accent, alpha))

                ty = by
                for bl in b_lines[:3]:
                    draw.text((80, ty), bl, fill=blend_color(DARK, alpha), font=f_md)
                    ty += 36
                by += block_h + 20

            return np.array(img)

        frames: List["np.ndarray"] = []
        CPF = 4
        # Phase 1: type heading
        for f in range(max(1, total_hchrs // CPF + 1)):
            frames.append(render(min(total_hchrs, (f+1)*CPF), 0.0, 0, 0.0))
        # Phase 2: draw underline
        for f in range(18):
            frames.append(render(total_hchrs, (f+1)/18, 0, 0.0))
        # Phase 3: reveal bullets one by one
        FADE_F = 12
        HOLD_F = int(1.8 * FPS)
        for bi in range(len(bullets[:5])):
            for f in range(FADE_F):
                frames.append(render(total_hchrs, 1.0, bi+1, (f+1)/FADE_F))
            frames.extend(hold(render(total_hchrs, 1.0, bi+1, 1.0), HOLD_F))
        # Phase 4: final hold
        frames.extend(hold(render(total_hchrs, 1.0, len(bullets[:5]), 1.0), int(1.5 * FPS)))
        return frames

    # ── VISUAL SLIDE (animated) ────────────────────────────────────────────────
    def make_visual_frames(visual_text: str, visual_num: int,
                           slide_num: int, total: int) -> List["np.ndarray"]:
        colors = [(124,58,237),(37,99,235),(22,163,74),(217,70,0),(15,118,110)]
        accent = colors[visual_num % len(colors)]
        base   = make_base_image(accent, f"DIAGRAM {visual_num+1}", slide_num, total)
        base_a = np.array(base)
        v_lines = wrap(visual_text, f_md, W - 120)

        def render(card_alpha: float, n_chars: int) -> "np.ndarray":
            img  = Image.fromarray(base_a.copy())
            draw = ImageDraw.Draw(img)
            cx1, cy1, cx2, cy2 = 48, 84, W - 48, H - 14
            ca = int(card_alpha * 245)
            draw.rounded_rectangle([cx1, cy1, cx2, cy2], radius=18,
                                   fill=(ca, ca, min(255, ca+10)))
            bc = tuple(int(accent[i] * card_alpha) for i in range(3))
            draw.rounded_rectangle([cx1, cy1, cx2, cy2], radius=18, outline=bc, width=2)
            if card_alpha > 0.5:
                left = n_chars
                ty   = cy1 + 56
                for line in v_lines[:5]:
                    shown = line[:left]
                    if shown and ty < cy2 - 32:
                        draw.text((W//2, ty), shown, fill=DARK, anchor="mm", font=f_md)
                    left = max(0, left - len(line))
                    ty  += 42
            draw.text((W//2, cy2 - 16), "Visualise this concept",
                      fill=(160, 174, 192), anchor="mm", font=f_xs)
            return np.array(img)

        frames: List["np.ndarray"] = []
        for f in range(16):
            frames.append(render((f+1)/16, 0))
        total_vc = sum(len(l) for l in v_lines)
        for f in range(max(1, total_vc // 4 + 1)):
            frames.append(render(1.0, min(total_vc, (f+1)*4)))
        frames.extend(hold(render(1.0, total_vc), int(4 * FPS)))
        return frames

    # ── SUMMARY SLIDE (animated) ───────────────────────────────────────────────
    def make_summary_frames(key_points: List[str],
                            slide_num: int, total: int) -> List["np.ndarray"]:
        accent = (15, 118, 110)
        base   = make_base_image(accent, "KEY TAKEAWAYS", slide_num, total)
        base_a = np.array(base)

        def render(n_shown: int, last_alpha: float) -> "np.ndarray":
            img  = Image.fromarray(base_a.copy())
            draw = ImageDraw.Draw(img)
            y = 90
            for i, kp in enumerate(key_points[:5]):
                if i >= n_shown or y > H - 50:
                    break
                k_lines = wrap(kp, f_md, W - 130)
                block_h = min(len(k_lines), 2) * 36
                alpha   = last_alpha if i == n_shown - 1 else 1.0
                # Pill
                pc = tuple(int(accent[j] * alpha + BG[j] * (1-alpha)) for j in range(3))
                draw.rounded_rectangle([22, y, 56, y + block_h], radius=8, fill=pc)
                tc = tuple(int(255 * alpha) for _ in range(3))
                draw.text((39, y + block_h//2), "v", fill=tc, anchor="mm", font=f_sm)
                ty = y
                for line in k_lines[:2]:
                    dc = tuple(int(DARK[j]*alpha + BG[j]*(1-alpha)) for j in range(3))
                    draw.text((70, ty), line, fill=dc, font=f_md)
                    ty += 36
                y += block_h + 18
            if n_shown >= len(key_points[:5]) and last_alpha >= 1.0:
                draw.text((W//2, H - 30), "Great work! You've mastered this topic.",
                          fill=accent, anchor="mm", font=f_sm)
            return np.array(img)

        frames: List["np.ndarray"] = []
        for i in range(len(key_points[:5])):
            for f in range(12):
                frames.append(render(i+1, (f+1)/12))
            frames.extend(hold(render(i+1, 1.0), int(1.8 * FPS)))
        frames.extend(hold(render(len(key_points[:5]), 1.0), int(2 * FPS)))
        return frames

    # ── Parse + assemble all animated frames ──────────────────────────────────
    sections    = _parse_sections(script)
    visuals     = re.findall(r'\[VISUAL:\s*([^\]]+)\]', script)
    kp_match    = re.findall(r'\[KP:\s*([^\]]+)\]', script)
    summary_sec = next((s for s in sections if s["heading"].lower() == "summary"), None)
    summary_kp  = (summary_sec["bullets"]
                   if summary_sec and summary_sec["bullets"]
                   else visual_elements[:5] or kp_match[:5])

    total_slides = 1 + len(sections) + min(len(visuals), 4) + 1

    all_frames: List["np.ndarray"] = []

    # Title
    t_fr = make_title_frames()
    all_frames.extend(fade_from_white(t_fr[0], 10))
    all_frames.extend(t_fr)
    prev = t_fr[-1]

    # Section slides
    for si, s in enumerate(sections):
        s_fr = make_section_frames(s["heading"], s["bullets"], si + 1, total_slides)
        all_frames.extend(crossfade(prev, s_fr[0], 8))
        all_frames.extend(s_fr)
        prev = s_fr[-1]

    # Visual / diagram slides
    for vi, v in enumerate(visuals[:4]):
        v_fr = make_visual_frames(v.strip(), vi, len(sections) + vi + 1, total_slides)
        all_frames.extend(crossfade(prev, v_fr[0], 8))
        all_frames.extend(v_fr)
        prev = v_fr[-1]

    # Summary
    sum_fr = make_summary_frames(summary_kp, total_slides - 1, total_slides)
    all_frames.extend(crossfade(prev, sum_fr[0], 8))
    all_frames.extend(sum_fr)

    # Fade to black
    black = np.zeros_like(all_frames[-1])
    all_frames.extend(crossfade(all_frames[-1], black, 14))

    logger.info(
        f"Rendering {len(all_frames)} frames "
        f"({len(all_frames)/FPS:.1f}s) for topic {topic_id}"
    )

    # ── Write silent video ────────────────────────────────────────────────────
    os.makedirs("static/videos", exist_ok=True)
    silent_path = f"static/videos/whiteboard_{topic_id}_silent.mp4"
    final_path  = f"static/videos/whiteboard_{topic_id}.mp4"

    with imageio.get_writer(
        silent_path, fps=FPS, codec="libx264",
        quality=8, macro_block_size=1,
    ) as writer:
        for frame in all_frames:
            writer.append_data(frame)

    # ── Mux audio ─────────────────────────────────────────────────────────────
    if audio_path and os.path.exists(audio_path):
        try:
            ffmpeg = _get_ffmpeg()
            cmd = [
                ffmpeg, "-y",
                "-i", silent_path,
                "-i", audio_path,
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-shortest", "-movflags", "+faststart",
                final_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if result.returncode != 0:
                logger.warning(f"Audio mux failed: {result.stderr[-300:]}. Using silent.")
                os.replace(silent_path, final_path)
            else:
                try:
                    os.remove(silent_path)
                except OSError:
                    pass
        except Exception as e:
            logger.warning(f"Audio mux error: {e}. Using silent.")
            os.replace(silent_path, final_path)
    else:
        os.replace(silent_path, final_path)

    logger.info(f"Whiteboard video: {final_path}")
    return f"/static/videos/whiteboard_{topic_id}.mp4"


# ── Script parsing ─────────────────────────────────────────────────────────────

def _parse_sections(script: str) -> List[dict]:
    """Extract sections from the 7-section prompt structure."""
    pattern = re.compile(
        r'\b(HOOK|CONTEXT|CORE CONCEPT|WORKED EXAMPLE|COMMON MISTAKES|DEEPER INSIGHT|SUMMARY'
        r'|INTRODUCTION|KEY CONCEPTS|EXAMPLES|DEEP DIVE|EXAMPLES & PRACTICE)\s*[:\-]\s*',
        re.IGNORECASE,
    )
    parts = pattern.split(script)
    sections = []
    i = 1
    while i < len(parts) - 1:
        heading_raw = parts[i].strip().title()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        body = re.sub(r'\[VISUAL:[^\]]*\]', '', body).strip()
        sentences = [
            s.strip()
            for s in re.split(r'(?<=[.!?])\s+', body)
            if len(s.strip()) > 20
        ]
        sections.append({"heading": heading_raw, "bullets": sentences[:5]})
        i += 2

    if not sections:
        # Fallback: generic chunking
        clean = re.sub(r'\[VISUAL:[^\]]*\]', '', script)
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', clean) if len(s.strip()) > 20]
        chunk = max(3, len(sentences) // 5)
        labels = ["Hook", "Core Concept", "Worked Example", "Deeper Insight", "Summary"]
        for idx, start in enumerate(range(0, min(len(sentences), 25), chunk)):
            sections.append({"heading": labels[min(idx, 4)], "bullets": sentences[start:start + chunk]})

    return sections[:7]
