"""Narration with VOICEVOX and caption timing derived from the synthesized moras.

Each beat's narration is synthesized once as a whole sentence (natural intonation).
Caption chunk boundaries are placed on that same audio by mora counts, so captions
change exactly when the voice reaches them instead of being spread evenly.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import urllib.parse
import urllib.request
import wave

import numpy as np

RATE = 48000
ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "outputs" / "shorts-voice"


def base_url() -> str:
    return os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021")


def _post(path: str, data: bytes | None = None, timeout: int = 90) -> bytes:
    req = urllib.request.Request(base_url() + path, method="POST", data=data,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def speaker_id(voice: dict) -> int:
    with urllib.request.urlopen(base_url() + "/speakers", timeout=30) as r:
        speakers = json.load(r)
    name, style = voice.get("speaker", "青山龍星"), voice.get("style", "ノーマル")
    for s in speakers:
        if s["name"] == name:
            for st in s["styles"]:
                if st["name"] == style:
                    return st["id"]
            return s["styles"][0]["id"]
    raise RuntimeError(f"VOICEVOX speaker not installed: {name}")


def query(text: str, sid: int) -> dict:
    return json.loads(_post(f"/audio_query?text={urllib.parse.quote(text)}&speaker={sid}"))


def mora_count(q: dict) -> int:
    n = 0
    for ap in q["accent_phrases"]:
        n += len(ap["moras"])
    return max(n, 1)


def _phoneme_times(q: dict) -> list[tuple[float, float]]:
    """(start,end) seconds of each spoken mora in a query, honoring speedScale."""
    speed = q.get("speedScale", 1.0)
    t = q.get("prePhonemeLength", 0.1)
    out = []
    for ap in q["accent_phrases"]:
        for m in ap["moras"]:
            dur = (m.get("consonant_length") or 0) + m["vowel_length"]
            out.append((t / speed, (t + dur) / speed))
            t += dur
        if ap.get("pause_mora"):
            t += ap["pause_mora"]["vowel_length"]
    return out


def synthesize(text: str, chunks: list[str], voice: dict) -> dict:
    """Return {'pcm': float32 mono @48k, 'duration', 'chunks': [(start,end,text)], 'moras'}."""
    key = hashlib.sha1(json.dumps([text, chunks, voice], ensure_ascii=False).encode()).hexdigest()[:20]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{key}.json"
    wav_path = CACHE / f"{key}.wav"
    if cached.exists() and wav_path.exists():
        meta = json.loads(cached.read_text())
        meta["pcm"] = _read_wav(wav_path)
        return meta
    sid = speaker_id(voice)
    q = query(text, sid)
    q["speedScale"] = float(voice.get("speed", 1.15))
    q["pitchScale"] = float(voice.get("pitch", 0.0))
    q["intonationScale"] = float(voice.get("intonation", 1.15))
    q["volumeScale"] = 1.0
    q["prePhonemeLength"] = 0.05
    q["postPhonemeLength"] = 0.08
    q["outputSamplingRate"] = RATE
    q["outputStereo"] = False
    wav = _post(f"/synthesis?speaker={sid}", json.dumps(q, ensure_ascii=False).encode())
    wav_path.write_bytes(wav)
    pcm = _read_wav(wav_path)
    times = _phoneme_times(q)
    # Map caption chunks onto mora times by proportional mora counts.
    counts = [mora_count(query(c, sid)) for c in chunks] if len(chunks) > 1 else [len(times)]
    total_c = sum(counts)
    spans = []
    acc = 0
    n = len(times)
    for c, cnt in zip(chunks, counts):
        i0 = min(n - 1, round(acc / total_c * n))
        acc += cnt
        i1 = min(n - 1, max(i0, round(acc / total_c * n) - 1))
        spans.append([times[i0][0], times[i1][1], c])
    # Captions stay up until the next one starts (no flicker between chunks).
    for i in range(len(spans) - 1):
        spans[i][1] = spans[i + 1][0]
    duration = len(pcm) / RATE
    if spans:
        spans[0][0] = 0.0
        spans[-1][1] = duration
    meta = {"duration": duration, "chunks": spans, "moras": len(times), "speaker": voice.get("speaker"),
            "style": voice.get("style", "ノーマル")}
    cached.write_text(json.dumps(meta, ensure_ascii=False))
    meta["pcm"] = pcm
    return meta


def _read_wav(p: pathlib.Path) -> np.ndarray:
    with wave.open(str(p), "rb") as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw != 2:
        raise RuntimeError("unexpected sample width")
    a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch == 2:
        a = a.reshape(-1, 2).mean(axis=1)
    if sr != RATE:
        # linear resample (only for unexpected engines)
        x = np.linspace(0, len(a) - 1, int(len(a) * RATE / sr))
        a = np.interp(x, np.arange(len(a)), a).astype(np.float32)
    return a


def silent(chunks: list[str], seconds_per_char: float = 0.13) -> dict:
    """Engine 'none': timing estimate so captions/tests work without TTS."""
    spans, t = [], 0.0
    for c in chunks:
        d = max(0.6, len(c) * seconds_per_char)
        spans.append([t, t + d, c])
        t += d
    return {"duration": t, "chunks": spans, "moras": int(t * 7), "pcm": np.zeros(int(t * RATE), np.float32)}
