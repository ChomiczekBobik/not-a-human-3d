# -*- coding: utf-8 -*-
r"""Нарезка пользовательского трека на ночные эмбиенты с бесшовной петлёй.

Вход:  C:\Users\user\Downloads\ambientforgame.mp3 (20:49.62, 44.1 кГц, стерео)
Выход: assets/sfx/night_1.ogg .. night_4.ogg

Части:  1) 0:00-5:00  2) 5:00-10:00  3) 10:00-15:00  4) 15:00-конец (5:49.62)

Бесшовность: последние LOOP_XFADE_S секунд части кроссфейдятся с её началом
(equal-power sin/cos). Тело файла = data[xf:], а хвост заменяется смесью
tail*(1-w) + head*w. На стыке петли: последний сэмпл ~= data[xf-1],
первый сэмпл = data[xf] — форма волны продолжается без щелчка.
WebAudio BufferSource(loop=true) играет такую петлю сэмпл-аккуратно.

Кодирование: моно 44.1 кГц, OGG Vorbis q2 (эмбиенту стерео не нужно,
моно вдвое легче по трафику и по памяти декодированного буфера).

Запуск: python tools\make_night_ambience.py
Зависимости: numpy, imageio-ffmpeg (pip), mutagen (только для отчёта).
"""
import os
import re
import subprocess

import numpy as np
import imageio_ffmpeg

SRC = r'C:\Users\user\Downloads\ambientforgame.mp3'
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sfx')
SR = 44100
LOOP_XFADE_S = 8.0
VORBIS_Q = '2'
SEGMENTS = [(0.0, 300.0), (300.0, 600.0), (600.0, 900.0), (900.0, None)]  # сек; None = до конца
FF = imageio_ffmpeg.get_ffmpeg_exe()


def ffmpeg(args, data=None):
    p = subprocess.run([FF, '-hide_banner', '-loglevel', 'error'] + args,
                       input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError('ffmpeg failed: ' + p.stderr.decode('utf-8', 'replace')[-1500:])
    return p.stdout


def duration_of(path):
    p = subprocess.run([FF, '-hide_banner', '-i', path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', p.stderr.decode('utf-8', 'replace'))
    if not m:
        raise RuntimeError('cannot parse duration')
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def decode_segment(start, length):
    args = ['-ss', f'{start:.3f}', '-i', SRC]
    if length is not None:
        args += ['-t', f'{length:.3f}']
    args += ['-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-acodec', 'pcm_f32le', '-']
    raw = ffmpeg(args)
    return np.frombuffer(raw, dtype='<f4').copy()


def bake_loop(data):
    """Возвращает (body, loop_len_sec): тело = data[xf:], хвост — кроссфейд в начало."""
    xf = int(LOOP_XFADE_S * SR)
    n = len(data)
    if n <= 3 * xf:
        raise RuntimeError(f'сегмент короткий для петли: {n / SR:.1f}s при фейде {LOOP_XFADE_S}s')
    body = data[xf:].copy()
    t = np.linspace(0.0, 1.0, xf, dtype=np.float32)
    w = np.sin(t * (np.pi / 2)).astype(np.float32)  # equal-power: head в, tail из
    body[-xf:] = data[n - xf:] * (1.0 - w) + data[:xf] * w
    peak = float(np.max(np.abs(body)))
    if peak > 0.999:
        body *= 0.999 / peak
    return body, len(body) / SR


def encode_ogg(body, out_path):
    ffmpeg(['-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
            '-c:a', 'libvorbis', '-q:a', VORBIS_Q, '-y', out_path],
           data=body.astype('<f4').tobytes())


def main():
    total = duration_of(SRC)
    print(f'Исходник: {SRC}\nДлительность: {total:.2f}s ({int(total // 60)}:{total % 60:05.2f})')
    os.makedirs(OUT_DIR, exist_ok=True)
    for i, (a, b) in enumerate(SEGMENTS, 1):
        if b is not None and a >= total:
            raise RuntimeError(f'часть {i} за пределами трека')
        end = total if b is None else min(b, total)
        print(f'\n=== night_{i}: {a:.0f}s .. {end:.2f}s ({(end - a):.2f}s) ===')
        seg = decode_segment(a, None if b is None else end - a)
        print(f'  декодировано: {len(seg) / SR:.2f}s')
        body, secs = bake_loop(seg)
        out = os.path.join(OUT_DIR, f'night_{i}.ogg')
        encode_ogg(body, out)
        size = os.path.getsize(out)
        chk = duration_of(out)
        print(f'  -> {out}\n  петля: {secs:.2f}s, ogg: {chk:.2f}s, размер: {size:,} байт ({size / 1048576:.2f} MiB)')


if __name__ == '__main__':
    main()
