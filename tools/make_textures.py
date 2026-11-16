# make_textures.py — процедурные текстуры и постеры для «Нет, я не величанин».
# Запуск: set "PYTHONUTF8=1" & py tools\make_textures.py
# Результат: assets/tex/*.png/jpg

import os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)
random.seed(7)

FONT = r'C:\Windows\Fonts\arial.ttf'
FONTB = r'C:\Windows\Fonts\arialbd.ttf'


def f(size, bold=False):
    return ImageFont.truetype(FONTB if bold else FONT, size)


def noise(w, h, a=18):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            v = random.randint(-a, a)
            px[x, y] = (128 + v, 128 + v, 128 + v)
    return im.convert('L')


def tileable_blur(w, h):
    """Шум, размытый с заворотом краёв (для бесшовности)."""
    base = Image.new('L', (w, h))
    px = base.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = random.randint(0, 255)
    return base.filter(ImageFilter.GaussianBlur(6))


def plaster(name='wall_plaster', base=(78, 76, 72), size=512):
    w = h = size
    tex = Image.new('RGB', (w, h), base)
    n = tileable_blur(w, h)
    n = n.point(lambda v: int(v * 0.10))
    tex = ImageChops.add(tex, Image.merge('RGB', [n, n, n]))
    # пятна сырости
    d = ImageDraw.Draw(tex, 'RGBA')
    for _ in range(90):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(10, 90)
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6],
                  fill=(random.randint(20, 45), random.randint(22, 45), random.randint(20, 42), random.randint(6, 22)))
    # трещины
    for _ in range(14):
        x, y = random.randrange(w), random.randrange(h)
        pts = [(x, y)]
        for _ in range(random.randint(3, 8)):
            x += random.randint(-40, 40)
            y += random.randint(-40, 40)
            pts.append((x, y))
        d.line(pts, fill=(30, 28, 26, 90), width=1)
    tex = tex.filter(ImageFilter.GaussianBlur(0.6))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def wood(name='floor_wood', base=(66, 48, 33), size=512, plank_h=64):
    w = h = size
    tex = Image.new('RGB', (w, h), base)
    d = ImageDraw.Draw(tex, 'RGBA')
    for row in range(h // plank_h):
        y0 = row * plank_h
        shade = random.randint(-12, 12)
        d.rectangle([0, y0, w, y0 + plank_h], fill=(base[0] + shade, base[1] + shade, base[2] + shade, 255))
        # волокна
        for _ in range(60):
            yy = y0 + random.randrange(plank_h)
            x0 = random.randrange(w)
            ln = random.randint(20, 160)
            d.line([(x0, yy), (x0 + ln, yy + random.randint(-1, 1))],
                   fill=(base[0] + shade + random.randint(-18, 10),
                         base[1] + shade + random.randint(-16, 8),
                         base[2] + shade + random.randint(-14, 6), 60), width=1)
        # стык досок
        d.line([(0, y0), (w, y0)], fill=(26, 18, 12, 200), width=2)
        # поперечный стык
        off = random.randrange(w)
        d.line([(off, y0), (off, y0 + plank_h)], fill=(28, 20, 14, 170), width=2)
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def snow(name='snow', size=512):
    w = h = size
    tex = Image.new('RGB', (w, h), (222, 228, 236))
    d = ImageDraw.Draw(tex, 'RGBA')
    for _ in range(2600):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(1, 5)
        v = random.randint(-26, 10)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(222 + v, 228 + v, 236 + v, 120))
    # серые пятна пыли
    for _ in range(40):
        x, y = random.randrange(w), random.randrange(h)
        r = random.randint(30, 110)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(150, 152, 150, random.randint(4, 14)))
    tex = tex.filter(ImageFilter.GaussianBlur(1.4))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=90)


def store_floor(name='store_floor', size=512, tile=64):
    w = h = size
    tex = Image.new('RGB', (w, h), (168, 166, 158))
    d = ImageDraw.Draw(tex)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            c = 158 + random.randint(-6, 8)
            d.rectangle([x, y, x + tile - 2, y + tile - 2], fill=(c, c - 2, c - 8))
            if random.random() < 0.12:
                d.rectangle([x, y, x + tile - 2, y + tile - 2], fill=(c - 26, c - 26, c - 30))
    d.line([(0, h // 2), (w, h // 2)], fill=(120, 118, 112), width=3)
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=90)


def metal(name='shelf_metal', size=256):
    tex = Image.new('RGB', (size, size), (132, 136, 140))
    d = ImageDraw.Draw(tex, 'RGBA')
    for y in range(0, size, 4):
        d.line([(0, y), (size, y)], fill=(150, 154, 158, 40), width=1)
    for _ in range(300):
        x, y = random.randrange(size), random.randrange(size)
        d.point((x, y), fill=(90, 92, 96, random.randint(30, 90)))
    # ржавые потёки
    for _ in range(12):
        x = random.randrange(size)
        y0 = random.randrange(size)
        d.line([(x, y0), (x + random.randint(-3, 3), y0 + random.randint(10, 60))],
               fill=(120, 78, 44, 40), width=random.randint(1, 3))
    tex = tex.filter(ImageFilter.GaussianBlur(0.3))
    tex.save(os.path.join(OUT, name + '.jpg'), quality=88)


def poster(name, w, h, bg, title, sub, price=None, accent=(200, 40, 40)):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    # рамка
    d.rectangle([6, 6, w - 7, h - 7], outline=accent, width=4)
    # заголовок
    ts = int(h * 0.30)
    tf = f(ts, True)
    tw = d.textlength(title, font=tf)
    d.text(((w - tw) / 2, h * 0.10), title, font=tf, fill=(28, 26, 22))
    if sub:
        sf = f(int(h * 0.12))
        sw = d.textlength(sub, font=sf)
        d.text(((w - sw) / 2, h * 0.47), sub, font=sf, fill=(60, 40, 30))
    if price:
        pf = f(int(h * 0.26), True)
        pw = d.textlength(price, font=pf)
        d.text(((w - pw) / 2, h * 0.64), price, font=pf, fill=accent)
    im.save(os.path.join(OUT, name + '.png'))


def price_tag(name, w, h, label, price, sub=''):
    im = Image.new('RGB', (w, h), (238, 236, 226))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, h - 1], outline=(170, 166, 152), width=2)
    d.rectangle([0, 0, w - 1, int(h * 0.30)], fill=(230, 60, 50))
    lf = f(int(h * 0.19), True)
    lw = d.textlength(label, font=lf)
    d.text(((w - lw) / 2, h * 0.04), label, font=lf, fill=(255, 250, 244))
    pf = f(int(h * 0.36), True)
    pw = d.textlength(price, font=pf)
    d.text(((w - pw) / 2, h * 0.33), price, font=pf, fill=(30, 30, 30))
    if sub:
        sf = f(int(h * 0.13))
        sw = d.textlength(sub, font=sf)
        d.text(((w - sw) / 2, h * 0.78), sub, font=sf, fill=(110, 104, 92))
    im.save(os.path.join(OUT, name + '.png'))


def sign(name, w, h, text, bg=(214, 40, 52), fg=(255, 248, 240)):
    im = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(im)
    size = int(h * 0.52)
    ft = f(size, True)
    tw = d.textlength(text, font=ft)
    d.text(((w - tw) / 2, (h - size * 1.15) / 2), text, font=ft, fill=fg)
    im.save(os.path.join(OUT, name + '.png'))


def photo(name, w=256, h=320, seed=1):
    random.seed(seed)
    im = Image.new('RGB', (w, h), (200, 190, 168))
    d = ImageDraw.Draw(im)
    # небо/фон
    d.rectangle([0, 0, w, int(h * 0.55)], fill=(150, 160, 168))
    d.rectangle([0, int(h * 0.55), w, h], fill=(120, 118, 100))
    # силуэты людей
    for i in range(random.randint(2, 3)):
        cx = random.randint(int(w * 0.2), int(w * 0.8))
        cy = int(h * 0.62)
        hh = random.randint(50, 80)
        d.ellipse([cx - 12, cy - hh, cx + 12, cy - hh + 24], fill=(52, 48, 44))
        d.rectangle([cx - 16, cy - hh + 22, cx + 16, cy], fill=(52, 48, 44))
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    # сепия
    sep = Image.new('RGB', (w, h), (196, 168, 128))
    im = ImageChops.multiply(im, sep)
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    im.save(os.path.join(OUT, name + '.jpg'), quality=86)


def main():
    plaster('wall_plaster_home', (82, 78, 72))
    plaster('wall_plaster_cold', (70, 74, 80))
    plaster('wall_store', (196, 194, 184))
    wood('floor_wood', (70, 50, 34))
    wood('wood_dark', (48, 36, 26), 256, 42)
    snow('snow')
    store_floor('store_floor')
    metal('shelf_metal')
    # постеры
    poster('poster_butter', 512, 320, (255, 226, 96), 'МАСЛО', 'скидка недели', '-50%')
    poster('poster_bread', 512, 320, (244, 232, 206), 'ХЛЕБ', 'свежий, почти', '4.99')
    poster('poster_nuke', 512, 320, (226, 220, 206), 'НЕ ВЫХОДИТЕ', 'без надобности', '')
    # вывеска
    sign('sign_biedronka', 1024, 256, 'БЕДРОНКА')
    sign('sign_open', 512, 192, 'ОТКРЫТО', (40, 120, 70))
    # ценники
    price_tag('tag_butter', 256, 160, 'МАСЛО', '2.99', 'было 5.99')
    price_tag('tag_bread', 256, 160, 'ХЛЕБ', '4.99', 'кирпичик')
    price_tag('tag_tushonka', 256, 160, 'ТУШЁНКА', '9.99', 'говядина')
    price_tag('tag_sguschenka', 256, 160, 'СГУЩЁНКА', '7.99', 'сгущ. молоко')
    price_tag('tag_meds', 256, 160, 'ЛЕКАРСТВА', '12.99', 'йод, бинт')
    # фото на стене
    photo('photo_family', 256, 320, 3)
    photo('photo_town', 320, 256, 9)
    print('textures ->', OUT)
    for fn in sorted(os.listdir(OUT)):
        print(' ', fn, os.path.getsize(os.path.join(OUT, fn)) // 1024, 'KB')


if __name__ == '__main__':
    main()
