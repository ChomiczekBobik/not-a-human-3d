#!/usr/bin/env python3
r"""Публикация беты на GitHub через REST API без git/gh/npm.

Пример:
  $env:GITHUB_TOKEN = '<PAT>'
  python tools\build_release_zip.py
  python tools\github_publish.py --owner <ник> --repo not-a-human-3d --enable-pages --release --asset dist\<zip>

Токен читается из GITHUB_TOKEN, никогда не печатается и не пишется в файлы.
Для создания приватного репозитория используй --private; по умолчанию репозиторий public.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.github.com'
API_VERSION = '2022-11-28'
EXCLUDED_PREFIXES = (
    '.git/', 'dist/', 'shots/', 'tmp/', 'tools/__pycache__/',
    'assets/models/src/',
)
EXCLUDED_FILES = {
    '.git',
    'glbtest.log',
    'assets/models/tripo_heavy.glb',
}
EXCLUDED_SUFFIXES = ('.pyc', '.pyo', '.log', '.zip')
MAX_CONTENT_BYTES = 950_000  # Contents API безопасно для этих файлов; heavy GLB исключён.


class PublishError(RuntimeError):
    pass


def ignored(rel):
    rel = rel.replace('\\', '/')
    if rel.startswith('./'):
        rel = rel[2:]
    if rel in EXCLUDED_FILES or any(rel.startswith(p) for p in EXCLUDED_PREFIXES):
        return True
    if rel.endswith(EXCLUDED_SUFFIXES):
        return True
    return os.path.basename(rel) == '.env' or os.path.basename(rel).startswith('.env.')


def collect_files(root):
    """Файлы репозитория; единый список использует и ZIP-сборщик."""
    out = []
    for directory, dirs, files in os.walk(root):
        dirs[:] = [
            d for d in dirs
            if not ignored(os.path.relpath(os.path.join(directory, d), root).replace('\\', '/') + '/')
        ]
        for filename in files:
            absolute = os.path.join(directory, filename)
            rel = os.path.relpath(absolute, root).replace('\\', '/')
            if ignored(rel):
                continue
            out.append((rel, absolute))
    return sorted(out, key=lambda x: x[0].lower())


def request(method, url, token, body=None, raw=None, content_type=None, expected=(200,)):
    headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'not-a-human-3d-beta-publisher/0.1',
    }
    data = raw
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        content_type = 'application/json'
    if content_type:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            status = response.status
            payload = response.read()
            rate = response.headers.get('X-RateLimit-Remaining')
    except urllib.error.HTTPError as error:
        status = error.code
        payload = error.read()
        rate = error.headers.get('X-RateLimit-Remaining')
    except urllib.error.URLError as error:
        raise PublishError('Сеть/доступ к GitHub API: ' + str(error)) from error
    if status not in expected:
        text = payload.decode('utf-8', 'replace')[:1000]
        raise PublishError(f'{method} {url}: HTTP {status}\n{text}')
    parsed = None
    if payload:
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            parsed = payload
    return status, parsed, rate


def api(method, path, token, **kwargs):
    return request(method, API + path, token, **kwargs)


def read_version(root):
    version_path = os.path.join(root, 'VERSION')
    if os.path.isfile(version_path):
        with open(version_path, encoding='utf-8-sig') as f:
            return f.read().strip()
    return '0.1.0-beta.1'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--owner', help='GitHub-логин; если не задан, берётся из /user')
    parser.add_argument('--repo', default='not-a-human-3d', help='Имя репозитория')
    parser.add_argument('--private', action='store_true', help='Приватный репозиторий (по умолчанию public)')
    parser.add_argument('--description', default='НЕТ, Я НЕ ВЕЛИЧАНИН — beta 3D browser game')
    parser.add_argument('--enable-pages', action='store_true', help='Включить GitHub Pages: default branch, /(root)')
    parser.add_argument('--release', action='store_true', help='Создать prerelease из VERSION и RELEASE_NOTES.md')
    parser.add_argument('--asset', action='append', default=[], help='ZIP/файл для прикрепления к релизу; можно повторять')
    parser.add_argument('--message', default='beta: publish', help='Префикс commit message Contents API')
    parser.add_argument('--dry-run', action='store_true', help='Показать состав, ничего не отправлять')
    parser.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    files = collect_files(root)
    if not files:
        raise PublishError('Пустой проект: ' + root)
    total = sum(os.path.getsize(p) for _, p in files)
    print(f'Состав: {len(files)} файлов, {total / 1048576:.2f} MiB; root={root}', flush=True)
    too_big = [(p, os.path.getsize(p)) for p, _ in files if os.path.getsize(p) > MAX_CONTENT_BYTES]
    if too_big:
        raise PublishError('Файлы больше Contents API (используй git/LFS или исключение):\n' + '\n'.join(f'{p}: {s}' for p, s in too_big))
    if args.dry_run:
        for rel, _ in files:
            print(rel)
        print('DRY-RUN: API не вызывался.')
        return

    token = os.environ.get('GITHUB_TOKEN', '').strip()
    if not token:
        raise PublishError('Нет GITHUB_TOKEN. Установи PAT локально: $env:GITHUB_TOKEN = ...; токен в чат не отправляй.')

    owner = args.owner
    if not owner:
        _, user, _ = api('GET', '/user', token)
        owner = user['login']
        print('Owner:', owner, flush=True)

    # Создать, если не существует; иначе обновить файлы существующего репозитория.
    status, repo, _ = api('GET', f'/repos/{owner}/{args.repo}', token, expected=(200, 404))
    if status == 404:
        _, repo, _ = api('POST', '/user/repos', token, body={
            'name': args.repo,
            'description': args.description,
            'private': bool(args.private),
            'has_issues': True,
            'has_projects': False,
            'has_wiki': False,
            'auto_init': False,
        }, expected=(201,))
        print('Репозиторий создан:', repo['html_url'], flush=True)
        time.sleep(1)
    else:
        print('Репозиторий существует:', repo['html_url'], flush=True)

    branch = repo.get('default_branch', 'main')
    print(f'Ветка: {branch}; загрузка {len(files)} файлов через Contents API...', flush=True)

    # Sequential: каждый PUT создаёт commit, параллельные коммиты дали бы non-fast-forward.
    for i, (rel, absolute) in enumerate(files, 1):
        encoded_path = urllib.parse.quote(rel, safe='/')
        path = f'/repos/{owner}/{args.repo}/contents/{encoded_path}'
        status, current, _ = api('GET', path, token, expected=(200, 404))
        if status == 200 and current.get('type') != 'file':
            raise PublishError('Путь уже является директорией: ' + rel)
        with open(absolute, 'rb') as f:
            content = base64.b64encode(f.read()).decode('ascii')
        body = {
            'message': f'{args.message}: {rel}',
            'content': content,
            'branch': branch,
        }
        if status == 200:
            body['sha'] = current['sha']
        api('PUT', path, token, body=body, expected=(200, 201))
        print(f'[{i}/{len(files)}] {rel}', flush=True)

    pages_url = f'https://{owner}.github.io/{args.repo}/'
    if args.enable_pages:
        status, _, _ = api('POST', f'/repos/{owner}/{args.repo}/pages', token, body={
            'source': {'branch': branch, 'path': '/'}
        }, expected=(201, 409))
        print('Pages:', 'включены' if status == 201 else 'уже были включены', flush=True)
        print('URL игры:', pages_url, flush=True)
        print('Первая сборка обычно занимает 1–3 минуты.', flush=True)

    if args.release or args.asset:
        version = read_version(root)
        tag = version if version.startswith('v') else 'v' + version
        notes_path = os.path.join(root, 'RELEASE_NOTES.md')
        notes = open(notes_path, encoding='utf-8-sig').read() if os.path.isfile(notes_path) else f'Beta {tag}'
        status, release, _ = api('GET', f'/repos/{owner}/{args.repo}/releases/tags/{urllib.parse.quote(tag)}', token, expected=(200, 404))
        if status == 404:
            _, release, _ = api('POST', f'/repos/{owner}/{args.repo}/releases', token, body={
                'tag_name': tag,
                'target_commitish': branch,
                'name': f'Бета {tag}',
                'body': notes,
                'prerelease': True,
                'draft': False,
            }, expected=(201,))
            print('Prerelease создан:', release['html_url'], flush=True)
        else:
            # Повторная публикация: синхронизируем текст/цель тега и заменим assets.
            _, release, _ = api('PATCH', f'/repos/{owner}/{args.repo}/releases/{release["id"]}', token, body={
                'target_commitish': branch,
                'name': f'Бета {tag}',
                'body': notes,
                'prerelease': True,
                'draft': False,
            }, expected=(200,))
            print('Релиз обновлён:', release['html_url'], flush=True)
        _, existing_assets, _ = api('GET', f'/repos/{owner}/{args.repo}/releases/{release["id"]}/assets?per_page=100', token)
        existing_by_name = {a['name']: a for a in existing_assets}
        for asset in args.asset:
            asset = os.path.abspath(asset)
            if not os.path.isfile(asset):
                raise PublishError('Нет release asset: ' + asset)
            asset_name = os.path.basename(asset)
            if asset_name in existing_by_name:
                api('DELETE', f'/repos/{owner}/{args.repo}/releases/assets/{existing_by_name[asset_name]["id"]}', token, expected=(204,))
                print('Старый asset заменяем:', asset_name, flush=True)
            upload_url = release['upload_url'].split('{', 1)[0]
            upload_url += '?name=' + urllib.parse.quote(asset_name)
            with open(asset, 'rb') as f:
                request('POST', upload_url, token, raw=f.read(), content_type='application/octet-stream', expected=(201,))
            print('Прикреплён asset:', asset_name, flush=True)

    print('ГОТОВО. Репозиторий:', repo['html_url'], flush=True)
    if args.enable_pages:
        print('GitHub Pages:', pages_url, flush=True)


if __name__ == '__main__':
    try:
        main()
    except PublishError as error:
        print('ОШИБКА:', error, file=sys.stderr)
        sys.exit(1)
