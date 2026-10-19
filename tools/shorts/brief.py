"""Shorts v3 brief: load, validate (hard errors) and lint (editorial warnings).

A brief is topic-agnostic. Any idea source (manual, Keywords market idea, X post,
...) is turned into the same structure: a viewer promise, a first frame, a payoff,
and beats that each show something NEW on screen. Validation only proves the file
is renderable. It never proves the video is good; that is the editorial review.
"""
from __future__ import annotations

import json
import pathlib
import re

ROLES = {"hook", "setup", "evidence", "turn", "escalation", "payoff", "loop"}
REACTIONS = {"驚き", "笑い", "気持ちよさ", "謎解き", "共感", "知りたい", "保存したい"}
SFX = {"none", "whoosh", "hit", "pop", "tick", "rise", "thunder"}
FRAMES = {"fill", "fit"}
SRC_RE = re.compile(r"^(pixabay|commons|local):.+$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
BREAK = "／"


# Story formats: reusable structures any topic can be poured into. Each lists the
# role sequence a cut should follow and what the hook must put on screen.
FORMATS = {
    "transformation": {
        "label": "変化を見せる",
        "roles": ["hook", "setup", "evidence", "escalation", "turn", "payoff"],
        "hook": "変化後（または変化の途中）の最も強い画を0秒に置く",
        "note": "Aがこう変わる、だがそれだけでなく、だから…。後半に二段目の変化を必ず入れる",
    },
    "myth-flip": {
        "label": "思い込みを覆す",
        "roles": ["hook", "setup", "turn", "evidence", "escalation", "payoff"],
        "hook": "皆が信じている姿を映しつつ『実は違う』を画で匂わせる",
        "note": "思い込み→反証の映像→さらに意外な事実→最初の画の意味が変わる",
    },
    "guess-reveal": {
        "label": "当ててから答え合わせ",
        "roles": ["hook", "setup", "evidence", "turn", "payoff"],
        "hook": "問いの対象を画面に出し、答えを隠す",
        "note": "視聴者に予想させ、ヒント映像で揺さぶり、映像で答え合わせ",
    },
    "scale-ladder": {
        "label": "スケールを上げていく",
        "roles": ["hook", "evidence", "escalation", "escalation", "payoff"],
        "hook": "最終段の規模を一瞬見せるか、出発点の小ささを強調",
        "note": "段ごとに桁や強さが上がり、最後に一番上を見せる",
    },
    "process": {
        "label": "工程の気持ちよさ",
        "roles": ["hook", "evidence", "evidence", "escalation", "payoff"],
        "hook": "完成形を先に見せる",
        "note": "語りは最小。手元・変形・音が主役。最後は完成形に戻る",
    },
}


class BriefError(ValueError):
    pass


def load(path: str | pathlib.Path) -> dict:
    p = pathlib.Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    data["_dir"] = str(p.resolve().parent)
    validate(data)
    return data


def _req(cond: bool, msg: str, errors: list[str]) -> None:
    if not cond:
        errors.append(msg)


def validate(b: dict) -> None:
    e: list[str] = []
    _req(b.get("version") == 3, "version must be 3", e)
    _req(isinstance(b.get("id"), str) and bool(ID_RE.match(b.get("id", ""))), "id must be kebab-case", e)
    for k in ("title", "audience"):
        _req(isinstance(b.get(k), str) and b[k].strip() != "", f"{k} is required", e)
    _req(b.get("reaction") in REACTIONS, f"reaction must be one of {sorted(REACTIONS)}", e)
    _req(b.get("format", "transformation") in FORMATS, f"format must be one of {sorted(FORMATS)}", e)
    pr = b.get("promise") or {}
    _req(bool(str(pr.get("firstFrame", "")).strip()), "promise.firstFrame is required (what is visible at 0s)", e)
    _req(bool(str(pr.get("payoff", "")).strip()), "promise.payoff is required (what the last shot delivers)", e)
    voice = b.get("voice") or {}
    _req(voice.get("engine") in ("voicevox", "none"), "voice.engine must be voicevox or none", e)
    look = b.get("look") or {}
    _req(look.get("frame", "fill") in FRAMES, "look.frame must be fill or fit", e)
    beats = b.get("beats")
    _req(isinstance(beats, list) and len(beats) >= 2, "at least 2 beats", e)
    seen = set()
    for i, bt in enumerate(beats or []):
        where = f"beats[{i}]"
        _req(isinstance(bt.get("id"), str) and bt["id"] not in seen, f"{where}.id missing or duplicated", e)
        seen.add(bt.get("id"))
        _req(bt.get("role") in ROLES, f"{where}.role must be one of {sorted(ROLES)}", e)
        _req(bool(str(bt.get("why", "")).strip()), f"{where}.why is required (what NEW thing the viewer sees)", e)
        _req(bool(str(bt.get("say", "")).strip()) or float(bt.get("min", 0)) > 0,
             f"{where} needs narration (say) or an explicit min duration", e)
        _req(bt.get("sfx", "none") in SFX, f"{where}.sfx must be one of {sorted(SFX)}", e)
        shots = bt.get("shots")
        _req(isinstance(shots, list) and len(shots) >= 1, f"{where}.shots needs at least one shot", e)
        for j, s in enumerate(shots or []):
            sw = f"{where}.shots[{j}]"
            _req(isinstance(s.get("src"), str) and bool(SRC_RE.match(s.get("src", ""))),
                 f"{sw}.src must be pixabay:<id>, commons:<File name> or local:<path>", e)
            _req(float(s.get("in", 0)) >= 0, f"{sw}.in must be >= 0", e)
            _req(0.1 <= float(s.get("speed", 1)) <= 8, f"{sw}.speed out of range", e)
            fx, fy = s.get("focus", [0.5, 0.5])
            _req(0 <= fx <= 1 and 0 <= fy <= 1, f"{sw}.focus must be within 0..1", e)
            z = s.get("zoom", [1.0, 1.0])
            _req(len(z) == 2 and all(1.0 <= v <= 2.5 for v in z), f"{sw}.zoom must be [start,end] in 1..2.5", e)
    roles = [bt.get("role") for bt in beats or []]
    _req(roles[:1] == ["hook"], "first beat must have role hook", e)
    _req("payoff" in roles, "a payoff beat is required", e)
    if e:
        raise BriefError("Brief invalid:\n- " + "\n- ".join(e))


def caption_chunks(beat: dict) -> list[str]:
    """Caption units shown one at a time. Authors control breaks with ／."""
    text = beat.get("caption") or beat.get("say") or ""
    parts: list[str] = []
    for piece in text.split(BREAK):
        piece = piece.strip()
        if not piece:
            continue
        # Fallback auto-split on sentence ends and long clauses.
        for sent in re.split(r"(?<=[。！？!?])", piece):
            sent = sent.strip()
            if not sent:
                continue
            if len(sent) > 16 and "、" in sent:
                subs = [s for s in re.split(r"(?<=、)", sent) if s.strip()]
                parts.extend(s.strip() for s in subs)
            else:
                parts.append(sent)
    return parts


def spoken_text(beat: dict) -> str:
    return (beat.get("say") or "").replace(BREAK, "")


def display_text(chunk: str) -> str:
    """Caption text drops trailing 。 and 、 like native Japanese Shorts captions."""
    return chunk.rstrip("。、")


def lint(b: dict, timeline: dict | None = None) -> list[str]:
    """Editorial warnings. These are prompts for a human/editor, not pass marks."""
    w: list[str] = []
    beats = b["beats"]
    fmt = FORMATS.get(b.get("format", "transformation"))
    roles = [bt["role"] for bt in beats if bt["role"] != "loop"]
    expected = [r for r in fmt["roles"]]
    it = iter(roles)
    if not all(any(r == x for x in it) for r in ["hook", "payoff"]) or \
            not all(r in roles for r in set(expected) - {"setup"}):
        w.append(f"Beat roles {roles} drift from the '{b.get('format', 'transformation')}' format "
                 f"{expected}: {fmt['note']}")
    if not any(r.get("watched") for r in b.get("references", [])):
        w.append("No reference Short marked watched=true; study at least 3 comparable Shorts before finalizing.")
    for bt in beats:
        for c in caption_chunks(bt):
            if len(display_text(c)) > 22:
                w.append(f"{bt['id']}: caption chunk too long to read at a glance ({len(c)} chars): {c}")
    srcs = [(s["src"], round(float(s.get("in", 0)))) for bt in beats for s in bt["shots"]]
    dup = {x for x in srcs if srcs.count(x) > 1}
    for d in sorted(dup):
        w.append(f"Same footage moment reused: {d[0]} @{d[1]}s. Reuse only as a deliberate callback.")
    if timeline:
        hook = timeline["beats"][0]
        if hook["duration"] > 3.2:
            w.append(f"Hook lasts {hook['duration']:.1f}s; the promise should land within ~3s.")
        total = timeline["total"]
        if total < 15 or total > 60:
            w.append(f"Total {total:.1f}s is outside the 15-60s working range (advisory, not a rule).")
        for tb in timeline["beats"]:
            for sh in tb["shots"]:
                if sh["duration"] > 5.5 and not sh.get("motionJustified"):
                    w.append(f"{tb['id']}: single shot holds {sh['duration']:.1f}s. Is something visibly changing?")
            if tb.get("moraRate", 0) > 9.5:
                w.append(f"{tb['id']}: narration is fast ({tb['moraRate']:.1f} mora/s).")
    return w
