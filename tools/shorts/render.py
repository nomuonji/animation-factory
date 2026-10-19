"""Shorts v3 renderer: brief + locked footage -> native-looking vertical Short.

Look: full-bleed real footage (or blurred-fill for landscape sources that must stay
whole), big centered captions synced to the voice, optional headline on the hook,
hard cuts, slow push-ins. Audio: VOICEVOX narration, music ducked under the voice,
sparse motivated SFX, loudness -14 LUFS for Shorts.
"""
from __future__ import annotations

import json
import math
import pathlib
import subprocess
import time
import wave

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import brief as B
import footage
import voice as V

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs" / "shorts"
W, H, FPS = 1080, 1920, 30
RATE = V.RATE
FONT_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
EMPH = (255, 225, 77)
WHITE = (255, 255, 255)
# YouTube Shorts UI covers the bottom ~22% and a right-hand column; keep text inside.
SAFE_LEFT, SAFE_RIGHT = 70, 950
CAPTION_Y = 0.635
HEADLINE_Y = 0.15


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=0)
    except OSError:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)


# ---------------------------------------------------------------- timeline

def build_timeline(b: dict, lock: dict | None) -> dict:
    vcfg = b.get("voice", {"engine": "none"})
    beats, t = [], 0.0
    for i, bt in enumerate(b["beats"]):
        chunks = B.caption_chunks(bt)
        text = B.spoken_text(bt)
        if text and vcfg.get("engine") == "voicevox":
            sp = V.synthesize(text, chunks, vcfg)
        elif text:
            sp = V.silent(chunks)
        else:
            sp = {"duration": 0.0, "chunks": [], "moras": 0, "pcm": np.zeros(0, np.float32)}
        lead = 0.0 if i == 0 else float(bt.get("lead", 0.06))
        hold = float(bt.get("hold", 0.22))
        dur = max(float(bt.get("min", 0)), lead + sp["duration"] + hold)
        dur = round(dur * FPS) / FPS
        shots = bt["shots"]
        weights = [float(s.get("weight", 1)) for s in shots]
        tw = sum(weights)
        sh_out, st = [], t
        for k, (s, wgt) in enumerate(zip(shots, weights)):
            d = dur * wgt / tw if k < len(shots) - 1 else (t + dur - st)
            d = round(d * FPS) / FPS
            need = d * float(s.get("speed", 1)) + float(s.get("in", 0))
            if lock is not None:
                meta = lock.get(s["src"])
                if not meta:
                    raise B.BriefError(f"{bt['id']}: {s['src']} not in sources.lock.json")
                if meta.get("duration") and need > meta["duration"] + 0.05 and not s.get("freeze"):
                    raise B.BriefError(
                        f"{bt['id']}: shot needs footage until {need:.2f}s but {s['src']} is "
                        f"{meta['duration']:.2f}s. Lower `in`, add a shot or set speed.")
            sh_out.append({**s, "start": st, "duration": d})
            st += d
        caps = [[t + lead + a, t + lead + bnd, c] for a, bnd, c in sp["chunks"]]
        if caps:
            caps[-1][1] = t + dur  # keep last caption until the cut
        beats.append({"id": bt["id"], "role": bt["role"], "start": t, "duration": dur, "lead": lead,
                      "speech": sp, "captions": caps, "shots": sh_out, "sfx": bt.get("sfx", "none"),
                      "overlay": bt.get("overlay"), "emphasis": bt.get("emphasis", []),
                      "moraRate": (sp["moras"] / sp["duration"]) if sp["duration"] else 0})
        t += dur
    return {"beats": beats, "total": t}


# ---------------------------------------------------------------- text overlays

class TextCache:
    def __init__(self):
        self.cache: dict = {}

    def caption(self, text: str, emphasis: list[str]) -> np.ndarray:
        key = ("c", text, tuple(emphasis))
        if key not in self.cache:
            self.cache[key] = _render_caption(B.display_text(text), emphasis)
        return self.cache[key]

    def headline(self, text: str) -> np.ndarray:
        key = ("h", text)
        if key not in self.cache:
            self.cache[key] = _render_headline(text)
        return self.cache[key]

    def label(self, text: str) -> np.ndarray:
        key = ("l", text)
        if key not in self.cache:
            font = _font(FONT_BOLD, 40)
            probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
            w = int(probe.textlength(text, font=font)) + 36
            img = Image.new("RGBA", (W, 72), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((SAFE_LEFT - 18, 4, SAFE_LEFT - 18 + w, 68), radius=12, fill=(0, 0, 0, 150))
            d.text((SAFE_LEFT, 10), text, font=font, fill=(255, 255, 255))
            self.cache[key] = np.array(img)
        return self.cache[key]

    def title(self, text: str) -> np.ndarray:
        key = ("t", text)
        if key not in self.cache:
            self.cache[key] = _render_title(text)
        return self.cache[key]


def _wrap(text: str, font, maxw: int, draw) -> list[str]:
    if draw.textlength(text, font=font) <= maxw:
        return [text]
    # Split near the middle at a natural phrase boundary. Never inside a katakana,
    # kanji or latin run; prefer right after a particle or punctuation.
    best, bestscore = 1, 1e9
    particles = set("はがをにへでとものもやねよか、」）")
    for i in range(1, len(text)):
        prev, nxt = text[i - 1], text[i]
        a, b = text[:i], text[i:]
        la, lb = draw.textlength(a, font=font), draw.textlength(b, font=font)
        score = abs(la - lb)
        if _script(prev) == _script(nxt) and _script(prev) in ("kata", "kanji", "latin"):
            score += 2000
        if nxt in "ーぁぃぅぇぉっゃゅょァィゥェォッャュョ、。！？」）":
            score += 2000
        if prev in particles and _script(nxt) != "hira":
            score -= 0
        elif prev in particles:
            score += 60
        elif _script(prev) == "hira" and _script(nxt) == "hira":
            score += 500
        else:
            score += 160
        if max(la, lb) > maxw:
            score += 900
        if score < bestscore:
            best, bestscore = i, score
    return [text[:best], text[best:]]


def _script(ch: str) -> str:
    o = ord(ch)
    if 0x3040 <= o <= 0x309F:
        return "hira"
    if 0x30A0 <= o <= 0x30FF:
        return "kata"
    if 0x4E00 <= o <= 0x9FFF or ch in "々〆":
        return "kanji"
    if ch.isascii() and ch.isalnum():
        return "latin"
    return "other"


def _rich_line(draw, x, y, line, font, emphasis, stroke):
    # Draw with emphasis words coloured. Character-by-character colouring keeps kerning ok.
    spans = [(0, len(line), WHITE)]
    marks = [False] * len(line)
    for e in emphasis:
        if not e:
            continue
        start = line.find(e)
        while start >= 0:
            for k in range(start, start + len(e)):
                marks[k] = True
            start = line.find(e, start + 1)
    cx = x
    i = 0
    while i < len(line):
        j = i
        while j < len(line) and marks[j] == marks[i]:
            j += 1
        seg = line[i:j]
        draw.text((cx, y), seg, font=font, fill=EMPH if marks[i] else WHITE,
                  stroke_width=stroke, stroke_fill=(0, 0, 0))
        cx += draw.textlength(seg, font=font)
        i = j
    del spans


def _render_caption(text: str, emphasis: list[str]) -> np.ndarray:
    size = 96 if len(text) <= 7 else 84 if len(text) <= 11 else 74
    font = _font(FONT_BLACK, size)
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    lines = _wrap(text, font, SAFE_RIGHT - SAFE_LEFT, probe)
    stroke = max(8, size // 9)
    lh = int(size * 1.22)
    hgt = lh * len(lines) + stroke * 2 + 20
    img = Image.new("RGBA", (W, hgt), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for k, line in enumerate(lines):
        lw = d.textlength(line, font=font)
        x = (SAFE_LEFT + SAFE_RIGHT) / 2 - lw / 2
        _rich_line(d, x, stroke + 6 + k * lh, line, font, emphasis, stroke)
    return np.array(img)


def _render_headline(text: str) -> np.ndarray:
    lines = text.split("\n")
    size = 104 if max(len(x) for x in lines) <= 8 else 88
    font = _font(FONT_BLACK, size)
    lh = int(size * 1.2)
    pad = 26
    img = Image.new("RGBA", (W, lh * len(lines) + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for k, line in enumerate(lines):
        lw = d.textlength(line, font=font)
        x = (SAFE_LEFT + SAFE_RIGHT) / 2 - lw / 2
        y = pad + k * lh
        d.rounded_rectangle((x - 22, y + 4, x + lw + 22, y + lh + 6), radius=14, fill=(230, 32, 46, 235))
        d.text((x, y), line, font=font, fill=WHITE, stroke_width=4, stroke_fill=(90, 0, 10))
    return np.array(img)


def _render_title(text: str) -> np.ndarray:
    font = _font(FONT_BOLD, 52)
    img = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = d.textlength(text, font=font)
    x = (SAFE_LEFT + SAFE_RIGHT) / 2 - lw / 2
    d.text((x, 18), text, font=font, fill=WHITE, stroke_width=6, stroke_fill=(0, 0, 0))
    return np.array(img)


def _blend(frame: np.ndarray, ov: np.ndarray, y: int, scale: float = 1.0) -> None:
    if scale != 1.0:
        h0, w0 = ov.shape[:2]
        ov = cv2.resize(ov, (max(1, int(w0 * scale)), max(1, int(h0 * scale))), interpolation=cv2.INTER_AREA)
        x = (W - ov.shape[1]) // 2
        y = y + (h0 - ov.shape[0]) // 2
    else:
        x = 0
    h, w = ov.shape[:2]
    y0, y1 = max(0, y), min(H, y + h)
    x0, x1 = max(0, x), min(W, x + w)
    if y1 <= y0 or x1 <= x0:
        return
    o = ov[y0 - y:y1 - y, x0 - x:x1 - x]
    a = o[..., 3:4].astype(np.float32) / 255.0
    region = frame[y0:y1, x0:x1]
    region[:] = (o[..., :3] * a + region * (1 - a)).astype(np.uint8)


# ---------------------------------------------------------------- footage decode

def _segment_frames(path: pathlib.Path, start: float, n: int, speed: float, freeze: bool):
    """Yield n RGB frames (source resolution) starting at `start`, at FPS, time-scaled."""
    src_len = n / FPS * speed + 0.5
    vf = f"setpts=PTS/{speed},fps={FPS}" if speed != 1 else f"fps={FPS}"
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height:stream_side_data=rotation", "-of", "json", str(path)],
                           capture_output=True, text=True, check=True)
    st = json.loads(probe.stdout)["streams"][0]
    sw, sh = st["width"], st["height"]
    # cap decode size for speed
    scale = min(1.0, 2200 / max(sw, sh))
    dw, dh = int(sw * scale) // 2 * 2, int(sh * scale) // 2 * 2
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{src_len:.3f}", "-i", str(path),
           "-an", "-vf", f"{vf},scale={dw}:{dh}:flags=bicubic", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    size = dw * dh * 3
    last = None
    got = 0
    while got < n:
        raw = p.stdout.read(size)
        if len(raw) < size:
            break
        last = np.frombuffer(raw, np.uint8).reshape(dh, dw, 3)
        got += 1
        yield last
    p.stdout.close()
    p.kill()
    p.wait()
    if got < n:
        if last is None:
            raise RuntimeError(f"No frames decoded from {path} at {start}s")
        if not freeze and n - got > 3:
            print(f"WARN: footage ran out {n - got} frames early at {path.name}; holding last frame", flush=True)
        for _ in range(n - got):
            yield last


def _fill(src: np.ndarray, focus, zoom: float) -> np.ndarray:
    sh, sw = src.shape[:2]
    base = max(W / sw, H / sh) * zoom
    cw, ch = W / base, H / base
    fx, fy = focus
    x0 = (sw - cw) * fx
    y0 = (sh - ch) * fy
    m = np.float32([[base, 0, -x0 * base], [0, base, -y0 * base]])
    return cv2.warpAffine(src, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def _fit(src: np.ndarray, focus, zoom: float, bg_cache: dict) -> np.ndarray:
    sh, sw = src.shape[:2]
    small = cv2.resize(src, (max(1, sw // 8), max(1, sh // 8)), interpolation=cv2.INTER_AREA)
    bg = _fill(cv2.GaussianBlur(small, (0, 0), 6), (0.5, 0.5), 1.0)
    bg = (bg * 0.45).astype(np.uint8)
    s = W / sw * zoom
    fw, fh = int(sw * s), int(sh * s)
    fg = cv2.resize(src, (fw, fh), interpolation=cv2.INTER_LINEAR)
    x = (W - fw) // 2 - int((focus[0] - 0.5) * (fw - W)) if fw > W else (W - fw) // 2
    y = int(H * 0.40 - fh / 2)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + fw), min(H, y + fh)
    bg[y0:y1, x0:x1] = fg[y0 - y:y1 - y, x0 - x:x1 - x]
    return bg


# ---------------------------------------------------------------- audio

def _decode_audio(path: pathlib.Path) -> np.ndarray:
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE),
                        "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()


def _sfx(kind: str) -> np.ndarray:
    t = np.arange(int(0.45 * RATE)) / RATE
    rng = np.random.default_rng(7)
    if kind == "whoosh":
        n = rng.standard_normal(len(t)).astype(np.float32)
        # band-pass sweep via cumulative one-pole filters
        env = np.sin(np.pi * np.clip(t / 0.42, 0, 1)) ** 2
        out = np.zeros_like(n)
        y = 0.0
        for i in range(len(n)):
            a = 0.02 + 0.25 * (i / len(n))
            y += a * (n[i] - y)
            out[i] = y
        return (out * env * 0.9).astype(np.float32)
    if kind == "thunder":
        tt = np.arange(int(2.6 * RATE)) / RATE
        n = rng.standard_normal(len(tt)).astype(np.float32)
        brown = np.cumsum(n)
        brown -= np.convolve(brown, np.ones(2400) / 2400, mode="same")
        brown /= (np.max(np.abs(brown)) or 1)
        crack = np.exp(-tt * 9) * rng.standard_normal(len(tt)) * 0.35
        roll = (0.6 + 0.4 * np.sin(2 * np.pi * 1.7 * tt)) * np.exp(-tt * 1.3)
        return ((brown * roll + crack) * 0.8).astype(np.float32)
    if kind == "rise":
        f = 220 + 660 * (t / t[-1]) ** 2
        return (0.18 * np.sin(2 * np.pi * np.cumsum(f) / RATE) * (t / t[-1])).astype(np.float32)
    files = {"hit": "assets/kenney/impact-sounds/Audio/impactWood_heavy_002.ogg",
             "pop": "assets/kenney/interface-sounds/Audio/switch_004.ogg" if (ROOT / "assets/kenney/interface-sounds/Audio/switch_004.ogg").exists() else "assets/kenney/interface-sounds/Audio/maximize_003.ogg",
             "tick": "assets/kenney/interface-sounds/Audio/click_001.ogg"}
    if kind in files and (ROOT / files[kind]).exists():
        return _decode_audio(ROOT / files[kind]) * 0.8
    return np.zeros(1, np.float32)


def music_entry(asset: str) -> dict | None:
    lib = json.loads((ROOT / "catalog" / "asset-library.json").read_text())
    for entry in _walk(lib):
        if entry.get("id") == asset and entry.get("path"):
            return entry
    return None


def _music_path(asset: str) -> pathlib.Path | None:
    if not asset:
        return None
    entry = music_entry(asset)
    if entry:
        return ROOT / entry["path"]
    p = ROOT / "assets" / "music" / asset
    for cand in (p, p.with_suffix(".ogg"), p.with_suffix(".mp3")):
        if cand.exists():
            return cand
    raise RuntimeError(f"music asset not found: {asset}")


def _walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)


def build_audio(b: dict, tl: dict, out: pathlib.Path) -> pathlib.Path:
    n = int((tl["total"] + 0.05) * RATE)
    voice_bus = np.zeros(n, np.float32)
    fx_bus = np.zeros(n, np.float32)
    for bt in tl["beats"]:
        pcm = bt["speech"]["pcm"]
        s = int((bt["start"] + bt["lead"]) * RATE)
        seg = voice_bus[s:s + len(pcm)]
        seg += pcm[:len(seg)]
        if bt["sfx"] != "none":
            fx = _sfx(bt["sfx"])
            s2 = max(0, int(bt["start"] * RATE) - (int(0.12 * RATE) if bt["sfx"] == "whoosh" else 0))
            seg2 = fx_bus[s2:s2 + len(fx)]
            seg2 += fx[:len(seg2)] * 0.45
    music = np.zeros(n, np.float32)
    mcfg = b.get("music") or {}
    mpath = _music_path(mcfg.get("asset")) if mcfg.get("asset") else None
    if mpath:
        m = _decode_audio(mpath)
        reps = math.ceil(n / max(1, len(m)))
        m = np.tile(m, reps)[:n]
        peak = np.max(np.abs(m)) or 1
        music = m / peak * float(mcfg.get("gain", 0.16))
        # Duck under voice: envelope follower on the voice bus.
        env = np.abs(voice_bus)
        k = int(0.08 * RATE)
        env = np.convolve(env, np.ones(k) / k, mode="same")
        duck = 1.0 - np.clip(env * 9, 0, 1) * (1 - float(mcfg.get("duck", 0.35)))
        k2 = int(0.25 * RATE)
        duck = np.convolve(duck, np.ones(k2) / k2, mode="same")
        music *= duck.astype(np.float32)
        fade = int(0.6 * RATE)
        music[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    mix = voice_bus + music + fx_bus
    mix = np.clip(mix, -0.98, 0.98)
    raw = out / "mix-raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((mix * 32767).astype("<i2").tobytes())
    return raw


def _loudnorm_filter(wav: pathlib.Path, target: float = -14.0) -> str:
    """Two-pass loudnorm: measure, then apply linear gain to hit Shorts loudness."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                        f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    return (f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")


# ---------------------------------------------------------------- main render

def render(brief_path: str, lock: dict, quick: bool = False) -> dict:
    b = B.load(brief_path)
    out = OUT / b["id"]
    out.mkdir(parents=True, exist_ok=True)
    tl = build_timeline(b, lock)
    warnings = B.lint(b, tl)
    look = b.get("look", {})
    frame_mode = look.get("frame", "fill")
    texts = TextCache()
    silent = out / "silent.mp4"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                            "-preset", "veryfast" if quick else "medium", "-crf", "20",
                            "-pix_fmt", "yuv420p", str(silent)], stdin=subprocess.PIPE)
    samples: list[tuple[str, float, np.ndarray]] = []
    sample_times = {round(x * FPS) for x in np.arange(0, tl["total"], 1.0)}
    fi = 0
    t0 = time.time()
    for bt in tl["beats"]:
        for sh in bt["shots"]:
            n = round(sh["duration"] * FPS)
            path = footage.fetch(sh["src"], lock)
            z0, z1 = sh.get("zoom", [1.0, 1.06])
            focus = sh.get("focus", [0.5, 0.5])
            mode = sh.get("frame", frame_mode)
            for k, src in enumerate(_segment_frames(path, float(sh.get("in", 0)), n,
                                                    float(sh.get("speed", 1)), bool(sh.get("freeze")))):
                p = k / max(1, n - 1)
                ease = p * p * (3 - 2 * p)
                zoom = z0 + (z1 - z0) * ease
                frame = _fill(src, focus, zoom) if mode == "fill" else _fit(src, focus, zoom, {})
                frame = np.ascontiguousarray(frame)
                t = fi / FPS
                # captions
                for a, e, c in bt["captions"]:
                    if a <= t < e:
                        ov = texts.caption(c, bt["emphasis"])
                        age = t - a
                        scale = 1.0 if age > 0.1 else 0.86 + 1.4 * age
                        _blend(frame, ov, int(H * CAPTION_Y - ov.shape[0] / 2), scale)
                        break
                if bt.get("overlay"):
                    ov = texts.headline(bt["overlay"])
                    _blend(frame, ov, int(H * HEADLINE_Y))
                if sh.get("label"):
                    _blend(frame, texts.label(sh["label"]), 150)
                if look.get("titleBar"):
                    _blend(frame, texts.title(look["titleBar"]), 40)
                enc.stdin.write(frame.tobytes())
                if fi in sample_times or fi == 0:
                    samples.append((bt["id"], t, frame[::4, ::4].copy()))
                fi += 1
        print(f"beat {bt['id']}: {bt['duration']:.2f}s ({time.time() - t0:.0f}s elapsed)", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError("encoder failed")
    raw = build_audio(b, tl, out)
    final = out / "video.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(raw),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                    "-af", _loudnorm_filter(raw), "-t", f"{tl['total']:.3f}",
                    "-movflags", "+faststart", str(final)], check=True)
    silent.unlink(missing_ok=True)
    import review
    report = review.package(b, tl, lock, out, samples, warnings)
    return report
