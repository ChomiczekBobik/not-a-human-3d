# make_textures2.py — текстуры v2 для «Нет, я не величанин».
# Апгрейд базовых (1024px, больше деталей) + новые: обои, плитка, бетон, иней,
# мел-крест, газета, афиши и ценники новых товаров, коробки, фото Марека.
# Запуск: set "PYTHONUTF8=1" & py tools\make_textures2.py

import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)
random.seed(7)

FONT = r'C:\Windows\Fonts\arial.ttf'
FONTB = r'C:\Windows\Fonts\arialbd.ttf'


def f(size, bold=False):
    return ImageFont.truetype(FONTB if bold else FONT, size)


def tileable_blur(w, h, r=6):
    base = Image.new('L', (w, h))
    px = base.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = random.randint(0, 255)
    return base.filter(ImageFilter.GaussianBlur(r))


def wrap_draw(im, fn, pad=8):
    """Рисуем на увеличенном холсте и заворачиваем края — бесшовность."""
    w, h = im.size
    big = Image.new('RGB', (w + 2 * pad, h + 2 * pad))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            big.paste(im, (pad + dx * w, pad + dy * h))
    d = ImageDraw.Draw(big, 'RGBA')
    fn(d, w + 2 * pad, h + 2 * pad)
    return big.crop((pad, pad, pad + w, pad + h))


def grain(im, a=10):
    w, h = im.size
    n = tileable_blur(w, h, 2).point(lambda v: int((v - 128) * a / 32))
    return ImageChops.add(im, Image.merge('RGB', [n, n, n]))


# ---------------------------------------------------------------- базовые
def plaster(name, base, size=1024, damp=110, cracks=22, bottom_grime=True):
    w = h = size
    tex = Image.new('RGB', (w, h), base)
    n = tileable_blur(w, h, 8).point(lambda v: int(v * 0.14))
    tex = ImageChops.add(tex, Image.merge('RGB', [n, n, n]))

    def paint(d, W, H):
        # крупные пятна сырости с потёками вниз
        for _ in range(damp):
            x, y = random.randrange(W), random.randrange(H)
            r = random.randint(12, 110)
            a = random.randint(5, 20)
            d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6],
                      fill=(random.randint(18, 46), random.randint(20, 46), random.randint(18, 44), a))
            if random.random() < 0.3:  # потёк
                ln = random.randint(20, 130)
                d.line([(x, y), (x + random.randint(-4, 4), y + ln)],
                       fill=(30, 32, 34, max(8, a // 2)), width=random.randint(1, 3))
        # трещины с ветвлением
        for _ in range(cracks):
            x, y = random.randrange(W), random.randrange(H)
            ang = random.random() * 6.28
            pts = [(x, y)]
            for _ in range(random.randint(4, 10)):
                ang += random.uniform(-0.7, 0.7)
                x += math.cos(ang) * random.randint(18, 55)
                y += math.sin(ang) * random.randint(18, 55)
                pts.append((x, y))
            d.line(pts, fill=(28, 26, 24, 110), width=1)
            if random.random() < 0.5:
                d.line([pts[len(pts) // 2], pts[-1]], fill=(28, 26, 24, 70), width=1)
        # сколы штукатурки
        for _ in range(8):
            x, y = random.randrange(W), random.randrange(H)
            r = random.randint(4, 12)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(base[0] - 26, base[1] - 26, base[2] - 24, 160))
    tex = wrap_draw(tex, paint)
    if bottom_grime:
        # грязь снизу (плинтус) — градиент, тайлится плохо, поэтому полупрозрачный низ
        g = Image.new('L', (w, h), 0)
        dg = ImageDraw.Draw(g)
        for y in range(int(h * 0.75), h):
            dg.line([(0, y), (w, y)], fill=int(70 * (y - h * 0.75) / (h * 0.25)))
        dark = Image.new('RGB', (w, h), (34, 32, 30))
        tex = Image.composite(ImageChops.multiply(tex, Image.new('RGB', (w, h), (218, 218, 218))), tex, g)
    tex = tex.filter(ImageFilter.GaussianBlur(0.5))
    tex = grain(tex, 8)
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def wood(name, base, size=1024, plank_h=128, dark=0.45):
    """Доски: волокна дугами, сучки, гвозди, фаска по краю доски."""
    w = h = size
    tex = Image.new('RGB', (w, h), base)
    d = ImageDraw.Draw(tex, 'RGBA')
    for row in range(h // plank_h):
        y0 = row * plank_h
        shade = random.randint(-10, 10)
        col = (base[0] + shade, base[1] + shade, base[2] + shade)
        d.rectangle([0, y0, w, y0 + plank_h], fill=col + (255,))
        # волокна: длинные дуги
        for _ in range(70):
            yy = y0 + random.randrange(plank_h)
            x0 = random.randrange(w)
            ln = random.randint(60, 320)
            bend = random.randint(-2, 2)
            pts = [(x0 + t, yy + int(math.sin(t / 40) * bend)) for t in range(0, ln, 12)]
            dv = random.randint(-16, 8)
            d.line(pts, fill=(col[0] + dv, col[1] + dv, col[2] + dv, 46), width=1)
        # сучки
        if random.random() < 0.75:
            kx = random.randrange(w)
            ky = y0 + plank_h // 2 + random.randint(-20, 20)
            for r, a in [(10, 90), (6, 120), (3, 150)]:
                d.ellipse([kx - r, ky - r * 0.6, kx + r, ky + r * 0.6],
                          fill=(col[0] - 22 - r, col[1] - 20 - r, col[2] - 16 - r, a))
        # фаска: светлая линия сверху, тёмная снизу
        d.line([(0, y0 + 1), (w, y0 + 1)], fill=(col[0] + 30, col[1] + 26, col[2] + 22, 120), width=1)
        d.line([(0, y0 + plank_h - 1), (w, y0 + plank_h - 1)], fill=(20, 14, 10, 200), width=2)
        # поперечный стык + гвозди
        off = random.randrange(60, w - 60)
        d.line([(off, y0), (off, y0 + plank_h)], fill=(24, 17, 12, 170), width=2)
        d.ellipse([off + 7, y0 + 8, off + 10, y0 + 11], fill=(70, 68, 66, 180))
        d.ellipse([off - 11, y0 + plank_h - 12, off - 8, y0 + plank_h - 9], fill=(70, 68, 66, 180))
    tex = tex.filter(ImageFilter.GaussianBlur(0.35))
    tex = grain(tex, 9)
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def snow(name, size=1024):
    w = h = size
    tex = Image.new('RGB', (w, h), (216, 222, 232))
    d = ImageDraw.Draw(tex, 'RGBA')
    for _ in range(5200):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(1, 6)
        v = random.randint(-24, 12)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(216 + v, 222 + v, 232 + v, 110))
    # блёстки-кристаллы
    for _ in range(900):
        x, y = random.randrange(w), random.randrange(h)
        d.point((x, y), fill=(255, 255, 255, 200))
    # серые пятна пыли (ядерная пыль)
    for _ in range(60):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(30, 130)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(148, 150, 148, random.randint(4, 16)))
    tex = tex.filter(ImageFilter.GaussianBlur(1.1))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=90)


def store_floor(name, size=1024, tile=128):
    w = h = size
    tex = Image.new('RGB', (w, h), (176, 173, 163))
    d = ImageDraw.Draw(tex, 'RGBA')
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            c = 166 + random.randint(-7, 9)
            d.rectangle([x, y, x + tile - 3, y + tile - 3], fill=(c, c - 2, c - 9))
            # блик по краю плитки
            d.line([(x, y), (x + tile - 3, y)], fill=(c + 14, c + 12, c + 6, 90), width=2)
            if random.random() < 0.14:
                d.rectangle([x, y, x + tile - 3, y + tile - 3], fill=(c - 30, c - 30, c - 36))
    # швы
    for v in range(0, h + 1, tile):
        d.line([(0, v - 1), (w, v - 1)], fill=(118, 115, 108), width=3)
        d.line([(v - 1, 0), (v - 1, h)], fill=(118, 115, 108), width=3)
    # затёртости
    for _ in range(70):
        x, y = random.randrange(w), random.randrange(h)
        ln = random.randint(10, 50)
        d.line([(x, y), (x + ln, y + random.randint(-4, 4))], fill=(120, 118, 112, 40), width=2)
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=90)


def metal(name, size=512):
    tex = Image.new('RGB', (size, size), (136, 140, 144))
    d = ImageDraw.Draw(tex, 'RGBA')
    for y in range(0, size, 3):
        d.line([(0, y), (size, y)], fill=(154, 158, 162, 46), width=1)
    # перфорация полок
    for gy in range(24, size - 12, 56):
        for gx in range(24, size - 12, 40):
            d.ellipse([gx, gy, gx + 5, gy + 5], fill=(66, 68, 72, 150))
    for _ in range(500):
        x, y = random.randrange(size), random.randrange(size)
        d.point((x, y), fill=(92, 94, 98, random.randint(30, 90)))
    for _ in range(26):
        x = random.randrange(size)
        y0 = random.randrange(size)
        d.line([(x, y0), (x + random.randint(-3, 3), y0 + random.randint(14, 90))],
               fill=(126, 82, 46, 46), width=random.randint(1, 3))
    tex = tex.filter(ImageFilter.GaussianBlur(0.3))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def concrete(name, base=(92, 92, 94), size=1024):
    w = h = size
    tex = Image.new('RGB', (w, h), base)
    n = tileable_blur(w, h, 10).point(lambda v: int(v * 0.20))
    tex = ImageChops.add(tex, Image.merge('RGB', [n, n, n]))

    def paint(d, W, H):
        # раковины-пузыри
        for _ in range(260):
            x, y = random.randrange(W), random.randrange(H)
            r = random.randint(1, 4)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(58, 58, 60, 200))
        # тёмные разводы влаги
        for _ in range(70):
            x, y = random.randrange(W), random.randrange(H)
            r = random.randint(24, 120)
            d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5],
                      fill=(52, 54, 58, random.randint(8, 26)))
        # трещины
        for _ in range(16):
            x, y = random.randrange(W), random.randrange(H)
            ang = random.random() * 6.28
            pts = [(x, y)]
            for _ in range(random.randint(5, 12)):
                ang += random.uniform(-0.8, 0.8)
                x += math.cos(ang) * random.randint(20, 60)
                y += math.sin(ang) * random.randint(20, 60)
                pts.append((x, y))
            d.line(pts, fill=(40, 40, 42, 130), width=1)
        # швы опалубки
        for v in range(0, W, 256):
            d.line([(v, 0), (v, H)], fill=(70, 70, 72, 120), width=3)
            d.line([(v + 4, 0), (v + 4, H)], fill=(110, 110, 112, 60), width=1)
    tex = wrap_draw(tex, paint)
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def tiles_kitchen(name, size=512, tile=128):
    w = h = size
    tex = Image.new('RGB', (w, h), (208, 202, 188))
    d = ImageDraw.Draw(tex, 'RGBA')
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            c = 202 + random.randint(-8, 8)
            d.rectangle([x + 2, y + 2, x + tile - 2, y + tile - 2], fill=(c, c - 4, c - 16))
            if random.random() < 0.12:  # скол
                cx, cy = x + random.randint(10, tile - 10), y + random.randint(10, tile - 10)
                d.pieslice([cx - 8, cy - 8, cx + 8, cy + 8], 0, 360, fill=(150, 144, 132, 220))
    for v in range(0, h + 1, tile):
        d.line([(0, v), (w, v)], fill=(150, 144, 132), width=4)
        d.line([(v, 0), (v, h)], fill=(150, 144, 132), width=4)
    # жирные брызги у плиты
    for _ in range(50):
        x, y = random.randrange(w), random.randrange(h)
        d.ellipse([x, y, x + random.randint(1, 5), y + random.randint(1, 5)],
                  fill=(170, 156, 128, random.randint(40, 110)))
    tex = tex.filter(ImageFilter.GaussianBlur(0.3))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=90)


def wallpaper(name, size=1024):
    """Выцветшие обои в цветочек — спальня."""
    w = h = size
    base = (148, 128, 106)
    tex = Image.new('RGB', (w, h), base)
    d = ImageDraw.Draw(tex, 'RGBA')
    step = 128
    for gy in range(0, h, step):
        for gx in range(0, w, step):
            ox = (gy // step % 2) * (step // 2)
            cx, cy = gx + ox + step // 2, gy + step // 2
            for i in range(6):
                a = i * math.pi / 3
                px, py = cx + math.cos(a) * 16, cy + math.sin(a) * 16
                d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(168, 132, 122, 200))
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(120, 104, 74, 220))
            d.line([(cx, cy + 14), (cx, cy + 40)], fill=(118, 122, 84, 190), width=2)
            d.ellipse([cx - 8, cy + 34, cx + 2, cy + 44], fill=(118, 122, 84, 150))

    def paint(dd, W, H):
        # выцветание и сырость
        for _ in range(90):
            x, y = random.randrange(W), random.randrange(H)
            r = random.randint(20, 100)
            dd.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7],
                       fill=(96, 88, 74, random.randint(6, 22)))
    tex = wrap_draw(tex, paint)
    tex = grain(tex, 8)
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def rug(name, size=512):
    """Ковёр: бордюр, медальоны, потёртость."""
    w = h = size
    tex = Image.new('RGB', (w, h), (96, 44, 44))
    d = ImageDraw.Draw(tex, 'RGBA')
    d.rectangle([8, 8, w - 8, h - 8], outline=(196, 168, 96), width=6)
    d.rectangle([26, 26, w - 26, h - 26], outline=(60, 28, 32), width=3)
    cx, cy = w // 2, h // 2
    for r, col in [(120, (66, 32, 40)), (90, (150, 120, 70)), (60, (66, 32, 40))]:
        d.ellipse([cx - r, cy - r * 0.75, cx + r, cy + r * 0.75], outline=col, width=5)
    d.ellipse([cx - 34, cy - 26, cx + 34, cy + 26], fill=(120, 52, 48))
    for gx in range(70, w - 40, 90):
        d.ellipse([gx, 40, gx + 24, 58], outline=(150, 120, 70), width=3)
        d.ellipse([gx, h - 58, gx + 24, h - 40], outline=(150, 120, 70), width=3)
    # потёртости
    for _ in range(60):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(6, 26)
        d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=(80, 60, 52, random.randint(10, 30)))
    tex = tex.filter(ImageFilter.GaussianBlur(0.6))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


# ---------------------------------------------------------------- прозрачные
def blood_decal(name, size=256):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = size // 2
    for _ in range(26):
        r = random.randint(8, 34)
        x = cx + random.randint(-40, 40)
        y = cy + random.randint(-40, 40)
        d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8],
                  fill=(96, 14, 12, random.randint(120, 210)))
    for _ in range(46):
        r = random.randint(2, 7)
        ang = random.random() * 6.28
        dist = random.randint(40, 115)
        x = cx + math.cos(ang) * dist
        y = cy + math.sin(ang) * dist * 0.8
        d.ellipse([x - r, y - r, x + r, y + r], fill=(90, 12, 10, random.randint(90, 180)))
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    im.save(os.path.join(OUT, name + '.png'))


def chalk_cross(name, size=256):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = (238, 238, 232)
    for _ in range(9):  # много штрихов мелом
        jit = random.randint(-4, 4)
        d.line([(size * 0.5 - 34 + jit, 30 + jit), (size * 0.5 + 34 + jit, size - 30 + jit)],
               fill=c + (random.randint(150, 230),), width=random.randint(6, 11))
        d.line([(30 + jit, size * 0.5 - 34 + jit), (size - 30 + jit, size * 0.5 + 34 + jit)],
               fill=c + (random.randint(150, 230),), width=random.randint(6, 11))
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    im.save(os.path.join(OUT, name + '.png'))


def frost(name, size=512):
    """Иней по краям стекла (углы плотнее)."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def crystal(x, y, r, alpha):
        for i in range(6):
            a = i * math.pi / 3
            d.line([(x, y), (x + math.cos(a) * r, y + math.sin(a) * r)],
                   fill=(220, 232, 244, alpha), width=1)
            d.line([(x + math.cos(a) * r * 0.5, y + math.sin(a) * r * 0.5),
                    (x + math.cos(a + 0.5) * r * 0.7, y + math.sin(a + 0.5) * r * 0.7)],
                   fill=(220, 232, 244, alpha - 30), width=1)
    for corner in [(0, 0), (size, 0), (0, size), (size, size)]:
        for _ in range(160):
            x = corner[0] + random.gauss(0, size * 0.16)
            y = corner[1] + random.gauss(0, size * 0.16)
            if 0 <= x < size and 0 <= y < size:
                crystal(x, y, random.randint(4, 16), random.randint(60, 130))
    # иней по нижней кромке
    for _ in range(220):
        x = random.randrange(size)
        y = size - abs(random.gauss(0, size * 0.06))
        if y >= size:
            y = size - 1
        crystal(x, y, random.randint(3, 12), random.randint(70, 140))
    im.save(os.path.join(OUT, name + '.png'))


def newspaper(name, w=512, h=640):
    im = Image.new('RGB', (w, h), (226, 220, 202))
    d = ImageDraw.Draw(im)
    d.rectangle([10, 10, w - 10, h - 10], outline=(120, 112, 96), width=2)
    hf = f(44, True)
    d.text((24, 26), 'ВЕЛИЧАНСКИЙ', font=hf, fill=(40, 38, 34))
    d.text((24, 74), 'ВЕСТНИК', font=hf, fill=(40, 38, 34))
    d.text((w - 130, 34), '№ 214', font=f(20), fill=(90, 84, 74))
    d.line([(24, 106), (w - 24, 106)], fill=(60, 56, 50), width=3)
    # колонки «текста»
    for col in range(3):
        x0 = 24 + col * ((w - 48) // 3)
        for y in range(130, h - 40, 12):
            ln = random.randint(60, 140)
            d.line([(x0, y), (x0 + min(ln, (w - 48) // 3 - 6), y)], fill=(96, 92, 84), width=3)
    # фото-плашка
    d.rectangle([w // 2 - 60, 240, w // 2 + 60, 330], fill=(150, 146, 136))
    d.text((w // 2 - 52, 284), 'ФОТО', font=f(18), fill=(90, 86, 78))
    # сажа и пятна
    for _ in range(30):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(4, 30)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(160, 150, 130, random.randint(20, 60)))
    im = im.filter(ImageFilter.GaussianBlur(0.3))
    im.save(os.path.join(OUT, name + '.jpg'), quality=86)


def note_paper(name, w=256, h=192):
    im = Image.new('RGB', (w, h), (232, 226, 206))
    d = ImageDraw.Draw(im)
    for y in range(36, h - 10, 18):
        d.line([(14, y), (w - 14, y)], fill=(150, 170, 190), width=1)
    # «почерк» — кривые строчки
    for y in range(34, h - 16, 18):
        x = 16
        while x < w - 30:
            ln = random.randint(8, 22)
            d.line([(x, y + random.randint(-2, 2)), (x + ln, y + random.randint(-3, 3))],
                   fill=(60, 60, 110, 220), width=2)
            x += ln + 4
    d.line([(w - 40, 0), (w - 10, 0), (w - 40, 30)], fill=(200, 196, 184))  # загнутый угол
    im.save(os.path.join(OUT, name + '.png'))


# ---------------------------------------------------------------- полиграфия
def poster(name, w, h, bg, title, sub, price=None, accent=(200, 40, 40), accent2=(28, 26, 22)):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([6, 6, w - 7, h - 7], outline=accent, width=4)
    ts = int(h * 0.28)
    tf = f(ts, True)
    tw = d.textlength(title, font=tf)
    d.text(((w - tw) / 2, h * 0.08), title, font=tf, fill=accent2)
    if sub:
        sf = f(int(h * 0.11))
        sw = d.textlength(sub, font=sf)
        d.text(((w - sw) / 2, h * 0.46), sub, font=sf, fill=(60, 40, 30))
    if price:
        pf = f(int(h * 0.24), True)
        pw = d.textlength(price, font=pf)
        d.text(((w - pw) / 2, h * 0.66), price, font=pf, fill=accent)
    # лёгкая типографская пыль
    for _ in range(200):
        x, y = random.randrange(w), random.randrange(h)
        d.point((x, y), fill=(0, 0, 0, 18))
    im.save(os.path.join(OUT, name + '.png'))


def price_tag(name, w, h, label, price, sub='', was=None):
    im = Image.new('RGB', (w, h), (240, 238, 228))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, h - 1], outline=(172, 168, 154), width=2)
    d.rectangle([0, 0, w - 1, int(h * 0.28)], fill=(226, 56, 46))
    lf = f(int(h * 0.18), True)
    lw = d.textlength(label, font=lf)
    d.text(((w - lw) / 2, h * 0.03), label, font=lf, fill=(255, 250, 244))
    pf = f(int(h * 0.30), True)
    pw = d.textlength(price, font=pf)
    d.text(((w - pw) / 2, h * 0.32), price, font=pf, fill=(28, 28, 28))
    if was:
        wf = f(int(h * 0.16))
        wasp = f'{was}'
        pw2 = d.textlength(wasp, font=wf)
        d.text(((w - pw2) / 2, h * 0.62), wasp, font=wf, fill=(160, 60, 50))
        d.line([(w - pw2) / 2, h * 0.70, (w + pw2) / 2, h * 0.70], fill=(160, 60, 50), width=3)
        sub_y = h * 0.80
    else:
        sub_y = h * 0.68
    if sub:
        sf = f(int(h * 0.13))
        sw = d.textlength(sub, font=sf)
        d.text(((w - sw) / 2, sub_y), sub, font=sf, fill=(110, 104, 92))
    im.save(os.path.join(OUT, name + '.png'))


def sign(name, w, h, text, bg=(214, 40, 52), fg=(255, 248, 240)):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    size = int(h * 0.52)
    ft = f(size, True)
    tw = d.textlength(text, font=ft)
    d.text(((w - tw) / 2, (h - size * 1.15) / 2), text, font=ft, fill=fg)
    im.save(os.path.join(OUT, name + '.png'))


def aisle_sign(name, w, h, num, text, bg=(240, 206, 60), fg=(40, 36, 28)):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    nf = f(int(h * 0.62), True)
    d.text((int(w * 0.05), int(h * 0.14)), num, font=nf, fill=(190, 40, 40))
    tf = f(int(h * 0.26), True)
    d.text((int(w * 0.24), int(h * 0.36)), text, font=tf, fill=fg)
    d.rectangle([0, 0, w - 1, h - 1], outline=(120, 110, 80), width=3)
    im.save(os.path.join(OUT, name + '.png'))


def box_tex(name, label, bg, size=256, sub=None):
    """Лицевая сторона продуктовой коробки."""
    im = Image.new('RGB', (size, size), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([6, 6, size - 6, size - 6], outline=(30, 26, 22), width=3)
    # «окошко» с продуктом
    d.rectangle([size * 0.18, size * 0.30, size * 0.82, size * 0.68], fill=(236, 232, 222))
    d.ellipse([size * 0.3, size * 0.36, size * 0.7, size * 0.62], fill=bg)
    lf = f(int(size * 0.11), True)
    lw = d.textlength(label, font=lf)
    d.text(((size - lw) / 2, size * 0.09), label, font=lf, fill=(28, 26, 22))
    if sub:
        sf = f(int(size * 0.07))
        sw = d.textlength(sub, font=sf)
        d.text(((size - sw) / 2, size * 0.72), sub, font=sf, fill=(70, 64, 54))
    # штрих-код
    x = size * 0.2
    while x < size * 0.8:
        wq = random.randint(2, 5)
        d.rectangle([x, size * 0.82, x + wq, size * 0.93], fill=(20, 20, 20))
        x += wq + random.randint(2, 5)
    im = im.filter(ImageFilter.GaussianBlur(0.25))
    im.save(os.path.join(OUT, name + '.jpg'), quality=88)


def photo(name, w=256, h=320, seed=1, style='sepia'):
    random.seed(seed)
    im = Image.new('RGB', (w, h), (200, 190, 168))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, int(h * 0.55)], fill=(150, 160, 168))
    d.rectangle([0, int(h * 0.55), w, h], fill=(120, 118, 100))
    # Магазин на фоне — для фото у кассы
    if style == 'store':
        d.rectangle([int(w * 0.6), int(h * 0.35), int(w * 0.95), int(h * 0.55)], fill=(180, 176, 160))
        d.rectangle([int(w * 0.63), int(h * 0.38), int(w * 0.92), int(h * 0.5)], fill=(220, 210, 180))
    for i in range(random.randint(2, 3)):
        cx = random.randint(int(w * 0.15), int(w * 0.7))
        cy = int(h * 0.62)
        hh = random.randint(50, 80)
        d.ellipse([cx - 12, cy - hh, cx + 12, cy - hh + 24], fill=(52, 48, 44))
        d.rectangle([cx - 16, cy - hh + 22, cx + 16, cy], fill=(52, 48, 44))
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    sep = Image.new('RGB', (w, h), (196, 168, 128))
    im = ImageChops.multiply(im, sep)
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    im.save(os.path.join(OUT, name + '.jpg'), quality=86)


def main():
    # --- апгрейд базовых ---
    plaster('wall_plaster_home', (86, 82, 75))
    plaster('wall_plaster_cold', (72, 76, 82))
    plaster('wall_store', (198, 196, 186), damp=40, cracks=6, bottom_grime=False)
    wood('floor_wood', (72, 52, 35))
    wood('wood_dark', (44, 33, 24), 512, 84)
    snow('snow')
    store_floor('store_floor')
    metal('shelf_metal')
    concrete('concrete')
    tiles_kitchen('tiles_kitchen')
    wallpaper('wallpaper')
    rug('rug')

    # --- прозрачные оверлеи ---
    blood_decal('blood_decal')
    chalk_cross('chalk_cross')
    frost('frost')

    # --- бумага ---
    newspaper('newspaper')
    note_paper('note_paper')

    # --- фото ---
    photo('photo_family', 256, 320, 3)
    photo('photo_town', 320, 256, 9)
    photo('photo_marek', 240, 300, 21, style='store')

    # --- вывески/указатели ---
    sign('sign_biedronka', 1024, 256, 'БЕДРОНКА')
    sign('sign_open', 512, 192, 'ОТКРЫТО', (40, 120, 70))
    sign('sign_exit', 384, 160, 'ВЫХОД', (36, 110, 64))
    sign('sign_kassa', 512, 192, 'КАССА', (30, 30, 34), (240, 234, 220))
    aisle_sign('aisle_1', 640, 192, '1', 'КОНСЕРВЫ · МЯСНОЕ')
    aisle_sign('aisle_2', 640, 192, '2', 'КРУПЫ · МАКАРОНЫ')
    aisle_sign('aisle_3', 640, 192, '3', 'БЫТОВОЕ · СВЕЧИ')

    # --- постеры ---
    poster('poster_butter', 512, 320, (255, 226, 96), 'МАСЛО', 'скидка недели', '-50%')
    poster('poster_bread', 512, 320, (244, 232, 206), 'ХЛЕБ', 'свежий, почти', '4.99')
    poster('poster_nuke', 512, 320, (226, 220, 206), 'НЕ ВЫХОДИТЕ', 'без надобности', '')
    poster('poster_yellow', 512, 320, (240, 202, 48), 'ЖЁЛТЫЕ', 'цены на всё', 'ДО 30%')
    poster('poster_radio', 512, 320, (46, 52, 66), 'СЛУШАЙТЕ', 'ГОС. РАДИО', '18:00', accent=(160, 170, 190), accent2=(230, 232, 240))
    poster('poster_basement', 512, 320, (170, 158, 136), 'СДАВАЙТЕ', 'металлолом', 'ДОРОГО', accent=(120, 60, 40))

    # --- ценники ---
    price_tag('tag_butter', 256, 160, 'МАСЛО', '2.99', 'было 5.99', was='5.99')
    price_tag('tag_bread', 256, 160, 'ХЛЕБ', '4.99', 'кирпичик')
    price_tag('tag_tushonka', 256, 160, 'ТУШЁНКА', '9.99', 'говядина')
    price_tag('tag_sguschenka', 256, 160, 'СГУЩЁНКА', '7.99', 'молоко')
    price_tag('tag_meds', 256, 160, 'ЛЕКАРСТВА', '12.99', 'йод, бинт')
    price_tag('tag_krupa', 256, 160, 'КРУПА', '5.49', 'перловка, 1 кг')
    price_tag('tag_tea', 256, 160, 'ЧАЙ', '6.99', 'чёрный, 100 г')
    price_tag('tag_socks', 256, 160, 'НОСКИ', '8.99', 'шерсть, тёплые')
    price_tag('tag_geiger', 256, 160, 'ДОЗИМЕТР', '14.99', 'прокат в день')
    price_tag('tag_matches', 256, 160, 'СПИЧКИ', '1.99', 'последние')

    # --- коробки товаров ---
    box_tex('box_tea', 'ЧАЙ', (52, 84, 52), sub='байховый')
    box_tex('box_krupa', 'КРУПА', (150, 116, 62), sub='перловая')
    box_tex('box_soap', 'МЫЛО', (72, 96, 130), sub='хозяйственное')
    box_tex('box_cookies', 'ПЕЧЕНЬЕ', (160, 90, 60), sub='«Затулинка»')
    box_tex('box_candles', 'СВЕЧИ', (190, 150, 70), sub='столовые')
    box_tex('box_matches', 'СПИЧКИ', (140, 60, 50), sub='в последнюю очередь')

    print('textures v2 ->', OUT)


if __name__ == '__main__':
    main()
