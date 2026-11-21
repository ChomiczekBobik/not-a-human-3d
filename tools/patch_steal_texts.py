# -*- coding: utf-8 -*-
"""Тексты под кражу: ценники «БЕРИ ТИХО», реплики Людмилы про норму и взгляд,
подписи кровати и выхода на улицу."""
import io, sys

def load(p):
    return io.open(p, encoding='utf-8').read()

def save(p, s):
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print(p, 'bytes:', len(s.encode('utf-8')))

def rep(s, old, new, label, count=1):
    n = s.count(old)
    if n == 0:
        print('skip (already applied):', label)
        return s
    if n != count:
        print('MISMATCH:', label, 'found', n, 'expected', count)
        sys.exit(1)
    print('ok:', label, 'x', n)
    return s.replace(old, new)

# ---------- src/store.js ----------
p = 'src/store.js'
s = load(p)
before = s
s = rep(s, """  // Таблички выдачи закреплены на вертикальных кромках, а не висят рядом с товаром.""",
        """  // Ценники «бери тихо» закреплены на вертикальных кромках, а не висят рядом с товаром.""",
        'shelf tag comment')
s = rep(s, "'ВЫДАЧА'", "'БЕРИ ТИХО'", 'shop tags', count=6)  # shelfTag + bread + matches + geiger + meds + kolbasa
s = rep(s, "textTag(ITEMS.kolbasa.name, 'ВЫДАЧА',", "textTag(ITEMS.kolbasa.name, 'БЕРИ ТИХО',",
        'kolbasa tag')
if s != before:
    save(p, s)

# ---------- src/story.js ----------
p = 'src/story.js'
s = load(p)
before = s
s = rep(s, "'Масло бери обязательно. По журналу выдачи можно до трёх вещей в день. Я себе тоже взяла — дома кот, он масло уважает, хотя ему нельзя.'",
        "'Масло бери обязательно. По журналу — до трёх вещей в день, а на деле бери, пока я на тебя не смотрю. Я себе тоже взяла — дома кот, он масло уважает, хотя ему нельзя.'",
        'lyudmila butter line')
s = rep(s, "'Масло только, и то по выдаче.'",
        "'Масло только, и то если успеешь взять, пока я не гляну.'",
        'lyudmila river line')
s = rep(s, "Выдача прежняя — до трёх вещей. Хоть что-то в этом мире работает.",
        "Выдача прежняя: до трёх вещей, и не при мне. Хоть что-то в этом мире работает.",
        'lyudmila day7 line')
if s != before:
    save(p, s)

# ---------- src/game.js ----------
p = 'src/game.js'
s = load(p)
before = s
s = rep(s, "'[E] Кровать — сначала рассчитаться за корзину' : '[E] Кровать — сначала купить товар в «Бедронке»'",
        "'[E] Кровать — сначала вынести добычу' : '[E] Кровать — сперва загляни в «Бедронку»'",
        'bed labels')
s = rep(s, "'[E] Домой — сначала купить товар в «Бедронке»'",
        "'[E] Домой — сперва загляни в «Бедронку»'",
        'street home label')
if s != before:
    save(p, s)

print('done')