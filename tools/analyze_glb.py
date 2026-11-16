import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942
COMP = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    off = 12
    gltf = binc = None
    while off < total:
        clen, ctype = struct.unpack_from("<II", data, off)
        payload = data[off + 8:off + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(payload.decode("utf-8"))
        elif ctype == CHUNK_BIN:
            binc = payload
        off += 8 + clen
    return gltf, binc


def analyze(path):
    g, binc = read_glb(path)
    size_mb = Path(path).stat().st_size / 1024 / 1024
    meshes = g.get("meshes", [])
    n_prims = sum(len(m.get("primitives", [])) for m in meshes)
    acc = g.get("accessors", [])
    tris = 0
    for m in meshes:
        for p in m.get("primitives", []):
            if "indices" in p:
                tris += acc[p["indices"]]["count"] // 3
            else:
                tris += acc[p["attributes"]["POSITION"]]["count"] // 3
    imgs = g.get("images", [])
    views = g.get("bufferViews", [])
    img_info = []
    for i, im in enumerate(imgs):
        if "bufferView" in im:
            v = views[im["bufferView"]]
            raw = binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
            try:
                pic = Image.open(io.BytesIO(raw))
                img_info.append((im.get("name", f"img{i}"), pic.size, len(raw)))
            except Exception:
                img_info.append((im.get("name", f"img{i}"), ("?", "?"), len(raw)))
        else:
            img_info.append((im.get("name", f"img{i}"), ("ext", "ext"), 0))
    nodes = g.get("nodes", [])
    skins = g.get("skins", [])
    anims = g.get("animations", [])
    mats = g.get("materials", [])
    print(f"=== {Path(path).name}")
    print(f"  file: {size_mb:.2f} MB")
    print(f"  meshes: {len(meshes)}  primitives: {n_prims}  (~draw calls)")
    print(f"  triangles: {tris:,}")
    print(f"  nodes: {len(nodes)}  skins: {len(skins)}  animations: {len(anims)}")
    if skins:
        print(f"  joints in skin[0]: {len(skins[0].get('joints', []))}")
    if anims:
        for a in anims:
            print(f"  anim '{a.get('name','?')}': channels={len(a.get('channels',[]))}")
    print(f"  materials: {len(mats)}")
    print(f"  images: {len(imgs)}")
    total_img = 0
    for name, (w, h), blen in img_info:
        total_img += blen
        print(f"    {name}: {w}x{h}  {blen/1024:.0f} KB")
    print(f"  images total: {total_img/1024/1024:.2f} MB")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        analyze(p)
