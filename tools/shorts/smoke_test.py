#!/usr/bin/env python3
"""Technical smoke test for Shorts v3 (CI). Synthetic footage only; never content.

Builds a throwaway production under outputs/shorts-smoke/ with ffmpeg test patterns,
locks it, renders it, and asserts the pipeline's technical contract. Validation
failures for bad briefs are also exercised. Set SHORTS_TEST_VOICE=1 to use VOICEVOX.
"""
from __future__ import annotations

import copy
import json
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import brief as B  # noqa: E402
import footage  # noqa: E402
import render  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / "outputs" / "shorts-smoke"


def make_media():
    D.mkdir(parents=True, exist_ok=True)
    tone = D / "call.wav"
    if not tone.exists():  # stand-in for a real radio call: amplitude-modulated tone with noise
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                        "sine=frequency=440:duration=6,volume=0.05,tremolo=f=4:d=0.9", "-f", "lavfi", "-i",
                        "anoisesrc=d=6:a=0.01", "-filter_complex", "amix=inputs=2", str(tone)], check=True)
    for name, src, size in [("a.mp4", "testsrc2", "1920x1080"), ("b.mp4", "mandelbrot", "1080x1920")]:
        p = D / name
        if not p.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"{src}=size={size}:rate=30",
                            "-t", "8", "-pix_fmt", "yuv420p", str(p)], check=True)


BRIEF = {
    "version": 3, "id": "shorts-smoke", "title": "技術スモーク（公開禁止）", "status": "draft",
    "topic": {"source": "manual", "summary": "synthetic"}, "audience": "CI", "reaction": "驚き",
    "promise": {"firstFrame": "test pattern", "payoff": "test pattern"},
    "voice": {"engine": "voicevox" if os.environ.get("SHORTS_TEST_VOICE") else "none",
              "speaker": "青山龍星", "speed": 1.15},
    "music": {"asset": "flowerbed-fields", "gain": 0.16},
    "look": {"frame": "fill"},
    "beats": [
        {"id": "hook", "role": "hook", "overlay": "テスト映像", "say": "これはテスト映像です。／公開しません。",
         "emphasis": ["テスト"], "shots": [{"src": "local:a.mp4", "in": 0.5, "zoom": [1.0, 1.1]}],
         "sfx": "whoosh", "why": "pipeline"},
        {"id": "mid", "role": "evidence", "say": "二つ目のショットに切り替わり、／字幕も切り替わります。",
         "shots": [{"src": "local:b.mp4", "in": 0}, {"src": "local:a.mp4", "in": 3, "frame": "fit"}],
         "sfx": "pop", "why": "pipeline"},
        {"id": "call", "role": "evidence", "why": "pipeline: original audio with bilingual captions",
         "emphasis": ["we've had"],
         "clip": {"src": "local:call.wav", "in": 1.0, "out": 4.5,
                  "lines": [{"at": 0.0, "to": 1.8, "en": "Okay, Houston, we've had a problem here.",
                             "ja": "ヒューストン、問題が起きた"},
                            {"at": 1.8, "to": 3.5, "en": "Say again, please.", "ja": "もう一度どうぞ"}]},
         "shots": [{"src": "local:a.mp4", "in": 1, "label": "実際の交信音声"}]},
        {"id": "lesson", "role": "evidence", "why": "pipeline: English lesson line via Kokoro",
         "emphasis": ["running late"],
         "clip": {"tts": {"text": "Sorry, I'm running late.", "voice": "af_heart", "speed": 0.9},
                  "ja": "ごめん、遅れそう"},
         "shots": [{"src": "local:b.mp4", "in": 1}]},
        {"id": "end", "role": "payoff", "say": "最後です。", "min": 1.5,
         "shots": [{"src": "local:b.mp4", "in": 2, "speed": 2}], "why": "pipeline"},
    ],
}


def expect_invalid(mut, label):
    bad = copy.deepcopy(BRIEF)
    mut(bad)
    try:
        B.validate(bad)
    except B.BriefError:
        print("ok: rejected", label)
        return
    raise AssertionError("should be invalid: " + label)


def main():
    expect_invalid(lambda b: b["beats"].pop(0), "missing hook")
    expect_invalid(lambda b: b["beats"][0].pop("why"), "beat without why")
    expect_invalid(lambda b: b["promise"].update(firstFrame=""), "missing first frame promise")
    expect_invalid(lambda b: b["beats"][0]["shots"][0].update(src="http://x"), "unknown source scheme")
    expect_invalid(lambda b: b["beats"][2].update(say="ナレーション"), "clip beat with narration")
    expect_invalid(lambda b: b["beats"][2]["clip"].update(out=0.5), "clip out before in")
    expect_invalid(lambda b: b["beats"][2]["clip"]["lines"][0].update(to=9), "clip line past clip end")
    make_media()
    (D / "short.json").write_text(json.dumps(BRIEF, ensure_ascii=False), encoding="utf-8")
    b = B.load(D / "short.json")
    lock = footage.lock(b)
    assert all(m.get("sha256") for m in lock.values())
    # shot overrun must be rejected before rendering
    over = copy.deepcopy(BRIEF)
    over["beats"][2]["shots"][0]["in"] = 7.5
    over["beats"][2]["min"] = 3
    try:
        render.build_timeline(over | {"_dir": str(D)}, lock)
        raise AssertionError("overrun not detected")
    except B.BriefError:
        print("ok: rejected footage overrun")
    tl = render.build_timeline(b, lock)
    call = next(bt for bt in tl["beats"] if bt["id"] == "call")
    assert abs(call["speech"]["duration"] - 3.5) < 1e-6, call["speech"]["duration"]
    assert float(abs(call["speech"]["pcm"]).max()) > 0.05, "clip audio is silent"
    assert "\n" in call["captions"][0][2], "clip caption should be bilingual"
    print("ok: clip beat timing and audio")
    if os.environ.get("SHORTS_TEST_EN_TTS", "1") == "1":
        les = next(bt for bt in tl["beats"] if bt["id"] == "lesson")
        assert 0.8 < les["speech"]["duration"] < 4, les["speech"]["duration"]
        assert "running late" in les["captions"][0][2]
        print("ok: English TTS lesson beat")
    rep = render.render(str(D / "short.json"), lock, quick=True)
    out = ROOT / "outputs" / "shorts" / "shorts-smoke"
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json",
                                       str(out / "video.mp4")], capture_output=True, text=True,
                                      check=True).stdout)
    v = [s for s in probe["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in probe["streams"] if s["codec_type"] == "audio"]
    assert (v["width"], v["height"]) == (1080, 1920), v
    assert a, "no audio stream"
    for f in ["captions.srt", "description.txt", "timeline.json", "report.json", "review/first-frame.png",
              "review/contact-sheet.jpg", "review/scorecard.md"]:
        assert (out / f).exists(), f
    assert rep["status"] == "technical_pass", rep
    assert rep["editorialStatus"] == "draft"
    print("SMOKE OK", rep["seconds"], "s", rep["loudness"])


if __name__ == "__main__":
    main()
