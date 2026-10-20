#!/usr/bin/env python3
"""Shorts v3 CLI.

  python tools/shorts/shorts.py new <id> --topic "..."   scaffold productions/<id>/short.json
  python tools/shorts/shorts.py check <brief>            validate + lint (needs lock for timing)
  python tools/shorts/shorts.py find <brief>             search footage -> candidates.json/.jpg
  python tools/shorts/shorts.py lock <brief>             download + checksum used sources
  python tools/shorts/shorts.py render <brief> [--quick] render MP4 + review pack
  python tools/shorts/shorts.py lesson lessons/<id>.json compile an English lesson spec into a brief
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import brief as B  # noqa: E402
import footage  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]

TEMPLATE = {
    "version": 3,
    "id": "",
    "title": "",
    "status": "draft",
    "topic": {"source": "manual", "ref": "", "summary": ""},
    "audience": "誰が、どんなスクロール中に止まるか",
    "reaction": "驚き",
    "format": "transformation",
    "promise": {"firstFrame": "0秒で画面に見えているもの", "payoff": "最後のショットで回収するもの"},
    "references": [{"url": "", "watched": False, "note": "似たShortsを3本以上。実際に見たらwatched=true"}],
    "voice": {"engine": "voicevox", "speaker": "青山龍星", "style": "ノーマル", "speed": 1.15},
    "music": {"asset": "flowerbed-fields", "gain": 0.16, "duck": 0.35},
    "look": {"frame": "fill", "titleBar": None},
    "descriptionLines": [],
    "beats": [
        {"id": "hook", "role": "hook", "overlay": "見出し(任意)", "say": "最初の一言／ここで約束", "emphasis": [],
         "search": ["english footage keywords"], "shots": [{"src": "pixabay:0", "in": 0, "zoom": [1.0, 1.08]}],
         "sfx": "whoosh", "why": "0秒で何を見せ、何を約束するか"},
        {"id": "payoff", "role": "payoff", "say": "回収の一言", "search": [],
         "shots": [{"src": "pixabay:0", "in": 0}], "why": "冒頭の約束をどう回収するか"},
    ],
}


def cmd_new(a):
    d = ROOT / "productions" / a.id
    d.mkdir(parents=True, exist_ok=False)
    t = json.loads(json.dumps(TEMPLATE))
    t["id"], t["title"] = a.id, a.topic or a.id
    t["topic"]["summary"] = a.topic or ""
    t["topic"]["source"] = a.source
    t["format"] = a.format
    (d / "short.json").write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(d / "short.json")


def _lock_for(b):
    p = pathlib.Path(b["_dir"]) / "sources.lock.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def cmd_formats(a):
    for k, f in B.FORMATS.items():
        print(f"{k:<15} {f['label']}\n   roles: {' > '.join(f['roles'])}\n   hook : {f['hook']}\n   {f['note']}")


def cmd_check(a):
    b = B.load(a.brief)
    lock = _lock_for(b)
    tl = None
    if lock is not None and a.timing:
        import render
        tl = render.build_timeline(b, lock)
        for bt in tl["beats"]:
            print(f"{bt['start']:6.2f}s +{bt['duration']:.2f}s {bt['role']:<10} {bt['id']}")
        print(f"total {tl['total']:.2f}s")
    for w in B.lint(b, tl):
        print("WARN", w)
    print("OK", b["id"])


def cmd_find(a):
    b = B.load(a.brief)
    r = footage.find(b)
    for q, lst in r["queries"].items():
        ok = [c for c in lst if c.get("src")]
        print(f"{q}: {len(ok)} candidates")
        for c in ok[:a.show]:
            print(f"   {c['src']:<48} {c.get('duration')}s {c.get('width')}x{c.get('height')} {c.get('tags', '')[:50]}")


def cmd_scout(a):
    """Topic-free footage scouting: see what real footage exists BEFORE writing a brief."""
    out = ROOT / "outputs" / "scout"
    out.mkdir(parents=True, exist_ok=True)
    fake = {"_dir": str(out), "beats": [], "search": a.queries}
    r = footage.find(fake)
    for q, lst in r["queries"].items():
        ok = [c for c in lst if c.get("src")]
        print(f"{q}: {len(ok)} candidates")


def cmd_inspect(a):
    out = ROOT / "outputs" / "inspect"
    for r in footage.inspect(a.srcs, out, a.frames):
        print(r.get("src"), r.get("duration"), r.get("width"), r.get("height"), r.get("license"), r.get("error", ""))


def cmd_lesson(a):
    import lesson
    for spec in a.specs:
        out = lesson.write(spec)
        if out.name == "longform.json":
            sys.path.insert(0, str(ROOT / "tools" / "longform"))
            import longform
            longform.load(out)
        else:
            B.load(out)  # must be a valid brief
        print(out)


def cmd_vocab(a):
    """CEFR C1/C2 words not yet used in any lesson (lessons/*.json)."""
    import csv
    used = set()
    for f in (ROOT / "lessons").glob("*.json"):
        spec = json.loads(f.read_text(encoding="utf-8"))
        for w in spec.get("words", []):
            used.add(w["word"].lower())
        for k in ("word",):
            if spec.get(k):
                used.add(spec[k].lower())
        for k in ("a", "b"):
            if isinstance(spec.get(k), dict):
                used.add(spec[k]["word"].lower())
    rows = csv.DictReader(open(ROOT / "catalog" / "vocab" / "octanove-vocabulary-profile-c1c2-1.0.csv", encoding="utf-8"))
    out = [r for r in rows if r["CEFR"] == a.level and (not a.pos or r["pos"] == a.pos)
           and r["headword"].strip().split("/")[0].lower() not in used]
    for r in out:
        print(f'{r["headword"].strip():<28} {r["pos"]:<10} {r["CEFR"]}')
    print(f"{len(out)} unused {a.level} words", file=sys.stderr)


def cmd_lock(a):
    b = B.load(a.brief)
    out = footage.lock(b)
    for src, m in out.items():
        print(f"{src}: {m['provider']} {m.get('duration')}s {m.get('license')} sha256={m['sha256'][:12]}")


def cmd_render(a):
    import render
    b = B.load(a.brief)
    lock = _lock_for(b)
    if lock is None:
        raise SystemExit("run lock first")
    rep = render.render(a.brief, lock, quick=a.quick)
    print(json.dumps(rep, ensure_ascii=False, indent=1))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(required=True)
    n = sub.add_parser("new")
    n.add_argument("id")
    n.add_argument("--topic", default="")
    n.add_argument("--source", default="manual", choices=["manual", "market-idea", "x-post", "other"])
    n.add_argument("--format", default="transformation", choices=sorted(B.FORMATS))
    n.set_defaults(fn=cmd_new)
    fm = sub.add_parser("formats")
    fm.set_defaults(fn=cmd_formats)
    c = sub.add_parser("check")
    c.add_argument("brief")
    c.add_argument("--timing", action="store_true", help="synthesize voice to compute real beat timing")
    c.set_defaults(fn=cmd_check)
    f = sub.add_parser("find")
    f.add_argument("brief")
    f.add_argument("--show", type=int, default=6)
    f.set_defaults(fn=cmd_find)
    sc = sub.add_parser("scout")
    sc.add_argument("queries", nargs="+")
    sc.set_defaults(fn=cmd_scout)
    ins = sub.add_parser("inspect")
    ins.add_argument("srcs", nargs="+")
    ins.add_argument("--frames", type=int, default=24)
    ins.set_defaults(fn=cmd_inspect)
    ls_ = sub.add_parser("lesson", help="compile lessons/<id>.json into productions/<id>/short.json")
    ls_.add_argument("specs", nargs="+")
    ls_.set_defaults(fn=cmd_lesson)
    vc = sub.add_parser("vocab", help="list unused CEFR C1/C2 words")
    vc.add_argument("--level", choices=["C1", "C2"], default="C2")
    vc.add_argument("--pos", default="")
    vc.set_defaults(fn=cmd_vocab)
    lk = sub.add_parser("lock")
    lk.add_argument("brief")
    lk.set_defaults(fn=cmd_lock)
    r = sub.add_parser("render")
    r.add_argument("brief")
    r.add_argument("--quick", action="store_true")
    r.set_defaults(fn=cmd_render)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
