#!/usr/bin/env python3
"""Chapter-based landscape production. Reuses Shorts' sources, speech and cuts."""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import html
import json
import math
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools' / 'shorts'))
import brief as B
import footage

PROFILES = {'draft': (960, 540, 24), 'final': (1920, 1080, 30)}
ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def number(value, label, low=0, high=math.inf):
    x = float(value)
    if not math.isfinite(x) or not low <= x <= high:
        raise ValueError(f'{label}: expected finite number in {low}..{high}')
    return x


def load(path):
    path = pathlib.Path(path).resolve()
    b = json.loads(path.read_text(encoding='utf-8'))
    if b.get('version') != 1 or not ID.fullmatch(b.get('id', '')):
        raise ValueError('longform version=1 and safe id required')
    for key in ('title', 'audience', 'question', 'payoff'):
        if not str(b.get(key, '')).strip():
            raise ValueError(f'{key} required')
    chapters = b.get('chapters', [])
    if not chapters:
        raise ValueError('chapters required')
    seen = set()
    for ch in chapters:
        cid = ch.get('id', '')
        if not ID.fullmatch(cid) or cid in seen:
            raise ValueError('chapter ids must be safe and unique')
        seen.add(cid)
        for key in ('title', 'purpose', 'beats'):
            if not ch.get(key):
                raise ValueError(f'{cid}.{key} required')
        for bt in ch['beats']:
            if not bt.get('id') or not bt.get('why') or not bt.get('shots'):
                raise ValueError(f'{cid}: beat id, why and shots required')
            if not bt.get('say') and not bt.get('clip') and not bt.get('min'):
                raise ValueError(f'{cid}: beat needs say, clip, or min')
            for k in ('min', 'lead', 'hold'):
                number(bt.get(k, 0), k, 0, 180)
            if bt.get('caption') and bt.get('say') and len(B.caption_chunks(bt)) != len(B.say_chunks(bt)):
                raise ValueError(f'{cid}: say/caption chunk count differs')
            if bt.get('say') and bt.get('clip'):
                raise ValueError('say and clip cannot overlap')
            clip = bt.get('clip')
            if clip:
                errors = []
                # Reuse transcription validation; long-form source moments can exceed 20s.
                B._validate_clip(clip, cid, bt, errors)
                errors = [e for e in errors if 'keep a real-audio moment under 20s' not in e
                          and not (clip.get('captionMode') == 'none' and '.clip.lines: transcribe' in e)]
                if errors:
                    raise ValueError('\n'.join(errors))
            for sh in bt['shots']:
                if not B.SRC_RE.match(sh.get('src', '')):
                    raise ValueError('shot src must be commons:, pixabay: or local:')
                number(sh.get('in', 0), 'shot.in')
                number(sh.get('speed', 1), 'shot.speed', .1, 8)
                number(sh.get('weight', 1), 'shot.weight', .001, 1000)
                for n in sh.get('focus', [.5, .5]):
                    number(n, 'shot.focus', 0, 1)
                if len(sh.get('focus', [.5, .5])) != 2 or len(sh.get('zoom', [1, 1])) != 2:
                    raise ValueError('focus/zoom must have two values')
                for n in sh.get('zoom', [1, 1]):
                    number(n, 'shot.zoom', 1, 2.5)
                if sh.get('frame', 'fit') not in ('fill', 'fit'):
                    raise ValueError('shot.frame must be fit/fill')
        voice = ch.get('voice', b.get('voice', {}))
        if voice.get('engine') not in ('voicevox', 'none'):
            raise ValueError('voice.engine must be voicevox or none')
    b['_dir'] = str(path.parent)
    return b


def chapter_brief(b, ch):
    return {**b, **ch, 'voice': ch.get('voice', b.get('voice', {})),
            'music': ch.get('music', b.get('music', {})),
            'beats': [{'role': 'develop', **bt} for bt in ch['beats']]}


def flattened(b):
    return {**b, 'beats': [bt for ch in b['chapters'] for bt in ch['beats']]}


def sources(b):
    return sorted({sh['src'] for bt in b['beats'] for sh in bt['shots']} |
                  {bt['clip']['src'] for bt in b['beats'] if bt.get('clip', {}).get('src')})


def verified_sources(b, lock):
    """Verify without deleting a changed local original (Shorts fetch retries by deleting)."""
    result = {}
    for src in sources(b):
        meta = lock[src]
        path = footage._download(meta)
        if digest(path) != meta['sha256']:
            raise ValueError(f'{src}: source changed; restore it or deliberately relock it')
        result[src] = path
    return result


@contextlib.contextmanager
def landscape(profile):
    import render as R
    names = ('W', 'H', 'FPS', 'SAFE_LEFT', 'SAFE_RIGHT')
    old = {k: getattr(R, k) for k in names}
    R.W, R.H, R.FPS = profile
    R.SAFE_LEFT, R.SAFE_RIGHT = int(R.W * .06), int(R.W * .94)
    try:
        yield R
    finally:
        for k, v in old.items():
            setattr(R, k, v)


def fingerprint(b, lock, profile):
    # Include all media/speech/render code, and music bytes: stale caches cannot pass.
    code = {str(p.relative_to(ROOT)): digest(p) for folder in ('longform', 'shorts')
            for p in sorted((ROOT / 'tools' / folder).glob('*.py'))}
    relevant = {src: lock[src] for src in sources(b)}
    import render as R
    music = (b.get('music') or {}).get('asset')
    music_hash = digest(R._music_path(music)) if music else None
    clean = {k: v for k, v in b.items() if k not in ('chapters', '_dir')}
    value = json.dumps([clean, relevant, profile, code, music_hash], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(value.encode()).hexdigest()


def cached(out, key):
    receipt = out / 'receipt.json'
    try:
        r = json.loads(receipt.read_text())
        return r if r['key'] == key and all(digest(out / p) == sha for p, sha in r['files'].items()) else None
    except (OSError, KeyError, ValueError):
        return None


def caption_image(text, width):
    import render as R
    import numpy as np
    from PIL import Image, ImageDraw
    size = max(20, round(width * .027))
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    # Explicit bilingual lines; wrap both Latin words and Japanese within safe width.
    while True:
        font = R._font(R.FONT_BOLD, size)
        lines = []
        for line in text.splitlines():
            if ' ' in line and line.isascii():
                lines.extend(R._wrap_words(line, font, width * .86, probe))
            else:
                lines.extend(R._wrap(line, font, width * .86, probe))
        if max((probe.textlength(s, font=font) for s in lines), default=0) <= width * .88:
            break
        size -= 1
        if size < 14:
            raise ValueError('caption too long; split the caption chunks')
    lh = round(size * 1.4)
    img = Image.new('RGBA', (width, lh * len(lines) + 20), (0, 0, 0, 160))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text(((width - d.textlength(line, font=font)) / 2, i * lh + 6), line,
               font=font, fill='white', stroke_width=1, stroke_fill='black')
    return np.array(img)


def render_chapter(b, lock, out, profile):
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw
    paths = verified_sources(b, lock)
    out.mkdir(parents=True, exist_ok=True)
    with landscape(profile) as R:
        tl = R.build_timeline(b, lock)
        if not 0 < tl['total'] <= 180:
            raise ValueError('chapters must be <=180s; split by a meaningful scene boundary')
        silent = out / 'silent.mp4'
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                                '-s', f'{R.W}x{R.H}', '-r', str(R.FPS), '-i', '-', '-c:v', 'libx264',
                                '-threads', '2', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', str(silent)],
                               stdin=subprocess.PIPE)
        fi, tiles, text_cache = 0, [], {}
        try:
            for bt in tl['beats']:
                for sh in bt['shots']:
                    n = round(sh['duration'] * R.FPS)
                    if n < 1:
                        raise ValueError('shot shorter than one frame')
                    z0, z1 = sh.get('zoom', [1, 1])
                    frames = R._segment_frames(paths[sh['src']], float(sh.get('in', 0)), n,
                                               float(sh.get('speed', 1)), bool(sh.get('freeze')),
                                               bool(sh.get('loop')))
                    for k, src in enumerate(frames):
                        zoom = z0 + (z1 - z0) * k / max(n - 1, 1)
                        if sh.get('frame', 'fit') == 'fill':
                            fr = R._fill(src, sh.get('focus', [.5, .5]), zoom)
                        else:
                            # Fit the whole source; never crop portrait material on a wide canvas.
                            h, w = src.shape[:2]
                            scale = min(R.W / w, R.H / h)
                            fw, fh = max(1, round(w * scale)), max(1, round(h * scale))
                            fr = np.zeros((R.H, R.W, 3), dtype=np.uint8)
                            x, y = (R.W - fw) // 2, (R.H - fh) // 2
                            fr[y:y+fh, x:x+fw] = cv2.resize(src, (fw, fh))
                        t = fi / R.FPS
                        for a, e, text in bt['captions']:
                            if a <= t < e:
                                if text not in text_cache:
                                    text_cache[text] = caption_image(text, R.W)
                                ov = text_cache[text]
                                R._blend(fr, ov, R.H - ov.shape[0] - round(R.H * .055))
                                break
                        if bt.get('headline'):
                            key = 'headline:' + bt['headline']
                            if key not in text_cache:
                                text_cache[key] = R._render_headline(bt['headline'])
                            hv = text_cache[key]
                            R._blend(fr, hv, round(R.H * float(bt.get('headlineY', .30))) - hv.shape[0] // 2)
                        label = sh.get('label') or bt.get('overlay')
                        if label:
                            key = 'label:' + label
                            if key not in text_cache:
                                text_cache[key] = caption_image(label, R.W)
                            R._blend(fr, text_cache[key], round(R.H * .04))
                        enc.stdin.write(np.ascontiguousarray(fr).tobytes())
                        if fi == 0:
                            Image.fromarray(fr).save(out / 'first-frame.png')
                        if fi % (R.FPS * 10) == 0:
                            im = Image.fromarray(fr).resize((320, 180))
                            tile = Image.new('RGB', (320, 204), '#101318')
                            tile.paste(im)
                            ImageDraw.Draw(tile).text((6, 184), f'{t:.1f}s {bt["id"]}', fill='white')
                            tiles.append(tile)
                        fi += 1
            enc.stdin.close()
            if enc.wait() != 0:
                raise RuntimeError('chapter encoder failed')
        finally:
            if enc.poll() is None:
                enc.kill()
                enc.wait()
        raw = R.build_audio(b, tl, out)
        video = out / 'video.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(silent), '-i', str(raw),
                        '-c:v', 'copy', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
                        '-t', f'{fi / R.FPS:.6f}', '-movflags', '+faststart', str(video)], check=True)
        for p in (silent, raw):
            p.unlink(missing_ok=True)
        sheet = Image.new('RGB', (320 * 3, 204 * math.ceil(len(tiles) / 3)), '#101318')
        for i, tile in enumerate(tiles):
            sheet.paste(tile, ((i % 3) * 320, (i // 3) * 204))
        sheet.save(out / 'contact-sheet.jpg')
        return {'duration': fi / R.FPS, 'frames': fi,
                'captions': [cap for bt in tl['beats'] for cap in bt['captions']]}


def whole_film_audio_filter(path):
    import render as R
    value = R._loudnorm_filter(path, -16)
    measured = re.findall(r'(?:measured_I|measured_TP|offset)=([^:]+)', value)
    # Completely silent observation cuts have undefined LUFS; preserve their silence.
    return value if all(math.isfinite(float(x)) for x in measured) else 'anull'


def timestamp(t):
    n = round(t * 1000)
    h, n = divmod(n, 3600000)
    m, n = divmod(n, 60000)
    s, ms = divmod(n, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def run(path, profile_name='draft', force=False, profile_override=None):
    import render as R
    import review
    b = load(path)
    lock = json.loads((pathlib.Path(b['_dir']) / 'sources.lock.json').read_text())
    profile = profile_override or PROFILES[profile_name]
    out = ROOT / 'outputs' / 'longform' / b['id'] / profile_name
    out.mkdir(parents=True, exist_ok=True)
    # A failed rerender must never leave an earlier successful full-film receipt.
    (out / 'report.json').unlink(missing_ok=True)
    rows, offset, reused = [], 0.0, []
    for ch in b['chapters']:
        cb = chapter_brief(b, ch)
        verified_sources(cb, lock)
        key = fingerprint(cb, lock, profile)
        dest = out / 'chapters' / ch['id']
        r = None if force else cached(dest, key)
        if r:
            reused.append(ch['id'])
            print('reuse', ch['id'], flush=True)
        else:
            (dest / 'receipt.json').unlink(missing_ok=True)
            meta = render_chapter(cb, lock, dest, profile)
            r = {**meta, 'key': key, 'files': {p: digest(dest / p) for p in
                                             ('video.mp4', 'first-frame.png', 'contact-sheet.jpg')}}
            write_json(dest / 'receipt.json', r)
            print('rendered', ch['id'], r['duration'], flush=True)
        rows.append({'id': ch['id'], 'title': ch['title'], 'start': offset,
                     'duration': r['duration'], 'captions': r['captions']})
        offset += r['duration']
    # Generated safe IDs only; no arbitrary concat directives or shell arguments.
    concat = out / 'concat.txt'
    concat.write_text(''.join(f"file 'chapters/{ch['id']}/video.mp4'\nduration {ch['duration']:.9f}\n" for ch in rows))
    joined = out / 'joined.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '1', '-i', str(concat),
                    '-c', 'copy', str(joined)], check=True)
    metadata = out / 'chapters.ffmetadata'
    def escape_meta(value):
        return str(value).replace('\\', '\\\\').replace('=', '\\=').replace(';', '\\;').replace('#', '\\#').replace('\n', ' ')
    metadata.write_text(';FFMETADATA1\n' + ''.join(
        f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(ch["start"] * 1000)}\n'
        f'END={round((ch["start"] + ch["duration"]) * 1000)}\ntitle={escape_meta(ch["title"])}\n'
        for ch in rows), encoding='utf-8')
    final = out / 'video.mp4'
    # One loudness measurement across the whole film, not separate chapter targets.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(joined), '-i', str(metadata), '-map', '0:v:0', '-map', '0:a:0',
                    '-map_metadata', '1', '-map_chapters', '1', '-c:v', 'copy', '-c:a', 'aac',
                    '-b:a', '192k', '-ar', '48000', '-ac', '2', '-af', whole_film_audio_filter(joined),
                    '-t', f'{offset:.6f}', '-movflags', '+faststart', str(final)], check=True)
    joined.unlink()
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                                               '-of', 'json', str(final)]))
    vs = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    actual = float(probe['format']['duration'])
    if (vs['width'], vs['height']) != tuple(profile[:2]) or abs(actual - offset) > .25:
        raise RuntimeError(f'final media does not match planned output: {actual} vs {offset}')
    captions = [(ch['start'] + a, ch['start'] + e, text) for ch in rows for a, e, text in ch['captions']]
    (out / 'captions.srt').write_text('\n'.join(
        f'{i}\n{timestamp(a)} --> {timestamp(e)}\n{text}\n'
        for i, (a, e, text) in enumerate(captions, 1)), encoding='utf-8')
    # Chapters may share a "listGroup" so the description's chapter list keeps every
    # entry >= 10 s (YouTube requirement) while the film keeps fine-grained chapters.
    groups = {ch['id']: ch.get('listGroup') for ch in b['chapters']}
    listing = []
    for ch in rows:
        g = groups.get(ch['id'])
        if g and listing and listing[-1].get('group') == g:
            listing[-1]['duration'] += ch['duration']
            continue
        listing.append({'title': g or ch['title'], 'start': ch['start'], 'duration': ch['duration'], 'group': g})
    chapter_lines = []
    for ch in listing:
        secs = int(ch['start'])
        h, rem = divmod(secs, 3600)
        m, s = divmod(rem, 60)
        chapter_lines.append((f'{h}:{m:02}:{s:02}' if h else f'{m:02}:{s:02}') + ' ' + ch['title'])
    (out / 'chapters.txt').write_text('\n'.join(chapter_lines) + '\n', encoding='utf-8')
    credits = []
    for ch in b['chapters']:
        cb = chapter_brief(b, ch)
        credits.extend(line for line in review.credits(cb, lock) if '(own footage)' not in line)
        for src in sources(cb):
            m = lock[src]
            if m['provider'] == 'local':
                credits.append(f"素材: {m.get('author')} / {m.get('pageUrl', src)} ({m.get('license')})")
    (out / 'description.txt').write_text('\n'.join([b['title'], *b.get('descriptionLines', []), '',
        *chapter_lines, '', *dict.fromkeys(credits)]) + '\n', encoding='utf-8')
    write_json(out / 'sources.lock.json', lock)
    write_json(out / 'longform.json', {k: v for k, v in b.items() if k != '_dir'})
    write_json(out / 'timeline.json', rows)
    warnings = []
    if b.get('voice', {}).get('engine') == 'none':
        warnings.append('Narration disabled: timing estimates/silent sections are not final speech.')
    if len(rows) < 3 or any(ch['duration'] < 10 for ch in rows):
        warnings.append('YouTube automatic chapters may not be eligible (needs 3+ chapters of 10s+).')
    report = {'status': 'technical_pass', 'editorial': 'unreviewed', 'audience': 'unverified',
              'duration': actual, 'plannedDuration': offset, 'profile': profile_name,
              'width': vs['width'], 'height': vs['height'], 'reusedChapters': reused,
              'videoSha256': digest(final), 'warnings': warnings}
    cards = ''.join(f'<section><h2>{html.escape(ch["title"])}</h2><p>{ch["start"]:.2f}s +{ch["duration"]:.2f}s</p>'
                    f'<a href="chapters/{ch["id"]}/video.mp4">Chapter MP4</a><br>'
                    f'<img src="chapters/{ch["id"]}/contact-sheet.jpg" style="max-width:100%"></section>' for ch in rows)
    (out / 'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        f'<title>{html.escape(b["title"])}</title><body style="max-width:1100px;margin:30px auto;background:#101318;color:white;font-family:sans-serif">'
        f'<h1>{html.escape(b["title"])}</h1><p>Technical pass / Editorial unreviewed / Audience unverified</p>'
        '<video controls style="width:100%" src="video.mp4"><track kind="subtitles" src="captions.vtt" srclang="ja" label="日本語"></video>'
        '<p><a href="captions.srt">SRT</a> · <a href="description.txt">Description / credits</a> · <a href="scorecard.md">Review</a></p>'
        + cards + '</body>', encoding='utf-8')
    (out / 'captions.vtt').write_text('WEBVTT\n\n' + '\n'.join(
        f'{timestamp(a).replace(",", ".")} --> {timestamp(e).replace(",", ".")}\n{text}\n' for a, e, text in captions), encoding='utf-8')
    scorecard = out / 'scorecard.md'
    # Blank on every new cut: previous editorial scores cannot approve changed footage.
    scorecard.write_text('# Long-form editorial review\n\nVideo SHA256: ' + report['videoSha256'] + '\n\n'
        'Status: unreviewed. Watch the full MP4 and listen before scoring.\n\n'
        '| Axis | 1–5 | Timestamp / evidence |\n|---|---|---|\n' + ''.join(f'| {axis} | | |\n' for axis in
        ('Opening promise', 'Chapter progression / no padding', 'Visual evidence', 'Payoff', 'Speech / captions / sound', 'Distinctive value')) +
        '\nAll 4+ is provisional editorial approval, never an audience result.\n', encoding='utf-8')
    write_json(out / 'report.json', report)
    print(json.dumps(report, ensure_ascii=False))
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    n = sub.add_parser('new')
    n.add_argument('id')
    n.add_argument('--title', required=True)
    for command in ('check', 'find', 'lock', 'render'):
        c = sub.add_parser(command)
        c.add_argument('brief')
        if command == 'render':
            c.add_argument('--profile', choices=PROFILES, default='draft')
            c.add_argument('--force', action='store_true')
    a = p.parse_args()
    if a.command == 'new':
        if not ID.fullmatch(a.id):
            p.error('unsafe id')
        target = ROOT / 'productions' / a.id / 'longform.json'
        if target.exists():
            p.error('production exists')
        template = json.loads((ROOT / 'templates' / 'longform.json').read_text())
        template['id'], template['title'] = a.id, a.title
        write_json(target, template)
        print(target)
        return
    b = load(a.brief)
    if a.command == 'check':
        print('OK', b['id'], len(b['chapters']), 'chapters; editorial review still required')
    elif a.command == 'find':
        footage.find(flattened(b))
    elif a.command == 'lock':
        footage.lock(flattened(b))
    else:
        run(a.brief, a.profile, a.force)


if __name__ == '__main__':
    main()
