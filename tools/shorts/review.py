"""Review pack for a rendered Short.

Produces what an editor needs to judge the cut without trusting the pipeline:
first frame at phone size, one frame per second with beat labels, captions (SRT),
loudness numbers, the description with every credit, and a blank 6-axis scorecard.
Technical checks here are status `technical_pass` at most. `editorial_pass` is only
ever written by a person (or a reviewer who actually watched the cut) in the brief.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

AXES = [
    ("first_frame", "0秒の静止画を無音・スマホサイズで見て、何の動画か分かる"),
    ("shows_promise", "映像が語りの約束を本当に見せている（別物の代用なし）"),
    ("change", "途中で新しい変化・展開・期待がある（列挙の繰り返しでない）"),
    ("payoff", "最後に冒頭の約束を回収する報酬・オチがある"),
    ("sync", "音声・字幕・映像が同期し、聞き取りやすい"),
    ("share", "固有性があり、人に送りたくなる"),
]


def _srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def loudness(video: pathlib.Path) -> dict:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", txt)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", txt)
    return {"integratedLUFS": float(i[-1]) if i else None, "truePeakDBFS": float(tp[-1]) if tp else None}


def credits(b: dict, lock: dict) -> list[str]:
    lines = []
    used = []
    clips = []
    for bt in b["beats"]:
        for s in bt["shots"]:
            if s["src"] not in used:
                used.append(s["src"])
        if bt.get("clip") and bt["clip"].get("src") and bt["clip"]["src"] not in clips:
            clips.append(bt["clip"]["src"])
    for src in clips:
        m = lock[src]
        lines.append(f"音声（原音）: {m.get('author')} / Wikimedia Commons {m.get('pageUrl')} ({m.get('license')})"
                     if m["provider"] == "commons" else f"音声（原音）: {m.get('author')} ({m.get('license')})")
    used += [c for c in clips if c not in used]
    for src in [u for u in used if u not in clips]:
        m = lock[src]
        kind = "画像" if str(m.get("downloadUrl", "")).lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")) else "映像"
        if m["provider"] == "pixabay":
            lines.append(f"映像: {m.get('author')} / Pixabay {m.get('pageUrl')} (Pixabay Content License)")
        elif m["provider"] == "commons":
            lines.append(f"{kind}: {m.get('author')} / Wikimedia Commons {m.get('pageUrl')} ({m.get('license')})")
        else:
            lines.append(f"映像: {m.get('author')} (own footage)")
    if any((bt.get("clip") or {}).get("tts") for bt in b["beats"]):
        lines.append("英語音声: Kokoro-82M (Apache-2.0) による合成音声")
    v = b.get("voice", {})
    if v.get("engine") == "voicevox":
        lines.append(f"音声: VOICEVOX:{v.get('speaker', '青山龍星')}")
    mus = (b.get("music") or {}).get("asset")
    if mus:
        import render
        e = render.music_entry(mus) or {}
        lines.append(f"音楽: {e.get('author', mus)} ({e.get('license', 'see catalog')})")
    if any(lock[s].get("shareAlike") for s in used):
        lines.append("この動画の編集部分は、元素材と同じ CC BY-SA ライセンスで提供します。")
    return lines


def package(b: dict, tl: dict, lock: dict, out: pathlib.Path, samples: list, warnings: list[str]) -> dict:
    video = out / "video.mp4"
    rv = out / "review"
    rv.mkdir(exist_ok=True)
    # first frame (full + phone-size)
    first = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-frames:v", "1",
                            str(rv / "first-frame.png")], check=True)
    del first
    Image.open(rv / "first-frame.png").resize((360, 640)).save(rv / "first-frame-phone.png")
    # per-second sheet
    font = ImageFont.truetype(FONT, 20, index=0)
    cols = 6
    tw, th = 270, 480
    rows = (len(samples) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 30)), (12, 12, 14))
    d = ImageDraw.Draw(sheet)
    for i, (bid, t, fr) in enumerate(samples):
        x, y = (i % cols) * tw, (i // cols) * (th + 30)
        sheet.paste(Image.fromarray(fr).resize((tw, th)), (x, y))
        d.text((x + 6, y + th + 3), f"{t:4.1f}s {bid}", font=font, fill=(235, 235, 235))
    sheet.save(rv / "contact-sheet.jpg", quality=85)
    sheet.save(out / "contact-sheet.jpg", quality=85)
    # captions
    srt, k = [], 1
    for bt in tl["beats"]:
        for a, e, c in bt["captions"]:
            srt.append(f"{k}\n{_srt_time(a)} --> {_srt_time(e)}\n{c.rstrip('。、')}\n")
            k += 1
    (out / "captions.srt").write_text("\n".join(srt), encoding="utf-8")
    # description
    desc = [b["title"], "", *b.get("descriptionLines", []), "", "— クレジット —", *credits(b, lock)]
    (out / "description.txt").write_text("\n".join(desc) + "\n", encoding="utf-8")
    # timeline (without pcm)
    slim = {"total": tl["total"], "beats": [{k2: v for k2, v in bt.items() if k2 != "speech"} |
                                            {"speechSeconds": bt["speech"]["duration"]} for bt in tl["beats"]]}
    (out / "timeline.json").write_text(json.dumps(slim, ensure_ascii=False, indent=1), encoding="utf-8")
    loud = loudness(video)
    report = {
        "id": b["id"], "title": b["title"], "seconds": round(tl["total"], 2), "beats": len(tl["beats"]),
        "shots": sum(len(bt["shots"]) for bt in tl["beats"]),
        "avgShotSeconds": round(tl["total"] / max(1, sum(len(bt["shots"]) for bt in tl["beats"])), 2),
        "hookSeconds": round(tl["beats"][0]["duration"], 2),
        "loudness": loud, "warnings": warnings,
        "status": "technical_pass" if loud["integratedLUFS"] is not None else "technical_fail",
        "editorialStatus": b.get("status", "draft"),
        "note": "technical_pass is not an editorial pass. Watch the MP4 (silent / audio-only / phone size).",
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "metadata.json").write_text(json.dumps({"title": b["title"], "kind": "shorts-v3",
                                                   "seconds": report["seconds"], "status": report["status"]},
                                                  ensure_ascii=False), encoding="utf-8")
    card = ["# 編集審査シート: " + b["title"], "",
            f"- 約束(0秒): {b['promise']['firstFrame']}", f"- 回収: {b['promise']['payoff']}",
            f"- 尺: {report['seconds']}s / フック {report['hookSeconds']}s / 平均ショット {report['avgShotSeconds']}s", "",
            "各軸 1〜5。①〜④のどれかが3以下なら作り直し。自己採点の高得点だけで合格にしない。", "",
            "| 軸 | 基準 | 点 | 根拠（何秒の何が） |", "|---|---|---|---|"]
    card += [f"| {k3} | {desc3} |  |  |" for k3, desc3 in AXES]
    card += ["", "## 自動の注意点", *(f"- {x}" for x in warnings or ["(なし)"])]
    (rv / "scorecard.md").write_text("\n".join(card) + "\n", encoding="utf-8")
    return report


def motion_profile(video: pathlib.Path) -> list[float]:
    """Mean absolute frame difference per second: a crude 'is anything moving' signal."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", "fps=6,scale=108:192,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True, check=True)
    a = np.frombuffer(r.stdout, np.uint8).reshape(-1, 192, 108).astype(np.int16)
    diffs = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    return [round(float(diffs[i:i + 6].mean()), 2) for i in range(0, len(diffs), 6)]
