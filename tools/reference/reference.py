#!/usr/bin/env python3
"""Reference-video replication helper ("見本を測って再現する").

A reference short is only *measured* here: frames, motion, cut points, speech gaps and part
positions are written to JSON/JPG so a production can be rebuilt from numbers instead of by eye.
Nothing from the reference is copied into an output; the reference is a ruler.

Subcommands
  measure  <video> [--out DIR] [--fps N]     frames, motion curve, cuts, speech gaps, contact sheet
  track    <video> --color '#RRGGBB' [...]   bounding box of one coloured part per frame + easing guess
  compare  <reference> <candidate> [--out DIR]  frame similarity, worst moments, speech-gap ratio

Dependencies: ffmpeg/ffprobe on PATH, numpy, Pillow.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import re
import statistics
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

ANALYSIS_W, ANALYSIS_H = 270, 480  # vertical Shorts analysis size; keeps 9:16 and runs fast


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path: pathlib.Path) -> dict:
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)])
    if r.returncode != 0:
        sys.exit(f"ffprobe failed for {path}: {r.stderr.strip()}")
    data = json.loads(r.stdout)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    if video is None:
        sys.exit(f"{path} has no video stream")
    num, den = (video.get("avg_frame_rate") or "30/1").split("/")
    fps = float(num) / float(den) if float(den) else 30.0
    return {
        "width": int(video["width"]), "height": int(video["height"]), "fps": round(fps, 3),
        "duration": float(data["format"].get("duration") or video.get("duration") or 0),
        "hasAudio": any(s["codec_type"] == "audio" for s in data["streams"]),
    }


def extract_frames(path: pathlib.Path, out_dir: pathlib.Path, fps: float, size=(ANALYSIS_W, ANALYSIS_H)) -> list[pathlib.Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("f_*.png"):
        old.unlink()
    vf = f"fps={fps},scale={size[0]}:{size[1]}:flags=bicubic"
    r = run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vf", vf, str(out_dir / "f_%05d.png")])
    if r.returncode != 0:
        sys.exit(f"ffmpeg frame extraction failed: {r.stderr.strip()}")
    return sorted(out_dir.glob("f_*.png"))


def load(frames: list[pathlib.Path]) -> np.ndarray:
    return np.stack([np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) for f in frames])


def speech_gaps(path: pathlib.Path, noise_db: float = -35.0, min_gap: float = 0.08) -> dict:
    """Silence intervals between speech. Leading/trailing silence is reported separately."""
    info = probe(path)
    if not info["hasAudio"]:
        return {"available": False}
    r = run(["ffmpeg", "-v", "info", "-i", str(path), "-vn", "-af",
             f"silencedetect=noise={noise_db}dB:d={min_gap}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    intervals = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else info["duration"]
        intervals.append((max(s, 0.0), e))
    inner = [(s, e) for s, e in intervals if s > 0.05 and e < info["duration"] - 0.05]
    gaps = [round(e - s, 3) for s, e in inner]
    return {
        "available": True, "noiseDb": noise_db, "minGap": min_gap,
        "gaps": [{"start": round(s, 3), "end": round(e, 3), "length": round(e - s, 3)} for s, e in inner],
        "medianGap": round(statistics.median(gaps), 3) if gaps else None,
        "meanGap": round(statistics.mean(gaps), 3) if gaps else None,
        "maxGap": max(gaps) if gaps else None,
        "gapCount": len(gaps),
    }


def contact_sheet(frames: list[pathlib.Path], fps: float, out: pathlib.Path, every: float = 0.5, cols: int = 8) -> None:
    step = max(int(round(fps * every)), 1)
    picks = list(range(0, len(frames), step))
    if not picks:
        return
    tw, th = 135, 240
    rows = math.ceil(len(picks) / cols)
    sheet = Image.new("RGB", (cols * tw, rows * (th + 14)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for n, idx in enumerate(picks):
        im = Image.open(frames[idx]).convert("RGB").resize((tw, th))
        x, y = (n % cols) * tw, (n // cols) * (th + 14)
        sheet.paste(im, (x, y + 14))
        draw.text((x + 3, y + 1), f"{idx / fps:.2f}s", fill=(255, 255, 255))
    sheet.save(out, quality=88)


def cmd_measure(a) -> None:
    video = pathlib.Path(a.video)
    out = pathlib.Path(a.out or f"outputs/reference/{video.stem}")
    out.mkdir(parents=True, exist_ok=True)
    info = probe(video)
    frames = extract_frames(video, out / "frames", a.fps)
    arr = load(frames)
    diffs = [0.0] + [float(np.abs(arr[i] - arr[i - 1]).mean()) for i in range(1, len(arr))]
    cut_threshold = max(a.cut_threshold, statistics.mean(diffs) + 3 * (statistics.pstdev(diffs) or 0))
    cuts = [round(i / a.fps, 3) for i, d in enumerate(diffs) if i > 0 and d >= cut_threshold]
    report = {
        "source": str(video), "video": info, "analysisFps": a.fps, "frameCount": len(frames),
        "motion": {"perFrame": [round(d, 3) for d in diffs], "cutThreshold": round(cut_threshold, 3)},
        "cuts": cuts,
        "speech": speech_gaps(video),
        "meanBrightnessFirstFrame": round(float(arr[0].mean()), 2),
    }
    (out / "reference-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    contact_sheet(frames, a.fps, out / "contact-sheet.jpg")
    sp = report["speech"]
    print(f"[measure] {video.name}: {info['width']}x{info['height']} {info['fps']}fps {info['duration']:.2f}s")
    print(f"[measure] {len(cuts)} cut(s) {cuts[:8]}")
    if sp.get("available"):
        print(f"[measure] speech gaps: {sp['gapCount']} (median {sp['medianGap']}s, max {sp['maxGap']}s)")
    print(f"[measure] wrote {out}/reference-report.json, contact-sheet.jpg, frames/")


def hex_to_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


EASINGS = {
    "linear": lambda t: t,
    "ease-in-quad": lambda t: t * t,
    "ease-out-quad": lambda t: 1 - (1 - t) ** 2,
    "ease-in-out-quad": lambda t: 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2,
    "ease-out-cubic": lambda t: 1 - (1 - t) ** 3,
    "ease-out-back": lambda t: 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
}


def guess_easing(series: list[float]) -> dict:
    """Fit a normalised 0..1 travel curve to common easings. Needs >=4 moving samples."""
    s = np.array(series, dtype=np.float64)
    if len(s) < 4 or abs(s[-1] - s[0]) < 1e-6:
        return {"guess": None, "reason": "not enough movement"}
    # keep only the moving span: drop the hold before the first move and after arrival
    eps = max(abs(s[-1] - s[0]) * 0.01, 0.5)
    moving = np.where(np.abs(np.diff(s)) > eps / 10)[0]
    if len(moving) < 3:
        return {"guess": None, "reason": "not enough movement"}
    s = s[moving[0]: moving[-1] + 2]
    span = s[-1] - s[0]
    if len(s) < 4 or abs(span) < 1e-6:
        return {"guess": None, "reason": "not enough movement"}
    prog = (s - s[0]) / span
    t = np.linspace(0, 1, len(s))
    errs = {name: float(np.mean((np.array([fn(x) for x in t]) - prog) ** 2)) for name, fn in EASINGS.items()}
    best = min(errs, key=errs.get)
    return {"guess": best, "mse": {k: round(v, 5) for k, v in errs.items()}, "normalisedProgress": [round(float(p), 4) for p in prog]}


def cmd_track(a) -> None:
    video = pathlib.Path(a.video)
    out = pathlib.Path(a.out or f"outputs/reference/{video.stem}")
    info = probe(video)
    frames = extract_frames(video, out / "frames-track", a.fps)
    arr = load(frames)
    target = hex_to_rgb(a.color)
    scale_x, scale_y = info["width"] / ANALYSIS_W, info["height"] / ANALYSIS_H
    track = []
    for i in range(len(arr)):
        mask = np.linalg.norm(arr[i] - target, axis=2) <= a.tolerance
        ys, xs = np.where(mask)
        if len(xs) < a.min_pixels:
            track.append({"t": round(i / a.fps, 3), "found": False})
            continue
        track.append({
            "t": round(i / a.fps, 3), "found": True, "pixels": int(len(xs)),
            "bbox": [round(float(xs.min()) * scale_x), round(float(ys.min()) * scale_y),
                     round(float(xs.max() + 1) * scale_x), round(float(ys.max() + 1) * scale_y)],
            "center": [round(float(xs.mean()) * scale_x), round(float(ys.mean()) * scale_y)],
        })
    found = [p for p in track if p["found"]]
    result = {"color": a.color, "tolerance": a.tolerance, "analysisFps": a.fps, "coordinateSpace": f"{info['width']}x{info['height']}",
              "visibleFrames": len(found), "totalFrames": len(track), "firstSeen": found[0]["t"] if found else None,
              "lastSeen": found[-1]["t"] if found else None, "track": track}
    if len(found) >= 4:
        result["easingY"] = guess_easing([p["center"][1] for p in found])
        result["easingX"] = guess_easing([p["center"][0] for p in found])
    dest = out / f"track-{a.color.lstrip('#').lower()}.json"
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[track] {a.color}: visible {len(found)}/{len(track)} frames, first {result['firstSeen']}s, last {result['lastSeen']}s")
    if "easingY" in result:
        print(f"[track] easing guess  x={result['easingX']['guess']}  y={result['easingY']['guess']}")
    print(f"[track] wrote {dest}")


def cmd_compare(a) -> None:
    ref, cand = pathlib.Path(a.reference), pathlib.Path(a.candidate)
    out = pathlib.Path(a.out or f"outputs/reference/compare-{cand.stem}")
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        fr = extract_frames(ref, pathlib.Path(tmp) / "ref", a.fps)
        fc = extract_frames(cand, pathlib.Path(tmp) / "cand", a.fps)
        n = min(len(fr), len(fc))
        if n == 0:
            sys.exit("no frames to compare")
        ra, ca = load(fr[:n]), load(fc[:n])
        # mean absolute error per frame, 0 (identical) .. 255 ; similarity = 1 - mae/255
        mae = np.abs(ra - ca).mean(axis=(1, 2, 3))
        sim = 1.0 - mae / 255.0
        worst = np.argsort(sim)[: a.worst]
        report = {
            "reference": str(ref), "candidate": str(cand), "analysisFps": a.fps, "comparedFrames": int(n),
            "durationDeltaSec": round(len(fc) / a.fps - len(fr) / a.fps, 3),
            "similarity": {"mean": round(float(sim.mean()), 4), "min": round(float(sim.min()), 4),
                           "perSecondMean": [round(float(sim[i:i + int(a.fps)].mean()), 4) for i in range(0, n, int(a.fps))]},
            "worstFrames": [{"t": round(int(i) / a.fps, 3), "similarity": round(float(sim[i]), 4)} for i in sorted(worst)],
        }
        # Side-by-side sheet of worst frames: reference | candidate | abs diff
        tw, th = 135, 240
        sheet = Image.new("RGB", (tw * 3, (th + 14) * len(worst)), (24, 24, 24))
        d = ImageDraw.Draw(sheet)
        for row, i in enumerate(sorted(worst)):
            y = row * (th + 14)
            d.text((3, y + 1), f"{i / a.fps:.2f}s  ref | cand | diff  sim={sim[i]:.3f}", fill=(255, 255, 255))
            diff = np.clip(np.abs(ra[i] - ca[i]) * 3, 0, 255).astype(np.uint8)
            for col, img in enumerate([ra[i].astype(np.uint8), ca[i].astype(np.uint8), diff]):
                sheet.paste(Image.fromarray(img).resize((tw, th)), (col * tw, y + 14))
        sheet.save(out / "worst-frames.jpg", quality=88)
    sr, sc = speech_gaps(ref), speech_gaps(cand)
    gap = {"reference": sr, "candidate": sc}
    if sr.get("available") and sc.get("available") and sr.get("medianGap") and sc.get("medianGap"):
        ratio = sc["medianGap"] / sr["medianGap"]
        gap["medianGapRatio"] = round(ratio, 3)
        gap["verdict"] = "tighter than reference" if ratio < 0.85 else "looser than reference" if ratio > 1.15 else "close to reference"
    report["speechGaps"] = gap
    (out / "compare-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [f"# 見本との比較: {cand.name}", "",
             f"- 比較コマ数: {n}（{a.fps}fps）／長さの差: {report['durationDeltaSec']}秒",
             f"- 見た目の近さ（1.0 が完全一致）: 平均 {report['similarity']['mean']} / 最小 {report['similarity']['min']}",
             "- 差が大きい瞬間（worst-frames.jpg に 見本｜出来上がり｜差分 で並べた）:"]
    lines += [f"  - {w['t']}秒: {w['similarity']}" for w in report["worstFrames"]]
    if "medianGapRatio" in gap:
        lines += ["", f"- 声の間（中央値）: 見本 {sr['medianGap']}秒 / 出来上がり {sc['medianGap']}秒（比 {gap['medianGapRatio']}、{gap['verdict']}）"]
    lines += ["", "> 数値は「近づいたか」の目安です。見た目と声のテンポの最終判断は、実際に見て聞いた人が行います（technical ≠ editorial）。"]
    (out / "compare.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"[compare] wrote {out}/compare-report.json, compare.md, worst-frames.jpg")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("measure", help="frames, motion, cuts, speech gaps, contact sheet")
    m.add_argument("video")
    m.add_argument("--out")
    m.add_argument("--fps", type=float, default=10.0)
    m.add_argument("--cut-threshold", type=float, default=18.0)
    m.set_defaults(fn=cmd_measure)
    t = sub.add_parser("track", help="track one coloured part (bounding box per frame) and guess its easing")
    t.add_argument("video")
    t.add_argument("--color", required=True, help="part colour, e.g. '#ff3366'")
    t.add_argument("--tolerance", type=float, default=40.0, help="RGB distance counted as the same colour")
    t.add_argument("--min-pixels", type=int, default=12)
    t.add_argument("--out")
    t.add_argument("--fps", type=float, default=30.0)
    t.set_defaults(fn=cmd_track)
    c = sub.add_parser("compare", help="compare a candidate render against the reference")
    c.add_argument("reference")
    c.add_argument("candidate")
    c.add_argument("--out")
    c.add_argument("--fps", type=float, default=10.0)
    c.add_argument("--worst", type=int, default=6)
    c.set_defaults(fn=cmd_compare)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
