#!/usr/bin/env python3
"""Technical smoke test for tools/reference (CI-safe). Synthetic media only; never content.

Builds a 4s vertical clip whose red box eases down the screen and whose audio has a 0.6s
silence between two tones (reference) plus a variant with a 0.2s silence (candidate), then
checks that measure / track / compare report what was built.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOOL = pathlib.Path(__file__).resolve().parent / "reference.py"
D = ROOT / "outputs" / "reference-smoke"


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def make_clip(name: str, gap: float) -> pathlib.Path:
    path = D / name
    # red box, ease-out travel on y over 2s (t'=min(t/2,1); y=60+280*(1-(1-t')^2)), then holds
    # (drawbox's `t` means thickness, so the motion uses overlay, whose `t` is time)
    box_y = "60+280*(1-pow(1-min(t/2\\,1)\\,2))"
    video = (f"color=c=0x203040:s=270x480:r=30:d=4[bg];color=c=0xff2030:s=70x70:r=30:d=4[box];"
             f"[bg][box]overlay=x=100:y='{box_y}'")
    tone1 = "sine=frequency=440:duration=1.2"
    silence = f"anullsrc=r=44100:cl=mono:d={gap}"
    tone2 = f"sine=frequency=660:duration={2.8 - gap}"
    audio = D / f"{name}.wav"
    ff("-f", "lavfi", "-i", tone1, "-f", "lavfi", "-i", silence, "-f", "lavfi", "-i", tone2,
       "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", str(audio))
    ff("-filter_complex", video, "-i", str(audio), "-t", "4", "-pix_fmt", "yuv420p",
       "-c:v", "libx264", "-c:a", "aac", "-shortest", str(path))
    return path


def run(*args: str) -> None:
    r = subprocess.run([sys.executable, "-I", str(TOOL), *args], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"reference.py {' '.join(args)} failed:\n{r.stdout}\n{r.stderr}")


def check(cond: bool, msg: str) -> None:
    if not cond:
        sys.exit(f"FAIL: {msg}")
    print(f"ok: {msg}")


def main() -> None:
    D.mkdir(parents=True, exist_ok=True)
    ref, cand = make_clip("ref.mp4", 0.6), make_clip("cand.mp4", 0.2)

    run("measure", str(ref), "--out", str(D / "m"))
    rep = json.loads((D / "m" / "reference-report.json").read_text())
    check(rep["video"]["width"] == 270 and rep["video"]["height"] == 480, "measure reads the clip size")
    gaps = rep["speech"]["gaps"]
    check(len(gaps) == 1 and abs(gaps[0]["length"] - 0.6) < 0.15, f"measure finds the 0.6s speech gap ({gaps})")
    check((D / "m" / "contact-sheet.jpg").exists(), "measure writes a contact sheet")

    run("track", str(ref), "--color", "#ff2030", "--out", str(D / "t"))
    tr = json.loads((D / "t" / "track-ff2030.json").read_text())
    found = [p for p in tr["track"] if p["found"]]
    check(len(found) > 100, f"track follows the red box ({len(found)} frames)")
    check(found[-1]["center"][1] > found[0]["center"][1] + 200, "track sees the box travel down")
    check(tr["easingY"]["guess"] in ("ease-out-quad", "ease-out-cubic"), f"track guesses an ease-out ({tr['easingY']['guess']})")

    run("compare", str(ref), str(cand), "--out", str(D / "c"))
    cr = json.loads((D / "c" / "compare-report.json").read_text())
    check(0.9 < cr["similarity"]["mean"] <= 1.0, f"compare similarity is high for same visuals ({cr['similarity']['mean']})")
    ratio = cr["speechGaps"].get("medianGapRatio")
    check(ratio is not None and ratio < 0.6, f"compare sees the candidate's tighter speech gap (ratio {ratio})")
    check((D / "c" / "worst-frames.jpg").exists(), "compare writes the worst-frames sheet")
    print("reference tools smoke: PASS")


if __name__ == "__main__":
    main()
