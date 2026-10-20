"""English speech for lesson beats: Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT).

Model files are fetched once into outputs/kokoro/ (or KOKORO_DIR). Output is cached by
text/voice/speed so re-renders are deterministic and fast.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import urllib.request

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODEL_DIR = pathlib.Path(os.environ.get("KOKORO_DIR", ROOT / "outputs" / "kokoro"))
CACHE = ROOT / "outputs" / "en-tts-cache"
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/"
FILES = ("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
VOICES = {"af_heart", "af_bella", "af_nicole", "am_michael", "am_adam", "bf_emma", "bm_george"}
_engine = None


def _ensure_model() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        p = MODEL_DIR / f
        if not p.exists() or p.stat().st_size < 1_000_000:
            tmp = p.with_suffix(".part")
            urllib.request.urlretrieve(BASE + f, tmp)
            tmp.rename(p)


def _kokoro():
    global _engine
    if _engine is None:
        _ensure_model()
        from kokoro_onnx import Kokoro
        _engine = Kokoro(str(MODEL_DIR / FILES[0]), str(MODEL_DIR / FILES[1]))
    return _engine


def synthesize(text: str, voice: str = "af_heart", speed: float = 1.0, rate: int = 48000) -> np.ndarray:
    """Mono float32 PCM at `rate`, leading/trailing silence trimmed."""
    if voice not in VOICES:
        raise ValueError(f"unknown English voice {voice}; use one of {sorted(VOICES)}")
    key = hashlib.sha1(json.dumps([text, voice, speed, rate]).encode()).hexdigest()[:20]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{key}.f32"
    if cached.exists():
        return np.fromfile(cached, np.float32)
    samples, sr = _kokoro().create(text, voice=voice, speed=float(speed), lang="en-us")
    x = np.asarray(samples, np.float32)
    if sr != rate:  # linear resample is enough for speech at these rates
        t = np.arange(int(len(x) * rate / sr)) * (sr / rate)
        x = np.interp(t, np.arange(len(x)), x).astype(np.float32)
    thr = 0.01 * (np.max(np.abs(x)) or 1)
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx):
        pad = int(0.04 * rate)
        x = x[max(0, idx[0] - pad): idx[-1] + pad]
    x.tofile(cached)
    return x
