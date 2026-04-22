"""
Wav2Lip inference wrapper.
Generates a talking-head MP4 from a face photo + audio file using the
wav2lip_gan model running on the local RTX 3070 GPU.

Usage (standalone test):
  py -3.11 wav2lip_infer.py --face teacher.jpg --audio topic.mp3 --out output.mp4
"""

import argparse
import os
import sys
import subprocess


WAV2LIP_REPO = os.path.join(os.path.dirname(__file__), "Wav2Lip")
CHECKPOINT   = os.path.join(WAV2LIP_REPO, "checkpoints", "wav2lip_gan.pth")
PYTHON       = os.path.join(os.path.dirname(__file__), "..", "wav2lip_env", "Scripts", "python.exe")
PYTHON       = os.path.normpath(PYTHON)


def _check_face_detected(face_path: str):
    """Quick OpenCV Haar-cascade check before sending to Wav2Lip."""
    import cv2
    img = cv2.imread(face_path)
    if img is None:
        raise ValueError(f"Cannot read image: {face_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))
    if len(faces) == 0:
        raise ValueError(
            f"No face detected in {face_path}.\n"
            "Please provide a clear, well-lit portrait photo where the face is front-facing.\n"
            "Place it at:  e:\\Smart School\\static\\teacher_face.jpg"
        )
    print(f"  Face detected: {len(faces)} face(s) found in {os.path.basename(face_path)}")


def run_wav2lip(face_path: str, audio_path: str, output_path: str, resize_factor: int = 1) -> str:
    """
    Run Wav2Lip inference.

    Args:
        face_path:   Path to teacher photo (JPG/PNG) or a short face video
        audio_path:  Path to narration audio (MP3 or WAV)
        output_path: Where to save the result MP4
        resize_factor: Downscale input for speed (1 = full res, 2 = half, 4 = quarter)

    Returns:
        output_path on success
    Raises:
        RuntimeError on failure
    """
    if not os.path.exists(WAV2LIP_REPO):
        raise RuntimeError(
            f"Wav2Lip repo not found at {WAV2LIP_REPO}. "
            "Run setup: git clone https://github.com/Rudrabha/Wav2Lip.git wav2lip_setup/Wav2Lip"
        )
    if not os.path.exists(CHECKPOINT):
        raise RuntimeError(
            f"Model weights not found at {CHECKPOINT}. "
            "Run: py -3.11 wav2lip_setup/download_weights.py"
        )

    # Pre-validate face is detectable before running full inference
    _check_face_detected(face_path)

    # Ensure temp/ dir exists inside Wav2Lip repo (inference.py writes temp/temp.wav there)
    os.makedirs(os.path.join(WAV2LIP_REPO, "temp"), exist_ok=True)

    # Pre-convert MP3 → WAV using bundled ffmpeg so inference.py never needs ffmpeg on PATH
    if not audio_path.lower().endswith(".wav"):
        wav_path = audio_path.rsplit(".", 1)[0] + "_wav2lip.wav"
        ffmpeg = _get_ffmpeg()
        import subprocess as _sp
        r = _sp.run(
            [ffmpeg, "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, text=True
        )
        if r.returncode != 0 or not os.path.exists(wav_path):
            raise RuntimeError(f"Audio conversion failed: {r.stderr[-300:]}")
        audio_path = wav_path

    inference_script = os.path.join(WAV2LIP_REPO, "inference.py")

    cmd = [
        PYTHON, inference_script,
        "--checkpoint_path", CHECKPOINT,
        "--face", face_path,
        "--audio", audio_path,
        "--outfile", output_path,
        "--resize_factor", str(resize_factor),
        "--nosmooth",
    ]

    print(f"Running Wav2Lip: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        cwd=WAV2LIP_REPO,   # inference.py writes temp/temp.wav relative to cwd
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Wav2Lip failed (exit {result.returncode}):\n"
            f"STDOUT: {result.stdout[-500:]}\n"
            f"STDERR: {result.stderr[-500:]}"
        )

    if not os.path.exists(output_path):
        raise RuntimeError(f"Wav2Lip ran but output file not found: {output_path}")

    return output_path


def _get_ffmpeg() -> str:
    """Return path to bundled ffmpeg binary (from imageio-ffmpeg in the wav2lip_env)."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    # Try system PATH as fallback
    import shutil
    ff = shutil.which("ffmpeg")
    if ff:
        return ff
    raise RuntimeError(
        "ffmpeg not found. Install imageio-ffmpeg into wav2lip_env: "
        "pip install imageio-ffmpeg"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--face",  required=True, help="Path to teacher face photo")
    parser.add_argument("--audio", required=True, help="Path to audio file (MP3/WAV)")
    parser.add_argument("--out",   required=True, help="Output MP4 path")
    parser.add_argument("--resize", type=int, default=1, help="Resize factor (1=full, 2=half)")
    args = parser.parse_args()

    out = run_wav2lip(args.face, args.audio, args.out, args.resize)
    print(f"\n✅ Avatar video saved: {out}")
