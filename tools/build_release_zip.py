#!/usr/bin/env python3
"""Собрать ZIP beta-релиза из файлов проекта.
Запуск: python tools\build_release_zip.py
"""
import hashlib
import os
import zipfile

from github_publish import collect_files, read_version


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    version = read_version(root)
    dist = os.path.join(root, 'dist')
    os.makedirs(dist, exist_ok=True)
    name = f'not-a-human-3d-{version}.zip'
    out = os.path.join(dist, name)
    files = collect_files(root)
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, absolute in files:
            z.write(absolute, rel.replace('\\', '/'))
    sha256 = hashlib.sha256(open(out, 'rb').read()).hexdigest()
    with open(out + '.sha256', 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'{sha256}  {name}\n')
    print(f'ZIP: {out}')
    print(f'Файлов: {len(files)}; размер: {os.path.getsize(out)} байт')
    print('SHA-256:', sha256)


if __name__ == '__main__':
    main()
