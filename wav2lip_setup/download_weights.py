"""
Downloads Wav2Lip pretrained model weights.
Run this AFTER PyTorch is installed:
  py -3.11 download_weights.py
"""
import os, urllib.request, hashlib

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
os.makedirs(WEIGHTS_DIR, exist_ok=True)

FILES = [
    {
        "name": "wav2lip_gan.pth",
        "url": "https://huggingface.co/numz/wav2lip_studio/resolve/main/Wav2lip/wav2lip_gan.pth",
        "size_mb": 435,
    },
    {
        "name": "s3fd.pth",
        # face detection model — hosted on a reliable mirror
        "url": "https://huggingface.co/numz/wav2lip_studio/resolve/main/face_detection/s3fd.pth",
        "size_mb": 85,
    },
]


def download(url, dest, size_mb):
    if os.path.exists(dest):
        print(f"  ✓ Already exists: {os.path.basename(dest)}")
        return
    print(f"  ↓ Downloading {os.path.basename(dest)} (~{size_mb} MB)…")

    def progress(count, block, total):
        done = count * block
        pct = min(100, done * 100 // total) if total > 0 else 0
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"\r    [{bar}] {pct}%  ({done/1e6:.1f}/{total/1e6:.1f} MB)", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print()  # newline after progress bar
    print(f"  ✓ Saved: {dest}")


if __name__ == "__main__":
    print("Downloading Wav2Lip model weights…\n")
    for f in FILES:
        dest = os.path.join(WEIGHTS_DIR, f["name"])
        download(f["url"], dest, f["size_mb"])
    print("\nAll weights downloaded. Ready to generate avatar videos!")
