#!/usr/bin/env python3
"""Детерминированные локальные текстуры расширения мира. Только Pillow + stdlib."""
from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "tex" / "expansion"


def noise(size: int, seed: int, octaves=(8, 20, 48, 128)) -> Image.Image:
    rng = random.Random(seed)
    result = Image.new("L", (size, size), 0)
    weights = (0.46, 0.28, 0.17, 0.09)
    for cells, weight in zip(octaves, weights):
        raw = Image.new("L", (cells, cells))
        raw.putdata([rng.randrange(256) for _ in range(cells * cells)])
        layer = raw.resize((size, size), Image.Resampling.BICUBIC)
        result = Image.blend(result, ImageChops.add(result, layer, scale=1, offset=0), weight)
    return result.filter(ImageFilter.GaussianBlur(0.45))


def color_noise(size: int, seed: int, base: tuple[int, int, int], amplitude: int) -> Image.Image:
    n = noise(size, seed)
    return Image.merge("RGB", tuple(n.point(lambda v, c=c: max(0, min(255, c + (v - 128) * amplitude / 128))) for c in base))


def normal_from_height(height: Image.Image, strength: float = 2.0) -> Image.Image:
    h = height.filter(ImageFilter.GaussianBlur(0.65))
    px = h.load()
    size = h.width
    out = Image.new("RGB", (size, size))
    dst = out.load()
    for y in range(size):
        for x in range(size):
            dx = (px[(x + 1) % size, y] - px[(x - 1) % size, y]) / 255 * strength
            dy = (px[x, (y + 1) % size] - px[x, (y - 1) % size]) / 255 * strength
            length = math.sqrt(dx * dx + dy * dy + 1)
            dst[x, y] = (int((-dx / length * 0.5 + 0.5) * 255), int((dy / length * 0.5 + 0.5) * 255), int((1 / length * 0.5 + 0.5) * 255))
    return out


def save_surface(name: str, color: Image.Image, height: Image.Image, strength: float) -> None:
    color.convert("RGB").save(OUT / f"{name}_color.jpg", quality=92, optimize=True)
    normal_from_height(height, strength).save(OUT / f"{name}_normal.jpg", quality=91, optimize=True)


def wallpaper(size: int) -> None:
    rng = random.Random(731)
    base = color_noise(size, 91, (91, 94, 78), 36).convert("RGBA")
    pattern = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(pattern)
    step = size // 8
    for y in range(-step, size + step, step):
        for x in range(-step, size + step, step):
            cx = x + (step // 2 if (y // step) % 2 else 0)
            d.line((cx, y - step * 0.44, cx, y + step * 0.44), fill=(171, 163, 119, 46), width=3)
            for sign in (-1, 1):
                d.arc((cx - step * 0.34 if sign < 0 else cx, y - step * 0.30, cx if sign < 0 else cx + step * 0.34, y + step * 0.08), 270 if sign < 0 else 270, 90 if sign < 0 else 90, fill=(174, 165, 121, 50), width=3)
            d.polygon((cx, y - 8, cx + 6, y, cx, y + 8, cx - 6, y), fill=(192, 177, 124, 40))
    for x in range(0, size, step):
        d.line((x, 0, x, size), fill=(38, 47, 39, 35), width=3)
        d.line((x + 4, 0, x + 4, size), fill=(185, 174, 127, 20), width=1)
    base = Image.alpha_composite(base, pattern)
    stains = noise(size, 141, (4, 9, 22, 64)).filter(ImageFilter.GaussianBlur(5))
    stain_layer = Image.new("RGBA", (size, size), (32, 25, 15, 0))
    stain_layer.putalpha(stains.point(lambda v: max(0, v - 137) * 2))
    base = Image.alpha_composite(base, stain_layer)
    height = noise(size, 92).point(lambda v: 112 + v // 5)
    save_surface("wallpaper", base, height, 1.4)


def enamel(size: int) -> None:
    base = color_noise(size, 303, (49, 91, 91), 32).convert("RGBA")
    d = ImageDraw.Draw(base)
    rng = random.Random(404)
    height = Image.new("L", (size, size), 166)
    hd = ImageDraw.Draw(height)
    for _ in range(240):
        x, y = rng.randrange(size), rng.randrange(size)
        length = rng.randrange(3, 35)
        shade = rng.choice([(118, 126, 112, 90), (28, 40, 37, 100), (150, 156, 133, 70)])
        d.line((x, y, x + length, y + rng.randrange(-3, 4)), fill=shade, width=rng.choice((1, 1, 2)))
        hd.line((x, y, x + length, y), fill=105, width=1)
    for _ in range(28):
        x, y = rng.randrange(size), rng.randrange(size)
        r = rng.randrange(2, 10)
        d.ellipse((x-r, y-r, x+r, y+r), fill=(85, 54, 35, rng.randrange(35, 100)))
    save_surface("enamel", base, height, 2.2)


def ceramic(size: int) -> None:
    base = color_noise(size, 550, (195, 190, 164), 18).convert("RGBA")
    cracks = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(cracks)
    height = Image.new("L", (size, size), 190)
    hd = ImageDraw.Draw(height)
    rng = random.Random(551)
    for _ in range(34):
        x, y = rng.randrange(size), rng.randrange(size)
        points = [(x, y)]
        angle = rng.random() * math.tau
        for _ in range(rng.randrange(3, 9)):
            angle += rng.uniform(-0.65, 0.65)
            x += math.cos(angle) * rng.randrange(8, 30)
            y += math.sin(angle) * rng.randrange(8, 30)
            points.append((x, y))
        d.line(points, fill=(70, 69, 58, rng.randrange(45, 105)), width=1)
        hd.line(points, fill=128, width=2)
    base = Image.alpha_composite(base, cracks.filter(ImageFilter.GaussianBlur(0.35)))
    save_surface("ceramic", base, height, 1.8)


def strata(size: int) -> None:
    n = noise(size, 811, (5, 12, 32, 96))
    out = Image.new("RGB", (size, size))
    px, np = out.load(), n.load()
    height = Image.new("L", (size, size))
    hp = height.load()
    for y in range(size):
        for x in range(size):
            wave = math.sin(y * 0.045 + math.sin(x * 0.012) * 2.2) * 0.5 + math.sin(y * 0.013) * 0.5
            v = np[x, y] / 255
            band = (wave + 1) * 0.5
            out.putpixel((x, y), (int(47 + 50 * band + 24 * v), int(45 + 43 * band + 20 * v), int(39 + 35 * band + 18 * v)))
            hp[x, y] = int(75 + band * 115 + v * 40)
    save_surface("strata", out, height, 2.8)


def cobweb(size: int) -> None:
    im = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(im)
    origin = (30, 30)
    rng = random.Random(99)
    rays = []
    for i in range(13):
        a = i / 12 * math.pi / 2
        end = (origin[0] + math.cos(a) * size * 0.90, origin[1] + math.sin(a) * size * 0.90)
        rays.append(end)
        d.line((origin, end), fill=(203, 211, 198, rng.randrange(90, 155)), width=2)
    for radius in range(85, int(size * 0.88), 65):
        points = []
        for i in range(13):
            a = i / 12 * math.pi / 2
            rr = radius * (1 + 0.035 * math.sin(i * 2.4 + radius))
            points.append((origin[0] + math.cos(a) * rr, origin[1] + math.sin(a) * rr))
        d.line(points, fill=(211, 218, 205, 105), width=2)
    for _ in range(34):
        x, y = rng.randrange(size//2), rng.randrange(size//2)
        d.ellipse((x, y, x+2, y+2), fill=(225, 227, 213, 100))
    im.filter(ImageFilter.GaussianBlur(0.35)).save(OUT / "cobweb.png", optimize=True)


def frost(size: int) -> None:
    im = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(im)
    rng = random.Random(102)
    def branch(x, y, length, angle, depth):
        if depth <= 0 or length < 3:
            return
        x2, y2 = x + math.cos(angle)*length, y + math.sin(angle)*length
        d.line((x, y, x2, y2), fill=(205, 225, 229, 35 + depth*22), width=max(1, depth//2))
        for sign in (-1, 1):
            branch(x2, y2, length*0.58, angle + sign*0.62, depth-1)
    for _ in range(24):
        edge = rng.randrange(4)
        x = rng.randrange(size) if edge < 2 else (0 if edge == 2 else size-1)
        y = (0 if edge == 0 else size-1) if edge < 2 else rng.randrange(size)
        angle = (math.pi/2 if edge == 0 else -math.pi/2) if edge < 2 else (0 if edge == 2 else math.pi)
        branch(x, y, rng.randrange(45, 120), angle + rng.uniform(-0.45, 0.45), 4)
    im.filter(ImageFilter.GaussianBlur(0.45)).save(OUT / "frost_lace.png", optimize=True)


def footprints(size: int) -> None:
    im = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(im)
    for cx, cy, angle in ((size*.35, size*.32, -.12), (size*.65, size*.69, .10)):
        sole = Image.new("RGBA", (220, 390))
        sd = ImageDraw.Draw(sole)
        sd.rounded_rectangle((48, 15, 170, 340), radius=52, fill=(49, 55, 56, 112))
        sd.ellipse((58, 285, 163, 370), fill=(43, 49, 50, 100))
        for y in range(60, 310, 42):
            sd.line((65, y, 153, y+14), fill=(192, 201, 199, 36), width=12)
        sole = sole.rotate(math.degrees(angle), resample=Image.Resampling.BICUBIC, expand=True)
        im.alpha_composite(sole, (int(cx-sole.width/2), int(cy-sole.height/2)))
    im.filter(ImageFilter.GaussianBlur(1.2)).save(OUT / "footprints.png", optimize=True)


def tally(size: int) -> None:
    im = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(im)
    rng = random.Random(44)
    for row in range(4):
        for group in range(5):
            x0, y0 = 70 + group*175, 120 + row*190
            for i in range(4):
                x = x0 + i*27
                d.line((x+rng.randrange(-3,4), y0, x+rng.randrange(-3,4), y0+105), fill=(207, 205, 179, 160), width=5)
            d.line((x0-12, y0+92, x0+100, y0+8), fill=(207, 205, 179, 160), width=5)
    d.line((70, 875, 890, 875), fill=(201, 192, 169, 145), width=4)
    im.filter(ImageFilter.GaussianBlur(.65)).save(OUT / "chalk_tally.png", optimize=True)


def photo(size: int, staff: bool) -> None:
    w, h = size, int(size * .64)
    rng = random.Random(812 if staff else 813)
    im = color_noise(size, 814, (143, 128, 96), 25).crop((0, 0, w, h)).convert("RGBA")
    d = ImageDraw.Draw(im)
    d.rectangle((30, 30, w-30, h-75), fill=( seventy := (93, 87, 69, 255)))
    d.rectangle((45, 45, w-45, int(h*.52)), fill=(115, 112, 91, 255))
    if staff:
        for x, scale in ((int(w*.28), 1.0), (int(w*.70), .91)):
            d.ellipse((x-55*scale, 120, x+55*scale, 120+110*scale), fill=(164, 145, 109, 255))
            d.polygon(((x-105*scale, 250), (x+105*scale, 250), (x+135*scale, 520), (x-135*scale, 520)), fill=(63, 65, 54, 255))
        d.rectangle((w*.47, 180, w*.53, 520), outline=(186, 165, 119, 150), width=3)
    else:
        for row in range(3):
            for col in range(10):
                x = 85 + col*90 + (row%2)*18
                y = 135 + row*120
                shade = rng.randrange(55, 100)
                d.ellipse((x-24, y-30, x+24, y+20), fill=(158+row*5, 141+row*4, 108+row*3, 255))
                d.polygon(((x-38, y+25), (x+38, y+25), (x+48, y+105), (x-48, y+105)), fill=(shade, shade, max(40, shade-12), 255))
        # Тридцать первая тень и шахтёрская каска.
        d.ellipse((w-92, 85, w-38, 145), fill=(39, 40, 34, 230))
        d.polygon(((w-110, 150), (w-22, 150), (w-5, 420), (w-125, 420)), fill=(35, 37, 32, 225))
        d.arc((w-105, 65, w-25, 150), 180, 360, fill=(25, 28, 25, 255), width=10)
    for _ in range(85):
        x, y = rng.randrange(w), rng.randrange(h)
        d.line((x, y, x+rng.randrange(2, 24), y), fill=(221, 205, 161, rng.randrange(20, 65)), width=1)
    d.rectangle((0, h-62, w, h), fill=(180, 159, 116, 255))
    d.text((45, h-47), "LUDMILA + ZOSIA / 08.08" if staff else "LICEUM WIELICZKA / KLASA 2-B / 31 SHADOWS", fill=(54, 48, 37, 255))
    im.convert("RGB").save(OUT / ("staff_photo.jpg" if staff else "class_photo.jpg"), quality=93, optimize=True)


def drawing(size: int) -> None:
    im = Image.new("RGBA", (size, size), (174, 163, 130, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, size*.53, size, size), fill=(125, 124, 98, 255))
    d.polygon(((size*.22, size*.50), (size*.50, size*.22), (size*.78, size*.50)), fill=(118, 64, 48, 255))
    d.rectangle((size*.28, size*.49, size*.72, size*.72), fill=(173, 157, 105, 255), outline=(64, 66, 55, 255), width=8)
    d.rectangle((size*.45, size*.58, size*.56, size*.72), fill=(54, 60, 54, 255))
    for i in range(4):
        y = size*(.75+i*.055)
        d.line((size*.15, y, size*.85, y+12), fill=(48+i*6, 53+i*4, 48+i*3, 255), width=9)
        d.ellipse((size*(.28+i*.12), y-15, size*(.28+i*.12)+22, y+7), fill=(181, 144, 74, 255))
    d.text((size*.12, size*.07), "NASZ DOM / NASZA KOPALNIA", fill=(66, 58, 43, 255), stroke_width=1)
    im.convert("RGB").save(OUT / "children_drawing.jpg", quality=92, optimize=True)


def generate_all(size: int = 1024) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wallpaper(size)
    enamel(size)
    ceramic(size)
    strata(size)
    cobweb(size)
    frost(size)
    footprints(size)
    tally(size)
    photo(size, False)
    photo(size, True)
    drawing(size)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, choices=(512, 1024), default=1024)
    parser.add_argument("--output-dir", type=Path, default=OUT)
    args = parser.parse_args()
    OUT = args.output_dir.resolve()
    generate_all(args.size)
    print(f"Generated expansion textures: {len(list(OUT.iterdir()))} files in {OUT}")
