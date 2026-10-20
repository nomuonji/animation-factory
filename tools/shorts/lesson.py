"""English lesson specs -> Shorts v3 briefs.

A lesson spec (lessons/<id>.json) holds only the teaching content: the target, its
meaning, examples and a quiz. The pattern decides the beat order, the narration
glue, how often the English is heard and how the video closes. This keeps every
video on the rules the channel owner set (2026-10-20):

  * one target per video, usable in real life
  * the answer comes early; the English is heard at least three times
    (normal, slow, recap) and every example is spoken in English
  * the viewer says it once (quiz with a think pause)
  * it ends by returning to the opening question and stating the answer again;
    no new facts at the end

Narration items are either a string (caption == what VOICEVOX reads) or
{"cap": "...", "say": "..."} when the caption shows English but the voice must read
Japanese (VOICEVOX cannot pronounce English).

Scenes come from catalog/lesson-scenes.json (vetted, licensed stills, by tag).
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCENES = ROOT / "catalog" / "lesson-scenes.json"
PATTERNS = ("phrase", "word", "vs", "upgrade")
SERIES = {
    "phrase": "言えそうで言えない一言",
    "word": "ちょっと難しい英単語",
    "vs": "どっちを使う？",
    "upgrade": "very から卒業",
}
VOICE_A, VOICE_B = "af_heart", "am_michael"


class LessonError(ValueError):
    pass


def _scenes() -> dict:
    return json.loads(SCENES.read_text(encoding="utf-8"))["scenes"]


def _n(item) -> tuple[str, str]:
    """(caption, say) for a narration item."""
    if isinstance(item, str):
        return item, item
    return item["cap"], item.get("say", item["cap"])


def _narr(items) -> dict:
    caps, says = zip(*(_n(i) for i in items))
    out = {"say": "／".join(says)}
    if caps != says:
        out["caption"] = "／".join(caps)
    return out


class _Shots:
    """Picks a scene for each beat from catalog/lesson-scenes.json.

    A tag may hold several variants (stills or short videos). Each lesson gets one
    variant per tag, chosen from its id, so different lessons look different while a
    lesson stays consistent. Stills get a continuous slow push-in; videos advance their
    start point between beats and loop if a beat is longer than the clip.
    """

    def __init__(self, spec: dict):
        self.pool = _scenes()
        self.spec = spec
        self.zoom: dict[str, float] = {}
        self.cursor: dict[str, float] = {}

    def _variant(self, tag: str) -> dict:
        v = self.pool[tag]
        variants = v if isinstance(v, list) else [v]
        pref = self.spec.get("sceneVariant", {}).get(tag)
        if pref is not None:
            return variants[int(pref) % len(variants)]
        h = int(hashlib.sha1(f"{self.spec['id']}:{tag}".encode()).hexdigest(), 16)
        return variants[h % len(variants)]

    def __call__(self, tag: str, step: float = 0.06) -> list[dict]:
        scenes = self.spec.get("scenes", {})
        if tag == "memo" and "memo" not in scenes:
            tag = "hook"
        tag = scenes.get(tag, tag)
        if tag not in self.pool:
            raise LessonError(f"scene '{tag}' is not in catalog/lesson-scenes.json")
        sc = self._variant(tag)
        z0 = self.zoom.get(tag, float(sc.get("zoom", 1.04)))
        z1 = min(2.4, z0 + step)
        self.zoom[tag] = z1
        if sc.get("kind") == "video":
            dur = float(sc.get("duration") or 10)
            start = self.cursor.get(tag, float(sc.get("in", min(1.0, dur * 0.1))))
            self.cursor[tag] = (start + 4.0) % max(1.0, dur - 1.0)
            shot = {"src": sc["src"], "in": round(start, 2), "loop": True, "zoom": [round(z0, 3), round(z1, 3)]}
        else:
            shot = {"src": sc["src"], "in": 0, "freeze": True, "zoom": [round(z0, 3), round(z1, 3)]}
        for k in ("frame", "focus"):
            if k in sc:
                shot[k] = sc[k]
        return [shot]


def _tts(text: str, ja: str, voice: str = VOICE_A, speed: float = 0.95, lines=None) -> dict:
    clip = {"tts": {"text": text, "voice": voice, "speed": speed}}
    if lines:
        clip["lines"] = lines
    else:
        clip["ja"] = ja
    return clip


def _beat(id_, role, why, shots, **kw) -> dict:
    b = {"id": id_, "role": role, "why": why, "shots": shots}
    b.update({k: v for k, v in kw.items() if v is not None})
    return b


def _examples(spec, shot, emph) -> list[dict]:
    beats = []
    for i, ex in enumerate(spec["examples"], 1):
        voice = VOICE_A if i % 2 else VOICE_B
        if ex.get("intro"):
            beats.append(_beat(f"ex{i}-intro", "evidence", "例文の場面を一言で", shot(ex["scene"]), **_narr([ex["intro"]])))
        lines = [{"en": e, "ja": j} for e, j in zip(ex["en"], ex["ja"])]
        beats.append(_beat(f"ex{i}-en", "evidence" if i == 1 else "escalation", "例文を英語で聞く",
                           shot(ex["scene"]), emphasis=emph, hold=0.7,
                           clip=_tts(" ".join(ex["en"]), "", voice, 0.92, lines)))
    return beats


def _quiz(spec, shot, emph) -> list[dict]:
    q = spec["quiz"]
    beats = [
        _beat("quiz", "evidence", "自分で言う時間（考える間）", shot(q["scene"]), overlay="言ってみよう",
              hold=3.0, sfx="tick", emphasis=q.get("emphasis"), **_narr(["では問題", *q["prompt"]])),
        _beat("quiz-answer", "turn", "答え合わせ", shot(q["scene"]), emphasis=emph, hold=0.6,
              clip=_tts(q["answer"], q["answerJa"], VOICE_A, 0.9)),
    ]
    if q.get("why"):
        beats.append(_beat("quiz-why", "evidence", "答えの形を一言で整理", shot(q["scene"]), **_narr(q["why"])))
    return beats


def _recap(spec, shot, emph, english: str, ja: str, lead) -> list[dict]:
    return [
        _beat("recap", "payoff", "冒頭の問いに戻って答えを言い切る", shot("hook", 0.03), overlay="今日の一言"
              if spec["pattern"] != "word" else "今日の単語", overlayY=spec.get("overlayY", 0.40),
              **_narr([lead])),
        _beat("recap-en", "loop", "最後にもう一度英語を聞いて終わる", shot("hook", 0.03),
              overlay="今日の一言" if spec["pattern"] != "word" else "今日の単語",
              overlayY=spec.get("overlayY", 0.40), emphasis=emph, hold=1.4,
              clip=_tts(english, ja, VOICE_A, 0.95)),
    ]


def _answer_twice(target: str, ja: str, shot, emph, scene: str) -> list[dict]:
    return [
        _beat("answer-en", "evidence", "答えの英語（普通の速さ）", shot(scene), emphasis=emph, hold=0.6,
              clip=_tts(target, ja, VOICE_A, 1.0)),
        _beat("answer-slow", "evidence", "ゆっくり版の前振り", shot(scene, 0.03), say="もう一度、ゆっくり。"),
        _beat("answer-en-slow", "evidence", "同じ英語をゆっくり（2回目）", shot(scene), emphasis=emph, hold=0.8,
              clip=_tts(target, ja, VOICE_A, 0.72)),
    ]


# ------------------------------------------------------------------ patterns

def _phrase(spec, shot):
    emph = spec.get("emphasis", [])
    a = spec["answer"]
    beats = [
        _beat("hook", "hook", "誰にでもある場面と問いを0秒で出す", shot("hook"), overlay=f"「{spec['jp']}」\n英語で言える？",
              overlayY=spec.get("overlayY", 0.40), sfx="whoosh", emphasis=[spec["jp"]],
              **_narr([spec["situation"], "英語で、パッと言えますか？"])),
        _beat("answer", "setup", "すぐ答えに入る", shot("answer", 0.03), sfx="pop", say="答えは、これです。"),
        *_answer_twice(a["en"], a["ja"], shot, emph, "answer"),
        _beat("meaning", "turn", "意味を一つだけ", shot("meaning", 0.12), sfx="pop",
              emphasis=spec.get("meaningEmphasis"), **_narr(spec["meaning"])),
        *_examples(spec, shot, emph),
        *_quiz(spec, shot, emph),
        *_recap(spec, shot, emph, a["en"], a["ja"], spec.get("recapLead") or f"「{spec['jp']}」は、この一言。"),
    ]
    return beats


def _word(spec, shot):
    w = spec["word"]
    emph = [w] + spec.get("emphasis", [])
    beats = [
        _beat("hook", "hook", "単語そのものを0秒で見せて問う", shot("hook"), overlay=w, overlayY=spec.get("overlayY", 0.40),
              sfx="whoosh", **_narr(spec.get("hookLines") or ["この単語、", "意味わかりますか？"])),
        _beat("answer-en", "evidence", "発音（普通の速さ）", shot("hook", 0.03), emphasis=emph, hold=0.6, clip=_tts(w, spec["ja"], VOICE_A, 1.0)),
        _beat("answer-en-slow", "evidence", "発音（ゆっくり）", shot("hook", 0.03), emphasis=emph, hold=0.8, clip=_tts(w, spec["ja"], VOICE_A, 0.7)),
        _beat("meaning", "turn", "意味とイメージを一つ", shot("meaning", 0.12), sfx="pop",
              emphasis=spec.get("meaningEmphasis"),
              **_narr([{"cap": f"{spec['pos']}「{spec['ja']}」", "say": f"意味は、{spec['ja']}。"}, *spec["meaning"]])),
        *([_beat("memo", "escalation", "覚え方・使う場面（ニュアンス）", shot("memo"), sfx="pop",
                 emphasis=spec.get("memoEmphasis"), **_narr(spec["memo"]))] if spec.get("memo") else []),
        *_examples(spec, shot, emph),
        *_quiz(spec, shot, emph),
        *_recap(spec, shot, emph, w, spec["ja"], {"cap": f"「{spec['ja']}」は", "say": f"{spec['ja']}は、"}),
    ]
    return beats


def _vs(spec, shot):
    a, b = spec["a"], spec["b"]
    emph = [a["word"], b["word"]]
    beats = [
        _beat("hook", "hook", "二択を0秒で見せる", shot("hook"), overlay=f"{a['word']}  /  {b['word']}\nどっち？",
              overlayY=spec.get("overlayY", 0.40), sfx="whoosh", **_narr(spec["hookLines"])),
        _beat("rule", "setup", "見分け方を一言で", shot("meaning", 0.1), sfx="pop", emphasis=spec.get("ruleEmphasis"),
              **_narr(spec["rule"])),
        _beat("a-en", "evidence", "Aの例文", shot(a["scene"]), emphasis=emph, hold=0.7,
              clip=_tts(a["example"], a["exampleJa"], VOICE_A, 0.92)),
        _beat("b-en", "evidence", "Bの例文", shot(b["scene"]), emphasis=emph, hold=0.7,
              clip=_tts(b["example"], b["exampleJa"], VOICE_B, 0.92)),
        *_quiz(spec, shot, emph),
        _beat("recap", "payoff", "見分け方に戻って締める", shot("hook", 0.03), overlay="今日のポイント",
              overlayY=spec.get("overlayY", 0.40), emphasis=spec.get("ruleEmphasis"), hold=1.2, **_narr(spec["recap"])),
    ]
    return beats


def _upgrade(spec, shot):
    emph = [spec["word"]] + spec.get("emphasis", [])
    beats = [
        _beat("hook", "hook", "いつもの言い方を0秒で出す", shot("hook"), overlay=f"{spec['basic']}\nもっと強く言うと？",
              overlayY=spec.get("overlayY", 0.40), sfx="whoosh", **_narr(spec["hookLines"])),
        _beat("answer", "setup", "すぐ答えに入る", shot("answer", 0.03), sfx="pop", say="答えは、これです。"),
        *_answer_twice(spec["word"], spec["ja"], shot, emph, "answer"),
        _beat("meaning", "turn", "very との違いを一つ", shot("meaning", 0.12), sfx="pop",
              emphasis=spec.get("meaningEmphasis"), **_narr(spec["meaning"])),
        *_examples(spec, shot, emph),
        *_quiz(spec, shot, emph),
        *_recap(spec, shot, emph, spec["word"], spec["ja"],
                {"cap": f"{spec['basic']} の代わりに", "say": spec.get("recapSay", "もっと強く言いたい時は、")}),
    ]
    return beats


BUILDERS = {"phrase": _phrase, "word": _word, "vs": _vs, "upgrade": _upgrade}


def _check_spoken_japanese(beats: list[dict]) -> None:
    """VOICEVOX reads Japanese only: Latin letters in `say` come out as garbage."""
    for bt in beats:
        say = bt.get("say") or ""
        if re.search(r"[A-Za-z]", say):
            raise LessonError(f"{bt['id']}: narration (say) contains Latin letters; put English in cap "
                              f"and katakana/Japanese in say: {say}")


def compile_lesson(spec: dict) -> dict:
    p = spec.get("pattern")
    if p not in BUILDERS:
        raise LessonError(f"pattern must be one of {PATTERNS}")
    shot = _Shots(spec)
    beats = BUILDERS[p](spec, shot)
    _check_spoken_japanese(beats)
    for bt in beats:  # drop empty optional keys the brief validator does not expect
        if bt.get("emphasis") is None:
            bt.pop("emphasis", None)
    n = spec.get("number")
    series = SERIES[p]
    title = spec["title"] + (f"【{series} #{n}】" if n else f"【{series}】")
    return {
        "version": 3,
        "id": spec["id"],
        "title": title[:100],
        "status": "draft",
        "channel": f"error-english (エラーで学ぶ英語) — {series}",
        "topic": {"source": "manual", "ref": f"lessons/{spec['id']}.json (pattern={p}, level={spec.get('level', '')})",
                  "summary": spec.get("summary", "")},
        "audience": "英語を勉強している日本語話者",
        "reaction": "知りたい",
        "format": "guess-reveal",
        "promise": {"firstFrame": spec.get("firstFrame", "問いの見出しと場面の写真"),
                    "payoff": "冒頭の問いに戻って答えの英語を音声と字幕で言い切る"},
        "references": [{"url": r, "watched": False, "note": "意味の根拠（辞書）"} for r in spec.get("sources", [])],
        "voice": {"engine": "voicevox", "speaker": "青山龍星", "style": "ノーマル", "speed": 1.08},
        "music": {"asset": "safe-space-loop", "gain": 0.08, "duck": 0.3},
        "look": {"frame": "fit"},
        "descriptionLines": spec.get("descriptionLines") or _description(spec),
        "beats": beats,
    }


def _description(spec: dict) -> list[str]:
    """Study notes for the video description, generated from the same content."""
    p = spec["pattern"]
    out: list[str] = []
    if p == "phrase":
        out.append(f"・{spec['answer']['en']} ＝ {spec['answer']['ja']}")
    elif p == "word":
        out.append(f"・{spec['word']}（{spec['pos']}）＝ {spec['ja']}")
    elif p == "upgrade":
        out.append(f"・{spec['basic']} → {spec['word']} ＝ {spec['ja']}")
    elif p == "vs":
        for k in ("a", "b"):
            x = spec[k]
            out.append(f"・{x['word']} ＝ {x['ja']}　例: {x['example']}（{x['exampleJa']}）")
    for ex in spec.get("examples", []):
        out.append(f"・{' '.join(ex['en'])} ＝ {'、'.join(ex['ja'])}")
    q = spec.get("quiz")
    if q:
        out.append(f"・{q['answer']} ＝ {q['answerJa']}")
    for r in spec.get("sources", []):
        out.append(f"意味の確認: {r}")
    return out


def write(spec_path: str) -> pathlib.Path:
    spec = json.loads(pathlib.Path(spec_path).read_text(encoding="utf-8"))
    brief = compile_lesson(spec)
    out = ROOT / "productions" / spec["id"] / "short.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(brief, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out
