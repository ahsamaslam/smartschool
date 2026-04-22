#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Full Wav2Lip setup script (run AFTER PyTorch is already installed).
  Run from the "e:\Smart School" directory:
    .\wav2lip_setup\setup_wav2lip.ps1
#>

$ErrorActionPreference = "Stop"
$ROOT    = "e:\Smart School"
$SETUP   = "$ROOT\wav2lip_setup"
$ENV_PIP = "$ROOT\wav2lip_env\Scripts\pip.exe"
$ENV_PY  = "$ROOT\wav2lip_env\Scripts\python.exe"

Write-Host "`n=== Step 1: Verify PyTorch ===" -ForegroundColor Cyan
& $ENV_PY -c "import torch; print('torch', torch.__version__); print('CUDA:', torch.cuda.is_available())"

Write-Host "`n=== Step 2: Clone Wav2Lip repo ===" -ForegroundColor Cyan
if (Test-Path "$SETUP\Wav2Lip") {
    Write-Host "  Already cloned." -ForegroundColor Green
} else {
    Set-Location $SETUP
    git clone https://github.com/Rudrabha/Wav2Lip.git
}

Write-Host "`n=== Step 3: Install Wav2Lip Python deps ===" -ForegroundColor Cyan
& $ENV_PIP install -r "$SETUP\wav2lip_requirements.txt"

Write-Host "`n=== Step 4: Download model weights ===" -ForegroundColor Cyan
& $ENV_PY "$SETUP\download_weights.py"

Write-Host "`n=== Step 5: Copy face detection weights ===" -ForegroundColor Cyan
$fd_dest = "$SETUP\Wav2Lip\face_detection\detection\sfd"
if (-not (Test-Path $fd_dest)) { New-Item -ItemType Directory -Path $fd_dest -Force | Out-Null }
$s3fd_src  = "$SETUP\checkpoints\s3fd.pth"
$s3fd_dest = "$fd_dest\s3fd.pth"
if (Test-Path $s3fd_src) {
    Copy-Item $s3fd_src $s3fd_dest -Force
    Write-Host "  Copied s3fd.pth → $s3fd_dest" -ForegroundColor Green
} else {
    Write-Warning "s3fd.pth not found in checkpoints — download_weights.py may have failed."
}

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "Test with:"
Write-Host "  [wav2lip_env python] wav2lip_setup\wav2lip_infer.py --face static\teacher_face.jpg --audio static\audio\test.mp3 --out static\videos\test_avatar.mp4"
