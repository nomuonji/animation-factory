"""Footage search (Pixabay video API + Wikimedia Commons) and source locking.

find  -> productions/<id>/candidates.json (+ contact sheet) from each beat's `search` queries
lock  -> productions/<id>/sources.lock.json for every src referenced by shots
fetch -> local cached file verified against the lock's sha256

Licensing notes kept with each locked source:
- Pixabay Content License: free commercial use, no attribution required. Do not sell
  unaltered copies, do not imply endorsement by people/brands shown, no standalone
  redistribution. We still credit the author in the description.
- Commons: only licenses in COMMONS_ALLOWED. CC BY-SA requires the edited video to
  be shared under the same license; the lock marks it so the description says so.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import re
import time
import urllib.parse
import urllib.request

UA = "AnimationFactory-ShortsV3/1.0 (https://github.com/nomuonji/animation-factory)"
ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "outputs" / "shorts-sources"
MAX_BYTES = 250_000_000
COMMONS_ALLOWED = {
    "CC0": "CC0", "Public domain": "PD", "PD": "PD",
    "CC BY 4.0": "CC BY 4.0", "CC BY 3.0": "CC BY 3.0", "CC BY 2.5": "CC BY 2.5", "CC BY 2.0": "CC BY 2.0",
    "CC BY-SA 4.0": "CC BY-SA 4.0", "CC BY-SA 3.0": "CC BY-SA 3.0", "CC BY-SA 2.0": "CC BY-SA 2.0",
}
PIXABAY_LICENSE = {
    "license": "Pixabay Content License",
    "licenseUrl": "https://pixabay.com/service/license-summary/",
    "restrictions": [
        "Do not sell or distribute unaltered copies",
        "Do not imply endorsement by identifiable people, brands or trademarks shown",
    ],
}


def _get(url: str, timeout: int = 40, limit: int = MAX_BYTES) -> bytes:
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read(limit + 1)
            if len(data) > limit:
                raise RuntimeError("download too large: " + url)
            return data
        except Exception as ex:  # noqa: BLE001 - retry any transient failure
            last = ex
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


def _json(url: str) -> dict:
    return json.loads(_get(url, limit=20_000_000))


# ---------------------------------------------------------------- search

def pixabay_search(query: str, per_page: int = 12) -> list[dict]:
    kind, query = _split_kind(query)
    if kind != "video":
        return []
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        return []
    q = urllib.parse.urlencode({"key": key, "q": query[:100], "per_page": per_page, "safesearch": "true"})
    data = _json("https://pixabay.com/api/videos/?" + q)
    out = []
    for h in data.get("hits", []):
        v = h.get("videos", {})
        best = _pick_pixabay_rendition(v)
        if not best:
            continue
        out.append({
            "src": f"pixabay:{h['id']}",
            "provider": "pixabay",
            "query": query,
            "pageUrl": h.get("pageURL"),
            "tags": h.get("tags"),
            "duration": h.get("duration"),
            "author": h.get("user"),
            "width": best["width"], "height": best["height"],
            "downloadUrl": best["url"],
            "thumbnail": best.get("thumbnail") or v.get("tiny", {}).get("thumbnail"),
            "views": h.get("views"), "downloads": h.get("downloads"),
            **PIXABAY_LICENSE,
        })
    return out


def _pick_pixabay_rendition(v: dict) -> dict | None:
    # Prefer >=1080 tall (portrait) or 1920 wide; avoid huge 4K files.
    for name in ("large", "medium", "small"):
        r = v.get(name) or {}
        if r.get("url") and r.get("size", 0) <= MAX_BYTES and r.get("width"):
            if name == "large" and max(r["width"], r["height"]) > 2600 and v.get("medium", {}).get("url"):
                continue
            return r
    return None


COMMONS_KINDS = {"video": "video", "image": "bitmap", "audio": "audio"}


def _split_kind(query: str) -> tuple[str, str]:
    """`image: apollo 13` / `audio: apollo 13` pick the Commons file type; default video."""
    m = re.match(r"^(video|image|audio):\s*(.+)$", query.strip())
    return (m.group(1), m.group(2)) if m else ("video", query)


def commons_search(query: str, limit: int = 10) -> list[dict]:
    kind, text = _split_kind(query)
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"{text} filetype:{COMMONS_KINDS[kind]}", "gsrnamespace": 6, "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata|mediatype|sha1",
        "iiurlwidth": 320,
    })
    data = _json("https://commons.wikimedia.org/w/api.php?" + q)
    out = []
    for page in (data.get("query", {}).get("pages", {}) or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName", {}) or {}).get("value", "")
        norm = _commons_license(lic)
        if not norm:
            continue
        title = page["title"].removeprefix("File:")
        out.append({
            "src": f"commons:{title}",
            "provider": "commons",
            "kind": kind,
            "query": query,
            "pageUrl": info.get("descriptionurl"),
            "duration": info.get("duration"),
            "author": _strip_html((meta.get("Artist", {}) or {}).get("value", "")),
            "width": info.get("width"), "height": info.get("height"),
            "downloadUrl": info.get("url"),
            "thumbnail": info.get("thumburl"),
            "license": norm,
            "licenseUrl": (meta.get("LicenseUrl", {}) or {}).get("value"),
            "shareAlike": "SA" in norm,
            "restrictions": ["Share edited video under the same license"] if "SA" in norm else [],
        })
    return out


def _commons_license(s: str) -> str | None:
    s = s.strip()
    for k, v in COMMONS_ALLOWED.items():
        if s == k or s.lower() == k.lower():
            return v
    if s.lower().startswith("public domain") or s.lower() in {"pd-self", "pd-usgov", "pd-old"}:
        return "PD"
    return None


def _strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()[:200]


def find(brief: dict) -> dict:
    d = pathlib.Path(brief["_dir"])
    queries: list[str] = []
    for bt in brief["beats"]:
        for q in bt.get("search", []):
            if q not in queries:
                queries.append(q)
    for q in brief.get("search", []):
        if q not in queries:
            queries.append(q)
    if not queries:
        raise RuntimeError("No `search` queries in brief beats; add English keywords per beat.")
    results = {"pixabayEnabled": bool(os.environ.get("PIXABAY_API_KEY")), "queries": {}}
    for q in queries:
        found = []
        for fn in (pixabay_search, commons_search):
            try:
                found.extend(fn(q))
            except Exception as ex:  # noqa: BLE001 - keep searching other providers
                found.append({"error": f"{fn.__name__}: {ex}", "query": q})
        results["queries"][q] = found
        time.sleep(0.4)
    (d / "candidates.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    _contact_sheet(results, d / "candidates.jpg")
    return results


def _contact_sheet(results: dict, out: pathlib.Path) -> None:
    from PIL import Image, ImageDraw, ImageFont
    items = [c for lst in results["queries"].values() for c in lst if c.get("thumbnail")]
    if not items:
        return
    cols, tw, th = 6, 320, 200
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 46)), (16, 18, 22))
    try:
        f = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 15)
    except OSError:
        f = ImageFont.load_default()
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(items):
        x, y = (i % cols) * tw, (i // cols) * (th + 46)
        try:
            im = Image.open(io.BytesIO(_get(c["thumbnail"], timeout=20, limit=5_000_000))).convert("RGB")
            im.thumbnail((tw, th))
            sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
        except Exception:  # noqa: BLE001 - a missing thumbnail must not stop the sheet
            d.text((x + 8, y + 8), "no thumb", fill=(200, 80, 80), font=f)
        d.text((x + 4, y + th + 2), f"{c['src'][:40]}", fill=(240, 240, 240), font=f)
        d.text((x + 4, y + th + 22), f"{c.get('duration')}s {c.get('width')}x{c.get('height')} {c['query'][:18]}",
               fill=(150, 160, 170), font=f)
    sheet.save(out, quality=82)


# ---------------------------------------------------------------- lock / fetch

def _candidate_index(d: pathlib.Path) -> dict:
    """Known source metadata from search results and inspection runs (no network)."""
    idx: dict = {}
    for p in (ROOT / "outputs" / "scout" / "candidates.json", d / "candidates.json"):
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            idx.update({c["src"]: c for lst in data["queries"].values() for c in lst if c.get("src")})
    p = ROOT / "outputs" / "inspect" / "inspect.json"
    if p.exists():
        for c in json.loads(p.read_text(encoding="utf-8")):
            if c.get("src") and not c.get("error"):
                idx[c["src"]] = c
    return idx


def _resolve(src: str, cands: dict, brief_dir: pathlib.Path) -> dict:
    kind, ref = src.split(":", 1)
    if src in cands:
        return dict(cands[src])
    if kind == "pixabay":
        key = os.environ.get("PIXABAY_API_KEY")
        if not key:
            raise RuntimeError(f"{src} not in candidates.json and PIXABAY_API_KEY is not set")
        data = _json("https://pixabay.com/api/videos/?" + urllib.parse.urlencode({"key": key, "id": ref}))
        h = data["hits"][0]
        best = _pick_pixabay_rendition(h["videos"])
        return {"src": src, "provider": "pixabay", "pageUrl": h["pageURL"], "duration": h["duration"],
                "author": h["user"], "width": best["width"], "height": best["height"],
                "downloadUrl": best["url"], "tags": h.get("tags"), **PIXABAY_LICENSE}
    if kind == "commons":
        q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + ref,
                                    "prop": "imageinfo", "iiprop": "url|size|extmetadata"})
        pages = _json("https://commons.wikimedia.org/w/api.php?" + q)["query"]["pages"]
        info = next(iter(pages.values()))["imageinfo"][0]
        meta = info.get("extmetadata", {})
        lic = _commons_license((meta.get("LicenseShortName", {}) or {}).get("value", ""))
        if not lic:
            raise RuntimeError(f"{src}: license not in allowed list")
        return {"src": src, "provider": "commons", "pageUrl": info["descriptionurl"],
                "duration": info.get("duration"), "author": _strip_html(meta.get("Artist", {}).get("value", "")),
                "width": info.get("width"), "height": info.get("height"), "downloadUrl": info["url"],
                "license": lic, "licenseUrl": meta.get("LicenseUrl", {}).get("value"), "shareAlike": "SA" in lic}
    if kind == "local":
        p = (brief_dir / ref).resolve()
        if not p.is_file():
            raise RuntimeError(f"{src}: local file missing")
        return {"src": src, "provider": "local", "path": str(p.relative_to(ROOT)),
                "license": "own work (author must confirm rights)", "author": "project"}
    raise RuntimeError("unknown source kind " + src)


def lock(brief: dict) -> dict:
    d = pathlib.Path(brief["_dir"])
    lock_path = d / "sources.lock.json"
    current = json.loads(lock_path.read_text(encoding="utf-8")) if lock_path.exists() else {}
    cands = _candidate_index(d)
    used = sorted({s["src"] for bt in brief["beats"] for s in bt["shots"]} |
                  {bt["clip"]["src"] for bt in brief["beats"] if bt.get("clip")})
    out = {}
    for src in used:
        if src in current and current[src].get("sha256"):
            out[src] = current[src]
            continue
        meta = _resolve(src, cands, d)
        path = _download(meta)
        meta["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        meta["bytes"] = path.stat().st_size
        meta["duration"] = probe_duration(path)
        meta["lockedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        for k in ("query", "views", "downloads", "thumbnail", "cacheFile"):
            meta.pop(k, None)
        out[src] = meta
    lock_path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return out


def _cache_name(src: str) -> pathlib.Path:
    return CACHE / (hashlib.sha1(src.encode()).hexdigest()[:16] + ".media")


def _download(meta: dict) -> pathlib.Path:
    if meta["provider"] == "local":
        return ROOT / meta["path"]
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = _cache_name(meta["src"])
    if not dest.exists():
        dest.write_bytes(_get(meta["downloadUrl"], timeout=120))
    return dest


def fetch(src: str, lock_data: dict) -> pathlib.Path:
    meta = lock_data.get(src)
    if not meta:
        raise RuntimeError(f"{src} is not locked; run `shorts.py lock` first")
    path = _download(meta)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != meta["sha256"]:
        path.unlink(missing_ok=True)
        path = _download(meta)
        if hashlib.sha256(path.read_bytes()).hexdigest() != meta["sha256"]:
            raise RuntimeError(f"{src}: checksum differs from lock")
    return path


def probe_duration(path: pathlib.Path) -> float:
    import subprocess
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True, check=True)
    return round(float(r.stdout.strip()), 3)


# ---------------------------------------------------------------- inspect

def inspect(srcs: list[str], out_dir: pathlib.Path, frames: int = 24) -> list[dict]:
    """Download sources and make a timestamped filmstrip per source. Watch before writing."""
    import subprocess
    from PIL import Image, ImageDraw, ImageFont
    out_dir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 22)
    results = []
    for src in srcs:
        try:
            meta = _resolve(src, {}, out_dir)
            path = _download(meta)
            meta["duration"] = probe_duration(path)
            meta["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            meta["cacheFile"] = path.name
            name = re.sub(r"[^A-Za-z0-9._-]+", "_", src)[:80]
            if src.startswith("commons:"):
                srt = _commons_timed_text(src.split(":", 1)[1])
                if srt:
                    (out_dir / f"{name}.en.srt").write_text(srt, encoding="utf-8")
                    meta["timedText"] = f"{name}.en.srt"
            if not has_video(path):
                _waveform_sheet(path, meta, out_dir / f"{name}.jpg", font)
                meta.pop("query", None)
                results.append(meta)
                continue
            n = frames
            step = meta["duration"] / n
            tiles = []
            for i in range(n):
                t = i * step + step / 2
                r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1",
                                    "-vf", "scale=320:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
                                   capture_output=True)
                if r.stdout:
                    tiles.append((t, Image.open(io.BytesIO(r.stdout)).convert("RGB")))
            if tiles:
                th = max(im.height for _, im in tiles)
                cols = 6
                rows = (len(tiles) + cols - 1) // cols
                sheet = Image.new("RGB", (cols * 320, rows * (th + 30) + 40), (10, 10, 12))
                d = ImageDraw.Draw(sheet)
                d.text((8, 6), f"{src}  {meta['duration']:.1f}s {meta.get('width')}x{meta.get('height')} {meta.get('license')}",
                       font=font, fill=(255, 220, 90))
                for k, (t, im) in enumerate(tiles):
                    x, y = (k % cols) * 320, 40 + (k // cols) * (th + 30)
                    sheet.paste(im, (x, y))
                    d.text((x + 4, y + th + 2), f"{t:5.1f}s", font=font, fill=(235, 235, 235))
                sheet.save(out_dir / f"{name}.jpg", quality=80)
            meta.pop("query", None)
            results.append(meta)
        except Exception as ex:  # noqa: BLE001
            results.append({"src": src, "error": str(ex)})
    (out_dir / "inspect.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    return results


def has_video(path: pathlib.Path) -> bool:
    """False for audio-only files; still images count as video (one frame)."""
    import subprocess
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return "video" in r.stdout


def _commons_timed_text(title: str) -> str | None:
    """English subtitles stored on Commons (TimedText namespace), if any. Used to time real audio."""
    url = ("https://commons.wikimedia.org/w/index.php?" +
           urllib.parse.urlencode({"title": f"TimedText:{title}.en.srt", "action": "raw"}))
    try:
        txt = _get(url, timeout=30, limit=2_000_000).decode("utf-8", "replace")
    except Exception:  # noqa: BLE001 - subtitles are optional
        return None
    return txt if "-->" in txt else None


def _waveform_sheet(path: pathlib.Path, meta: dict, out: pathlib.Path, font) -> None:
    """Audio-only source: waveform rows with a seconds ruler, so speech can be located by eye."""
    import subprocess
    from PIL import Image, ImageDraw
    rate = 8000
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"],
                       capture_output=True, check=True)
    import numpy as np
    pcm = np.frombuffer(r.stdout, np.float32)
    row_sec, width, rh = 20, 2000, 120
    rows = max(1, int(np.ceil(len(pcm) / rate / row_sec)))
    sheet = Image.new("RGB", (width, 40 + rows * (rh + 30)), (10, 10, 12))
    d = ImageDraw.Draw(sheet)
    d.text((8, 6), f"{meta['src']}  {meta['duration']:.1f}s audio {meta.get('license')}", font=font, fill=(255, 220, 90))
    peak = float(np.max(np.abs(pcm))) or 1.0
    for k in range(rows):
        seg = pcm[k * row_sec * rate:(k + 1) * row_sec * rate]
        y0 = 40 + k * (rh + 30)
        px = width / (row_sec * rate)
        cols = np.array_split(seg, max(1, int(len(seg) * px))) if len(seg) else []
        for x, c in enumerate(cols):
            a = float(np.max(np.abs(c))) / peak if len(c) else 0
            d.line([(x, y0 + rh / 2 - a * rh / 2), (x, y0 + rh / 2 + a * rh / 2)], fill=(120, 200, 255))
        for sec in range(row_sec + 1):
            x = int(sec / row_sec * (width - 1))
            d.line([(x, y0 + rh), (x, y0 + rh + 6)], fill=(200, 200, 200))
            if sec % 2 == 0:
                d.text((x + 2, y0 + rh + 4), f"{k * row_sec + sec}s", font=font, fill=(220, 220, 220))
    sheet.save(out, quality=85)
