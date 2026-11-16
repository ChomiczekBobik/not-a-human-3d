# make_lyceum_assets.py — ассеты для лицея и оживления фасадов улицы:
# вывеска «ЛИЦЕЙ «ВЕЛИЧКА»», флаг, световое пятно под фонарём/дверью,
# текстуры окон с рамами (тёмное / светлое / забитое досками).
# Запуск: py tools\make_lyceum_assets.py

import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)
random.seed(21)

FONT = r'C:\Windows\Fonts\arial.ttf'
FONTB = r'C:\Windows\Fonts\arialbd.ttf'


def f(size, bold=False):
    return ImageFont.truetype(FONTB if bold else FONT, size)


def sign_lyceum():
    """Синяя эмалированная доска как на школах: белый борт, крупная строка + строка адреса."""
    w, h = 1024, 256
    im = Image.new('RGB', (w, h), (14, 26, 54))
    d = ImageDraw.Draw(im)
    d.rectangle([8, 8, w - 9, h - 9], outline=(226, 234, 244), width=6)
    t1 = 'ЛИЦЕЙ «ВЕЛИЧКА»'
    ft = f(104, True)
    tw = d.textlength(t1, font=ft)
    d.text(((w - tw) / 2, 34), t1, font=ft, fill=(240, 244, 250))
    t2 = 'ул. Велички, 2'
    fs = f(44, False)
    tw2 = d.textlength(t2, font=fs)
    d.text(((w - tw2) / 2, 164), t2, font=fs, fill=(150, 168, 198))
    # крепёжные «саморезы» по углам
    for cx, cy in [(28, 28), (w - 28, 28), (28, h - 28), (w - 28, h - 28)]:
        d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(190, 200, 215))
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(90, 105, 130))
    im.save(os.path.join(OUT, 'sign_lyceum.png'))


def flag_lyceum():
    """Триколор на флагштоке + лёгкие сгибы ткани."""
    w, h = 256, 160
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    bands = [(232, 236, 240), (34, 60, 120), (180, 40, 48)]
    for i, c in enumerate(bands):
        d.rectangle([0, i * h // 3, w, (i + 1) * h // 3], fill=c)
    # сгибы: полупрозрачные тёмные вертикали
    for fx in [int(w * 0.33), int(w * 0.72)]:
        d.rectangle([fx, 0, fx + 14, h], fill=(0, 0, 0, 38))
    im = im.filter(ImageFilter.GaussianBlur(1))
    im.save(os.path.join(OUT, 'flag_lyceum.png'))


def glow_spill():
    """Радиальное пятно света на снегу: центр тёплый, края прозрачные (для additive)."""
    s = 256
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for r in range(s // 2, 0, -2):
        t = r / (s / 2)
        a = int(150 * (1 - t) ** 2.2)
        d.ellipse([s / 2 - r, s / 2 - r * 0.62, s / 2 + r, s / 2 + r * 0.62], fill=(255, 210, 140, a))
    im = im.filter(ImageFilter.GaussianBlur(6))
    im.save(os.path.join(OUT, 'glow_spill.png'))


def _frame(d, w, h, col):
    """Белая рама + крестовина (нарисованные — ноль новых мешей на фасаде)."""
    d.rectangle([0, 0, w - 1, h - 1], outline=col, width=12)
    d.rectangle([w // 2 - 6, 0, w // 2 + 6, h], fill=col)
    d.rectangle([0, h * 0.46, w, h * 0.54], fill=col)
    # подоконник снизу — чуть выступает
    d.rectangle([-6, h - 12, w + 6, h + 4], fill=col)


def win_dead():
    """Тёмное окно: стекло почти чёрное, слабое отражение неба сверху."""
    w, h = 256, 256
    im = Image.new('RGB', (w, h), (10, 14, 24))
    d = ImageDraw.Draw(im)
    for y in range(h):
        g = int(10 + 16 * (1 - y / h))
        d.line([(0, y), (w, y)], fill=(g, g + 4, g + 12))
    _frame(d, w, h, (118, 126, 140))
    im = im.filter(ImageFilter.GaussianBlur(1))
    im.save(os.path.join(OUT, 'win_dead.png'))


def win_lit():
    """Светлое окно: тёплый свет + шторы по бокам — главная «жизнь» фасада."""
    w, h = 256, 256
    im = Image.new('RGB', (w, h), (255, 190, 100))
    d = ImageDraw.Draw(im)
    for y in range(h):
        k = y / h
        r = int(255 - 40 * k)
        g = int(196 - 66 * k)
        b = int(112 - 52 * k)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    # шторы
    d.polygon([(0, 0), (58, 0), (34, h)], fill=(196, 120, 60))
    d.polygon([(w, 0), (w - 58, 0), (w - 34, h)], fill=(196, 120, 60))
    # силуэт предмета на подоконнике
    d.ellipse([int(w * 0.58), int(h * 0.78), int(w * 0.74), int(h * 0.95)], fill=(120, 70, 40))
    _frame(d, w, h, (224, 220, 210))
    im = im.filter(ImageFilter.GaussianBlur(1))
    im.save(os.path.join(OUT, 'win_lit.png'))


def win_board():
    """Забитое досками окно: две доски крестом, гвозди."""
    w, h = 256, 256
    im = Image.new('RGB', (w, h), (12, 14, 20))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, h - 1], outline=(96, 104, 116), width=10)
    plank = (92, 70, 48)
    for ang in (18, -14):
        p = Image.new('RGB', (w + 80, 54), plank)
        pd = ImageDraw.Draw(p)
        pd.line([(0, 4), (w + 80, 6)], fill=(70, 52, 36), width=3)
        pd.line([(0, 42), (w + 80, 46)], fill=(70, 52, 36), width=2)
        p = p.rotate(ang, expand=True)
        im.paste(p, (-30, h // 2 - 27 + (10 if ang > 0 else -10)))
    for gx, gy in [(w // 2, h // 2), (w // 2 - 60, h // 2 + 40), (w // 2 + 70, h // 2 - 30)]:
        d.ellipse([gx - 5, gy - 5, gx + 5, gy + 5], fill=(40, 36, 32))
    im.save(os.path.join(OUT, 'win_board.png'))


sign_lyceum()
flag_lyceum()
glow_spill()
win_dead()
win_lit()
win_board()
print('lyceum assets ->', OUT)
