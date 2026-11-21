#!/usr/bin/env python3
"""Детерминированные бесшовные creepy-текстуры на Pillow, без сети и NumPy.

Запуск из корня проекта:
    python tools/make_creepy_textures.py --size 1024

RGBA: mold.png, scratches.png, rust_drips.png.
RGB:  damp_paper.png, organic_grime.png.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "tex" / "generated"
RESAMPLE = Image.Resampling.BICUBIC


def _noise(size: int, cells: int, rng: random.Random) -> Image.Image:
    """Periodic value noise: первая/последняя строка и столбец совпадают."""
    grid = [[rng.randrange(256) for _ in range(cells)] for _ in range(cells)]
    pixels = [
        grid[y % cells][x % cells]
        for y in range(cells + 1)
        for x in range(cells + 1)
    ]
    image = Image.new("L", (cells + 1, cells + 1))
    image.putdata(pixels)
    return image.resize((size, size), RESAMPLE)


def _fbm(
    size: int,
    seed: int,
    octaves: tuple[int, ...] = (4, 8, 16, 32, 64),
    persistence: float = 0.55,
) -> Image.Image:
    """Нормированный fBm из периодических октав, без попиксельных Python-циклов."""
    rng = random.Random(seed)
    result = _noise(size, octaves[0], rng)
    accumulated_weight = 1.0
    for index, cells in enumerate(octaves[1:], start=1):
        weight = persistence**index
        layer = _noise(size, cells, rng)
        result = Image.blend(
            result, layer, weight / (accumulated_weight + weight)
        )
        accumulated_weight += weight
    return result


def _alpha_ramp(
    image: Image.Image, start: int, end: int, maximum: int
) -> Image.Image:
    """Мягкий smoothstep-диапазон прозрачности."""
    lut = []
    for value in range(256):
        t = min(1.0, max(0.0, (value - start) / (end - start)))
        t = t * t * (3.0 - 2.0 * t)
        lut.append(round(maximum * t))
    return image.point(lut)


def _band_alpha(
    image: Image.Image, center: int, width: float, maximum: int
) -> Image.Image:
    """Узкая неровная контурная линия вокруг уровня шума."""
    lut = []
    for value in range(256):
        distance = abs(value - center) / width
        lut.append(round(maximum * (1.0 - distance)) if distance < 1.0 else 0)
    return image.point(lut)


def _color_ramp(
    image: Image.Image,
    dark: tuple[int, int, int],
    middle: tuple[int, int, int],
    light: tuple[int, int, int],
) -> Image.Image:
    """Трёхцветный градиент через LUT; работает быстрее попиксельной раскраски."""
    channels = []
    for channel in range(3):
        lut = []
        for value in range(256):
            if value < 128:
                t = value / 128.0
                color = dark[channel] * (1.0 - t) + middle[channel] * t
            else:
                t = (value - 128) / 127.0
                color = middle[channel] * (1.0 - t) + light[channel] * t
            lut.append(round(color))
        channels.append(image.point(lut))
    return Image.merge("RGB", channels)


def _offsets(size: int) -> tuple[tuple[int, int], ...]:
    return tuple(
        (x * size, y * size)
        for y in (-1, 0, 1)
        for x in (-1, 0, 1)
    )


def _wrapped_line(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    size: int,
    fill,
    width: int = 1,
) -> None:
    for offset_x, offset_y in _offsets(size):
        shifted = [(x + offset_x, y + offset_y) for x, y in points]
        draw.line(shifted, fill=fill, width=width, joint="curve")


def _wrapped_ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    size: int,
    fill,
) -> None:
    for offset_x, offset_y in _offsets(size):
        draw.ellipse(
            (
                box[0] + offset_x,
                box[1] + offset_y,
                box[2] + offset_x,
                box[3] + offset_y,
            ),
            fill=fill,
        )


def _wrapped_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    size: int,
    fill,
) -> None:
    for offset_x, offset_y in _offsets(size):
        draw.polygon(
            [(x + offset_x, y + offset_y) for x, y in points], fill=fill
        )


def make_mold(size: int = 1024, seed: int = 1101) -> Image.Image:
    """Пятна зеленовато-серой плесени с мягкими краями и тёмными спорами, RGBA."""
    field = _fbm(size, seed, (3, 6, 12, 24, 48, 96), 0.58)
    colors = _fbm(size, seed + 1, (6, 12, 24, 48, 96), 0.55)
    pores = _fbm(size, seed + 2, (32, 64, 128), 0.50)

    image = _color_ramp(
        colors, (15, 25, 16), (58, 75, 40), (171, 178, 119)
    ).convert("RGBA")
    alpha = _alpha_ramp(field, 126, 158, 230)
    modulation = pores.point([115 + round(140 * value / 255) for value in range(256)])
    alpha = ImageChops.multiply(alpha, modulation)
    image.putalpha(alpha)

    rng = random.Random(seed + 3)
    spore_mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(spore_mask)
    scale = size / 1024.0
    for _ in range(340):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        radius = rng.uniform(0.6, 2.2) * scale
        _wrapped_ellipse(
            draw,
            (x - radius, y - radius, x + radius, y + radius),
            size,
            rng.randrange(100, 230),
        )
    spore_mask = ImageChops.multiply(spore_mask, alpha)
    spores = Image.new("RGBA", (size, size), (18, 28, 16, 0))
    spores.putalpha(spore_mask)
    return Image.alpha_composite(image, spores)


def make_scratches(size: int = 1024, seed: int = 2202) -> Image.Image:
    """Тонкие неровные царапины и зарубки на прозрачном фоне, RGBA."""
    rng = random.Random(seed)
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size / 1024.0

    for _ in range(180):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        angle = rng.uniform(0, math.tau)
        if rng.random() < 0.35:
            angle = rng.choice((0.0, math.pi / 2)) + rng.uniform(-0.28, 0.28)
        length = rng.uniform(24, 240) * scale
        segments = rng.randrange(3, 8)
        points = []
        for index in range(segments):
            t = index / (segments - 1)
            along = length * (t - 0.5)
            jitter = rng.uniform(-2.0, 2.0) * scale
            points.append(
                (
                    x + math.cos(angle) * along - math.sin(angle) * jitter,
                    y + math.sin(angle) * along + math.cos(angle) * jitter,
                )
            )

        width = max(1, round(rng.uniform(0.8, 2.2) * scale))
        shadow = [(px + scale, py + scale) for px, py in points]
        _wrapped_line(
            draw, shadow, size, (22, 17, 13, rng.randrange(35, 95)), width + 1
        )
        if rng.random() < 0.72:
            color = (222, 213, 190, rng.randrange(65, 155))
        else:
            color = (75, 65, 52, rng.randrange(60, 135))
        _wrapped_line(draw, points, size, color, width)

    for _ in range(55):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        rx = rng.uniform(0.5, 1.6) * scale
        ry = rng.uniform(1.0, 4.0) * scale
        _wrapped_ellipse(
            draw,
            (x - rx, y - ry, x + rx, y + ry),
            size,
            (205, 194, 168, rng.randrange(45, 115)),
        )
    return image


def make_damp_paper(size: int = 1024, seed: int = 3303) -> Image.Image:
    """Старая бумага с сырыми пятнами, контурами подтёков и волокнами, RGB."""
    base = _fbm(size, seed, (4, 8, 16, 32, 64, 128), 0.58)
    damp = _fbm(size, seed + 1, (3, 5, 10, 20, 40), 0.55)
    image = _color_ramp(
        base, (105, 86, 55), (184, 165, 125), (234, 223, 191)
    ).convert("RGBA")

    stains = Image.new("RGBA", (size, size), (65, 61, 38, 0))
    stains.putalpha(_alpha_ramp(damp, 122, 166, 110))
    image = Image.alpha_composite(image, stains)

    tide_marks = Image.new("RGBA", (size, size), (78, 58, 31, 0))
    tide_marks.putalpha(_band_alpha(damp, 143, 3.5, 38))
    image = Image.alpha_composite(image, tide_marks)

    rng = random.Random(seed + 2)
    fibers = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fibers)
    scale = size / 1024.0
    for _ in range(900):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        angle = rng.uniform(0, math.tau)
        length = rng.uniform(2.0, 13.0) * scale
        points = [
            (x, y),
            (x + math.cos(angle) * length, y + math.sin(angle) * length),
        ]
        if rng.random() < 0.55:
            fill = (70, 53, 31, rng.randrange(10, 34))
        else:
            fill = (245, 231, 194, rng.randrange(12, 38))
        _wrapped_line(draw, points, size, fill, max(1, round(scale)))

    for _ in range(520):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        radius = rng.uniform(0.35, 1.35) * scale
        _wrapped_ellipse(
            draw,
            (x - radius, y - radius, x + radius, y + radius),
            size,
            (58, 45, 28, rng.randrange(15, 58)),
        )
    return Image.alpha_composite(image, fibers).convert("RGB")


def make_rust_drips(size: int = 1024, seed: int = 4404) -> Image.Image:
    """Ржавые островки и сужающиеся потёки с сухой зернистостью, RGBA."""
    rng = random.Random(seed)
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size / 1024.0
    rust_colors = (
        (91, 35, 16),
        (126, 49, 18),
        (153, 65, 23),
        (76, 31, 18),
        (177, 82, 30),
    )

    for _ in range(54):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        width = rng.uniform(4.0, 22.0) * scale
        length = rng.uniform(65.0, 430.0) * scale
        segments = rng.randrange(5, 11)
        drift = rng.uniform(-22.0, 22.0) * scale
        phase = rng.uniform(0, math.tau)
        left, right, centers = [], [], []
        for index in range(segments + 1):
            t = index / segments
            center_x = (
                x
                + drift * t
                + math.sin(phase + t * math.pi * 2.0) * width * 0.24
            )
            center_y = y + length * t
            half_width = max(
                0.25 * scale,
                width * (1.0 - t) ** 0.72 * rng.uniform(0.65, 1.18),
            )
            left.append((center_x - half_width, center_y))
            right.append((center_x + half_width, center_y))
            centers.append((center_x, center_y))

        color = rng.choice(rust_colors)
        _wrapped_polygon(
            draw,
            left + list(reversed(right)),
            size,
            (*color, rng.randrange(100, 195)),
        )
        _wrapped_line(
            draw,
            centers,
            size,
            (67, 27, 15, rng.randrange(65, 135)),
            max(1, round(width * 0.18)),
        )
        _wrapped_ellipse(
            draw,
            (x - width, y - width * 0.55, x + width, y + width * 0.55),
            size,
            (*color, rng.randrange(115, 205)),
        )

    for _ in range(280):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        radius = rng.uniform(0.45, 3.0) * scale
        color = rng.choice(rust_colors)
        _wrapped_ellipse(
            draw,
            (x - radius, y - radius, x + radius, y + radius),
            size,
            (*color, rng.randrange(60, 165)),
        )

    grain = _fbm(size, seed + 1, (16, 32, 64, 128), 0.55)
    modulation = grain.point([95 + round(160 * value / 255) for value in range(256)])
    image.putalpha(ImageChops.multiply(image.getchannel("A"), modulation))
    return image


def make_organic_grime(size: int = 1024, seed: int = 5505) -> Image.Image:
    """Плотная коричнево-оливковая органическая грязь с порами и разводами, RGB."""
    base = _fbm(size, seed, (3, 6, 12, 24, 48, 96), 0.58)
    detail = _fbm(size, seed + 1, (12, 24, 48, 96, 144), 0.54)
    mixed = Image.blend(base, detail, 0.32)
    image = _color_ramp(
        mixed, (16, 18, 12), (60, 55, 35), (126, 114, 77)
    ).convert("RGBA")

    greasy = Image.new("RGBA", (size, size), (18, 22, 12, 0))
    greasy.putalpha(_alpha_ramp(base, 128, 170, 95))
    image = Image.alpha_composite(image, greasy)

    rng = random.Random(seed + 2)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    scale = size / 1024.0
    for _ in range(900):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        radius = rng.uniform(0.35, 2.1) * scale
        fill = (
            (9, 12, 7, rng.randrange(25, 90))
            if rng.random() < 0.82
            else (151, 137, 91, rng.randrange(12, 40))
        )
        _wrapped_ellipse(
            draw,
            (x - radius, y - radius, x + radius, y + radius),
            size,
            fill,
        )

    for _ in range(46):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        length = rng.uniform(25, 170) * scale
        points = [
            (x, y),
            (x + rng.uniform(-5, 5) * scale, y + length * 0.45),
            (x + rng.uniform(-9, 9) * scale, y + length),
        ]
        _wrapped_line(
            draw,
            points,
            size,
            (12, 17, 9, rng.randrange(18, 58)),
            max(1, round(rng.uniform(1.0, 4.0) * scale)),
        )
    return Image.alpha_composite(image, overlay).convert("RGB")


GENERATORS = {
    "mold": make_mold,
    "scratches": make_scratches,
    "damp_paper": make_damp_paper,
    "rust_drips": make_rust_drips,
    "organic_grime": make_organic_grime,
}


def generate_all(
    size: int = 1024, output_dir: str | Path = DEFAULT_OUTPUT
) -> list[Path]:
    """Сгенерировать все пять PNG и вернуть пути к ним."""
    if size not in (512, 1024):
        raise ValueError("size должен быть 512 или 1024")
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, generator in GENERATORS.items():
        path = destination / f"{name}.png"
        generator(size).save(path, format="PNG", optimize=True)
        paths.append(path)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, choices=(512, 1024), default=1024)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    for path in generate_all(args.size, args.output_dir):
        with Image.open(path) as image:
            print(f"{path} | {image.width}x{image.height} | {image.mode}")


if __name__ == "__main__":
    main()
