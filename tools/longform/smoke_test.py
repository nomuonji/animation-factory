"""Real codec integration: chapter joins, subtitles, source/cache integrity; never content."""
import copy
import json
import os
import pathlib
import shutil
import subprocess
import sys

import longform as L


def main():
    duration = 62 if '--long' in sys.argv else 3
    root = L.ROOT / 'outputs' / 'longform-fixture'
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True, exist_ok=True)
    source = root / 'owned.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'testsrc2=size=320x180:rate=12', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
                    '-t', str(duration + 1), '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', str(source)], check=True)
    src = 'local:owned.mp4'
    b = {'version': 1, 'id': 'longform-smoke', 'title': 'SYNTHETIC CODEC TEST — DO NOT PUBLISH',
         'audience': 'pipeline maintainers', 'question': 'Do chapter boundaries preserve media and captions?',
         'payoff': 'A verified joined file', 'voice': {'engine': 'none'}, 'chapters': []}
    for i in range(3):
        b['chapters'].append({'id': f'part-{i}', 'title': f'Part {i}', 'purpose': 'Integration probe',
          'beats': [{'id': f'beat-{i}', 'why': 'Timestamp and caption probe', 'hold': 0,
             'clip': {'src': src, 'in': 0, 'out': duration,
                      'lines': [{'en': f'章 {i}: 日本語字幕の検証', 'at': 0, 'to': duration}]},
             'shots': [{'src': src, 'in': 0, 'frame': 'fit'}]}]})
    path = root / 'longform.json'
    L.write_json(path, b)
    loaded = L.load(path)
    import footage
    lock = footage.lock(L.flattened(loaded))
    output = L.ROOT / 'outputs' / 'longform' / b['id'] / 'draft'
    shutil.rmtree(output, ignore_errors=True)
    first = L.run(path, profile_override=(640, 360, 12))
    assert abs(first['duration'] - duration * 3) < .25, first
    assert not first['reusedChapters']
    timeline = json.loads((output / 'timeline.json').read_text())
    assert [ch['start'] for ch in timeline] == [0, duration, duration * 2]
    srt = (output / 'captions.srt').read_text()
    assert L.timestamp(duration * 2) in srt and '章 2' in srt
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(output / 'video.mp4')]))
    chapter_probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_chapters', '-of', 'json', str(output / 'video.mp4')]))
    assert len(chapter_probe['chapters']) == 3
    assert abs(float(chapter_probe['chapters'][2]['start_time']) - duration * 2) < .001
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    assert int(audio['sample_rate']) == 48000 and audio['channels'] == 2
    second = L.run(path, profile_override=(640, 360, 12))
    assert second['reusedChapters'] == ['part-0', 'part-1', 'part-2']
    cb = L.chapter_brief(loaded, loaded['chapters'][0])
    before = L.fingerprint(cb, lock, (640, 360, 12))
    changed = copy.deepcopy(cb)
    changed['beats'][0]['shots'][0]['in'] = .1
    assert before != L.fingerprint(changed, lock, (640, 360, 12))
    # Corrupt cached output: cannot be silently reused.
    receipt = json.loads((output / 'chapters/part-0/receipt.json').read_text())
    movie = output / 'chapters/part-0/video.mp4'
    movie.write_bytes(movie.read_bytes() + b'corrupt')
    assert L.cached(movie.parent, receipt['key']) is None
    # Edited local footage must be rejected without deleting the author's original.
    source.write_bytes(source.read_bytes() + b'changed')
    try:
        L.verified_sources(cb, lock)
        raise AssertionError('edited source accepted')
    except ValueError:
        assert source.exists()
    # No failed-run remnants in the integration artifact: restore original bytes.
    source.write_bytes(source.read_bytes()[:-7])
    movie.write_bytes(movie.read_bytes()[:-7])
    if os.environ.get('LONGFORM_TEST_VOICE'):
        vb = copy.deepcopy(cb)
        vb['voice'] = {'engine': 'voicevox', 'speaker': '青山龍星', 'speed': 1.08}
        vb['beats'] = [{'id': 'spoken', 'why': 'Check real speech timing',
                        'say': '長い動画も／章ごとに作れます。',
                        'shots': [{'src': src, 'in': 0}]}]
        # Voice test uses the longer fixture to leave sufficient footage.
        with L.landscape((640, 360, 12)) as R:
            tl = R.build_timeline(vb, lock)
        assert tl['beats'][0]['speech']['pcm'].any()
        assert len(tl['beats'][0]['captions']) == 2
    print('PASS: join, 48k stereo, Japanese captions, chapter offsets, resume, invalidation, safe source mismatch')


if __name__ == '__main__':
    main()
