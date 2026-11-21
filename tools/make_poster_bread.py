# -*- coding: utf-8 -*-
"""Перерисовывает плакат «ХЛЕБ» в «Бедронке»: выдача больше не бесплатная,
поэтому вместо «ПО ВЫДАЧЕ» — «НЕ ШУМИ». Стиль и пятна сохранены."""
import io, os, random
from PIL import Image, ImageDraw, ImageFont

W, H = 512, 320
OUT = os.path.join('assets', 'tex', 'poster_bread.png')
FONT = 'C:/Windows/Fonts/arialbd.ttf'

paper = (232, 221, 198)
ink = (26, 22, 18)
red = (176, 45, 36)
grey = (70, 60, 50)

img = Image.new('RGB', (W, H), paper)
d = ImageDraw.Draw(img)

# лёгкая зернистость бумаги, как на прежнем плакате
random.seed(7)
for _ in range(2600):
    x, y = random.randrange(W), random.randrange(H)
    v = random.randint(-12, 9)
    d.point((x, y), (max(0, min(255, paper[0] + v)), max(0, min(255, paper[1] + v)), max(0, min(255, paper[2] + v))))

# рамка
d.rectangle([6, 6, W - 7, H - 7], outline=red, width=3)
d.rectangle([14, 14, W - 15, H - 15], outline=(196, 180, 150), width=1)

def fit(text, size, maxw):
    f = ImageFont.truetype(FONT, size)
    while d.textlength(text, font=f) > maxw and size > 8:
        size -= 1
        f = ImageFont.truetype(FONT, size)
    return f

def centered(text, font, y, fill):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill)

f1 = fit('ХЛЕБ', 118, W - 90)
centered('ХЛЕБ', f1, 34, ink)
f2 = fit('свежий, почти', 40, W - 120)
centered('свежий, почти', f2, 176, grey)
f3 = fit('НЕ ШУМИ', 92, W - 70)
centered('НЕ ШУМИ', f3, 218, red)

img.save(OUT, optimize=True)
print('poster_bread.png', os.path.getsize(OUT), 'bytes')