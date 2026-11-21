#!/usr/bin/env python3
"""Download selected ambientCG CC0 PBR maps into assets/tex/pbr.

Runtime does not execute this file: all required JPG files are shipped locally.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
import io

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "tex" / "pbr"
ASSETS = ("Wood051", "Concrete034", "Metal032")
MAPS = ("Color", "NormalGL", "Roughness", "Metalness")

OUT.mkdir(parents=True, exist_ok=True)
for asset in ASSETS:
    url = f"https://ambientcg.com/get?file={asset}_1K-JPG.zip"
    print("download", url)
    req = Request(url, headers={"User-Agent": "not-a-human-3d-texture-fetch/1.0"})
    with urlopen(req, timeout=90) as response:
        payload = response.read()
    with ZipFile(io.BytesIO(payload)) as archive:
        for kind in MAPS:
            name = f"{asset}_1K-JPG_{kind}.jpg"
            if name not in archive.namelist():
                continue
            target = OUT / name
            target.write_bytes(archive.read(name))
            print(target.relative_to(ROOT), target.stat().st_size)
print("License: Creative Commons CC0 1.0 Universal — https://docs.ambientcg.com/license/")
