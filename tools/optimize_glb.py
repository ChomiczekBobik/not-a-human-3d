#!/usr/bin/env python3
"""optimize_glb.py — ужимает текстуры внутри .glb под веб.

Использование:
  python optimize_glb.py assets/models/src/gena.glb                      -> gena.glb (1024px)
  python optimize_glb.py assets/models/src/hero.glb --size 2048          -> hero.glb (2048px)
  python optimize_glb.py assets/models/src/gena.glb -o assets/models/gena.glb

Что делает:
  - все текстуры уменьшает до --size по длинной стороне (LANCZOS);
  - baseColor/emissive без альфы -> JPEG q90; normal/metallicRoughness/occlusion -> PNG;
  - пересобирает GLB (JSON + BIN чанки), оффсеты пересчитываются;
  - оригинал не меняется.

Зависимость: pip install Pillow
"""

import argparse
import json
import struct
import sys
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Нет Pillow: pip install Pillow")

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

KEEP_PNG_ROLES = {"normalTexture", "metallicRoughnessTexture", "occlusionTexture"}
JPG_ROLES = {"baseColorTexture", "emissiveTexture"}


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC:
        sys.exit(f"{path}: не GLB (magic {magic:#x})")
    off = 12
    gltf, bin_chunk = None, None
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        payload = data[off + 8:off + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(payload.decode("utf-8"))
        elif ctype == CHUNK_BIN:
            bin_chunk = bytearray(payload)
        off += 8 + clen
    if gltf is None or bin_chunk is None:
        sys.exit(f"{path}: нет JSON/BIN чанка")
    return gltf, bin_chunk


def write_glb(path, gltf, bin_chunk):
    j = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    j += b" " * (-len(j) % 4)
    b = bytes(bin_chunk)
    b += b"\x00" * (-len(b) % 4)
    total = 12 + 8 + len(j) + 8 + len(b)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, total))
        f.write(struct.pack("<II", len(j), CHUNK_JSON))
        f.write(j)
        f.write(struct.pack("<II", len(b), CHUNK_BIN))
        f.write(b)


def image_roles(gltf):
    """image index -> {роли}, по материалам."""
    roles = {}
    for m in gltf.get("materials", []):
        pbr = m.get("pbrMetallicRoughness", {})
        slots = {
            "baseColorTexture": pbr.get("baseColorTexture"),
            "metallicRoughnessTexture": pbr.get("metallicRoughnessTexture"),
            "normalTexture": m.get("normalTexture"),
            "occlusionTexture": m.get("occlusionTexture"),
            "emissiveTexture": m.get("emissiveTexture"),
        }
        for role, ref in slots.items():
            if ref is None:
                continue
            tex = gltf["textures"][ref["index"]]
            sidx = tex.get("source")
            if sidx is not None:
                roles.setdefault(sidx, set()).add(role)
    return roles


def shrink_image(raw, max_size, roles, force_png):
    img = Image.open(BytesIO(raw))
    w0, h0 = img.size
    if max(w0, h0) > max_size:
        scale = max_size / max(w0, h0)
        img = img.resize((max(1, int(w0 * scale)), max(1, int(h0 * scale))), Image.LANCZOS)
    w1, h1 = img.size
    out = BytesIO()
    keep_png = force_png or bool(roles & KEEP_PNG_ROLES)
    if keep_png:
        img.save(out, "PNG", optimize=True)
        mime = "image/png"
    else:
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        img.save(out, "JPEG", quality=90)
        mime = "image/jpeg"
    return out.getvalue(), mime, (w0, h0), (w1, h1)


def optimize(src, dst, max_size):
    gltf, bin_chunk = read_glb(src)
    roles = image_roles(gltf)
    images = gltf.get("images", [])
    views = gltf.get("bufferViews", [])

    # готовим замены: bufferView -> (новые байты, mime)
    replacements = {}
    skipped = 0
    for i, img_def in enumerate(images):
        if "bufferView" not in img_def:
            skipped += 1  # внешняя ссылка / data:URI — не трогаем
            continue
        bv = img_def["bufferView"]
        v = views[bv]
        off = v.get("byteOffset", 0)
        raw = bytes(bin_chunk[off:off + v["byteLength"]])
        new_raw, mime, before, after = shrink_image(
            raw, max_size, roles.get(i, set()), img_def.get("mimeType") == "image/png"
        )
        replacements[bv] = (new_raw, mime)
        kb0, kb1 = len(raw) / 1024, len(new_raw) / 1024
        print(f"  image[{i}] {img_def.get('name', '?')}: {before[0]}x{before[1]} -> {after[0]}x{after[1]}, "
              f"{kb0:.0f} КБ -> {kb1:.0f} КБ ({mime})")

    if not replacements:
        print("  встроенных текстур нет — просто пересобираю файл")

    # пересборка BIN: копируем bufferView-сегменты в порядке исходных оффсетов
    order = sorted(range(len(views)), key=lambda idx: views[idx].get("byteOffset", 0))
    new_bin = bytearray()
    prev_old_end = None
    for idx in order:
        v = views[idx]
        old_off = v.get("byteOffset", 0)
        old_len = v["byteLength"]
        if prev_old_end is not None and old_off < prev_old_end:
            sys.exit("  bufferView пересекаются — файл нестандартный, не трогаю")
        # выравнивание на 4
        pad = -len(new_bin) % 4
        new_bin.extend(b"\x00" * pad)
        start = len(new_bin)
        new_bin.extend(replacements[idx][0] if idx in replacements
                       else bin_chunk[old_off:old_off + old_len])
        v["byteOffset"] = start
        v["byteLength"] = len(new_bin) - start
        if "byteStride" in v:
            del v["byteStride"]  # stride валиден только для вершинных атрибутов; текстурам он не нужен
        prev_old_end = old_off + old_len

    # обновляем mime для заменённых картинок
    for bv_idx, (new_raw, mime) in replacements.items():
        for img_def in images:
            if img_def.get("bufferView") == bv_idx:
                img_def["mimeType"] = mime

    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(new_bin)
    write_glb(dst, gltf, new_bin)

    src_kb = Path(src).stat().st_size / 1024
    dst_kb = Path(dst).stat().st_size / 1024
    if skipped:
        print(f"  пропущено текстур с внешними ссылками: {skipped}")
    print(f"[OK] {src} ({src_kb:.0f} КБ) -> {dst} ({dst_kb:.0f} КБ)")


def main():
    ap = argparse.ArgumentParser(description="Сжатие текстур в .glb под веб")
    ap.add_argument("input")
    ap.add_argument("-o", "--output", help="куда писать (по умолчанию рядом с входом)")
    ap.add_argument("--size", type=int, default=1024, help="макс. сторона текстуры, px (default 1024)")
    args = ap.parse_args()
    src = Path(args.input)
    if not src.exists():
        sys.exit(f"нет файла: {src}")
    dst = Path(args.output) if args.output else src.with_name(src.stem + ".web.glb")
    if dst.resolve() == src.resolve():
        sys.exit("выход совпадает с входом — так нельзя")
    optimize(src, dst, args.size)


if __name__ == "__main__":
    main()
