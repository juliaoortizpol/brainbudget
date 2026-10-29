"""Trusted host operations. Credentials never enter role prompts or child environments."""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import signal
import subprocess
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from flow import GateError, require, digest, now, write

BASE = Path(__file__).resolve().parent
REPOSITORIES = {'frontend': 'chillbudget', 'backend': 'brainbudget'}
CHECKS = {
    'frontend': [['eslint/bin/eslint.js', '.'], ['typescript/bin/tsc', '-b'],
                 ['vitest/vitest.mjs', 'run'], ['vite/bin/vite.js', 'build']],
    'backend': [['eslint/bin/eslint.js', '{src,apps,libs,test}/**/*.ts'],
                ['typescript/bin/tsc', '--noEmit', '--incremental', 'false', '-p', 'tsconfig.json'],
                ['jest/bin/jest.js', '--ci', '--runInBand'], ['@nestjs/cli/bin/nest.js', 'build'],
                ['tsc-alias/dist/bin/index.js', '-p', 'tsconfig.build.json']],
}


def clean_env(scratch=None, node=None):
    keys = ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'USERPROFILE', 'HOME',
            'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP', 'CODEX_HOME']
    env = {k: os.environ[k] for k in keys if k in os.environ}
    if node:
        env['PATH'] = str(Path(node).resolve().parent) + os.pathsep + env.get('PATH', '')
    env['GIT_TERMINAL_PROMPT'] = '0'
    if scratch:
        scratch = Path(scratch).resolve()
        scratch.mkdir(parents=True, exist_ok=True)
        env.update(TEMP=str(scratch), TMP=str(scratch), TMPDIR=str(scratch),
                   npm_config_cache=str(scratch / 'npm-cache'))
    return env


def kill_tree(process):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=30)
    else:
        os.killpg(process.pid, signal.SIGKILL)


def command(args, cwd=None, timeout=120, env=None):
    options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
    process = subprocess.Popen([str(a) for a in args], cwd=cwd, env=env,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                               encoding='utf-8', errors='replace', **options)
    try:
        output, _stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        kill_tree(process)
        process.communicate(timeout=30)
        raise GateError('Command exceeded its bounded timeout; process-tree termination requested. Inspect before retrying') from exc
    require(process.returncode == 0, f'Command failed ({Path(str(args[0])).name}, exit {process.returncode}); inspect locally. No raw logs copied to role context.')
    return output.strip()


def git(repo, *args):
    return command(['git', '-C', repo, *args], env=clean_env())


def head(repo):
    return git(repo, 'rev-parse', 'HEAD')


def checkout(source, destination, commit, branch=None):
    destination = Path(destination)
    require(not destination.exists(), 'Checkout already exists; resume it instead of recreating')
    destination.parent.mkdir(parents=True, exist_ok=True)
    command(['git', 'clone', '--no-hardlinks', '--no-checkout', '--', source, destination], env=clean_env())
    git(destination, 'checkout', '--detach', commit)
    if branch:
        git(destination, 'switch', '-c', branch)
    # The role cannot publish through this remote. Trusted publication is a separate broker step.
    git(destination, 'remote', 'remove', 'origin')


def snapshot(source, destination, commit):
    """Tracked files only: no .git, untracked .env, dependency tree, or prior conversation."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    archive = subprocess.run(['git', '-C', str(source), 'archive', commit], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        members = []
        for member in tar.getmembers():
            path = Path(member.name)
            require(not path.is_absolute() and '..' not in path.parts and ':' not in member.name, 'Unsafe archive path')
            if any(p.startswith('.env') or p in {'.git', '.codex', '.agents'} for p in path.parts):
                continue
            require(not member.issym() and not member.islnk() and not member.isdev(), 'Archive links/devices require manual inspection')
            members.append(member)
        tar.extractall(destination, members=members, filter='data')
    return tree_hash(destination)


def tree_hash(root):
    root = Path(root)
    return digest([(str(p.relative_to(root)).replace('\\', '/'), digest(p.read_bytes().hex()))
                   for p in sorted(root.rglob('*')) if p.is_file()])


class API:
    def __init__(self, service):
        self.service = service
        self.base = 'https://api.github.com' if service == 'github' else 'https://api.trello.com/1'
        self.token = os.environ.get('FINANCES_GITHUB_TOKEN' if service == 'github' else 'FINANCES_TRELLO_TOKEN')

    def call(self, method, path, data=None):
        require(path.startswith('/') and '://' not in path and '..' not in path, 'Invalid API path')
        if self.service == 'trello':
            require(self.token, 'Trello broker pending: provide a scoped FINANCES_TRELLO_TOKEN on the trusted host only')
        headers = {'Accept': 'application/json', 'User-Agent': 'finances-workflow/1'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        body = json.dumps(data).encode() if data is not None else None
        if body:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(self.base + path, data=body, headers=headers, method=method)
        try:
            # No automatic retry of writes: reconcile a possibly completed operation first.
            base = self.base
            class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, response_headers, new_url):
                    require(urllib.parse.urlsplit(new_url)[:2] == urllib.parse.urlsplit(base)[:2], 'Cross-origin API redirect refused before forwarding credentials')
                    return super().redirect_request(req, fp, code, msg, response_headers, new_url)
            with urllib.request.build_opener(SameOriginRedirect()).open(request, timeout=30) as response:
                require(response.geturl().startswith(self.base + '/'), 'Unexpected API redirect')
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise GateError(f'{self.service} HTTP {exc.code}; no credential-bearing request or response logged') from None
        except (urllib.error.URLError, TimeoutError):
            raise GateError(f'{self.service} request interrupted; reconcile remote state before retrying') from None


def pr_number(url, repo):
    match = re.fullmatch(r'https://github\.com/juliaoortizpol/' + REPOSITORIES[repo] + r'/pull/([1-9][0-9]*)', url)
    require(match, f'Expected a canonical {repo} PR URL')
    return int(match[1])


def github_ci(repo, commit, url, api=None):
    api = api or API('github')
    prefix = '/repos/juliaoortizpol/' + REPOSITORIES[repo]
    pr = api.call('GET', f'{prefix}/pulls/{pr_number(url, repo)}')
    require(pr['head']['sha'] == commit and pr['head']['repo']['full_name'] == 'juliaoortizpol/' + REPOSITORIES[repo], 'PR head/repository differs from pinned commit')
    runs = api.call('GET', f'{prefix}/actions/runs?head_sha={commit}&event=pull_request&per_page=100')['workflow_runs']
    candidates = [r for r in runs if r['name'] == ('Frontend CI' if repo == 'frontend' else 'Backend CI') and r['head_sha'] == commit]
    require(candidates, 'No CI run for exact PR head')
    run = max(candidates, key=lambda r: r['id'])
    require(run['status'] == 'completed' and run['conclusion'] == 'success', 'Latest CI is not successful')
    jobs = []
    for page in range(1, 21):
        batch = api.call('GET', f"{prefix}/actions/runs/{run['id']}/jobs?filter=latest&per_page=100&page={page}")['jobs']
        jobs.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise GateError('Too many CI job pages; inspect manually')
    prefix_name = 'frontend-' if repo == 'frontend' else 'backend-'
    expected = {prefix_name + name for name in ['lint', 'types', 'unit', 'build', 'required']}
    passed = {job['name'] for job in jobs if job['status'] == 'completed' and job['conclusion'] == 'success'}
    require(expected <= passed, 'All named jobs, including unit tests and the required gate, must pass')
    return {'commit': commit, 'passed': True, 'run_id': run['id'], 'url': run['html_url'], 'checked_at': now()}


def merged_pr(repo, commit, url, api=None):
    api = api or API('github')
    pr = api.call('GET', f'/repos/juliaoortizpol/{REPOSITORIES[repo]}/pulls/{pr_number(url, repo)}')
    return pr['merged'] is True and pr['head']['sha'] == commit


def synchronize(state, config, api=None, limit=3):
    """Only this trusted controller writes board state; retries always GET before PUT."""
    api = api or API('trello')
    board = config['trello']['board_id']
    lists = config['trello']['lists']
    require(board and lists, 'Configure the Trello board/list ids first')
    for op in state['outbox']:
        if op['status'] == 'done':
            continue
        require(op['attempts'] < limit, 'Trello attempt limit reached; operator must inspect and explicitly retry')
        op['attempts'] += 1
        card = api.call('GET', f"/cards/{urllib.parse.quote(op['card_id'], safe='')}?fields=idBoard,idList,closed")
        require(card['idBoard'] == board, 'Card is on another board')
        require(not card.get('closed', False), 'Card is archived; reconcile with Julio')
        target = lists.get(op['to'])
        require(target, 'Missing destination list')
        if card['idList'] != target:
            require(card['idList'] == lists.get(op['from']), 'Unexpected remote list; reconcile with Julio')
            api.call('PUT', f"/cards/{op['card_id']}", {'idList': target})
            card = api.call('GET', f"/cards/{op['card_id']}?fields=idBoard,idList")
        require(card['idList'] == target and card['idBoard'] == board, 'Trello move not verified')
        op.update(status='done', completed_at=now())


def followup(state, finding, config, api=None, existing_id=None):
    """One serialized writer; marker search reconciles an interrupted create."""
    api = api or API('trello')
    board = config['trello']['board_id']
    backlog = config['trello']['lists'].get('Backlog')
    require(board and backlog, 'Configure the Trello broker first')
    marker = 'finances-defect:' + digest({'ticket': state['ticket']['id'], 'finding': finding['id'], 'requirements': state['requirements_hash']})
    cards = api.call('GET', f'/boards/{board}/cards?filter=all&fields=id,name,desc,idList,url,closed')
    require(len(cards) < 1000, 'Large board duplicate search requires manual reconciliation; no card created')
    matches = [c for c in cards if marker in c.get('desc', '')]
    require(len(matches) <= 1, 'Duplicate follow-up marker found; Julio must reconcile')
    if existing_id:
        require(not matches or matches[0]['id'] == existing_id, 'Existing marker identifies another follow-up')
        matches = [c for c in cards if c['id'] == existing_id]
        require(len(matches) == 1, 'Select an existing card on this board')
    if not matches:
        require(not any(c.get('name', '').strip().casefold() == finding['title'].strip().casefold() for c in cards),
                'Possible duplicate title found; select an existing card explicitly before creating a follow-up')
    original_path = f"/cards/{state['ticket']['trello_card_id']}"
    original = api.call('GET', original_path + '?fields=desc,idBoard,url')
    require(original['idBoard'] == board and original['url'].startswith('https://trello.com/c/'), 'Original must be a canonical card on this board')
    source_link = 'Original: ' + original['url']
    if matches:
        card = matches[0]
    else:
        card = api.call('POST', '/cards', {'idList': backlog, 'name': finding['title'],
            'desc': f"{marker}\n{source_link}\nImpact: {finding['impact']}\nReproduction/evidence: {finding['evidence']}"})
    require(card['idList'] == backlog and not card.get('closed', False), 'Follow-up must be open in Backlog before original advances')
    require(card['url'].startswith('https://trello.com/c/'), 'Expected canonical follow-up URL')
    if marker not in card.get('desc', '') or source_link not in card.get('desc', ''):
        api.call('PUT', f"/cards/{card['id']}", {'desc': card.get('desc', '') + f"\n{marker}\n{source_link}"})
    backlink = f"\n{marker}\nFollow-up: {card['url']}"
    if marker not in original.get('desc', '') or card['url'] not in original.get('desc', ''):
        api.call('PUT', original_path, {'desc': original.get('desc', '') + backlink})
    actual = api.call('GET', f"/cards/{card['id']}?fields=desc,idList,url,closed")
    original = api.call('GET', original_path + '?fields=desc')
    require(marker in actual['desc'] and source_link in actual['desc'] and marker in original['desc'] and card['url'] in original['desc']
            and actual['idList'] == backlog and not actual.get('closed', False), 'Bidirectional follow-up verification failed')
    return {'id': card['id'], 'url': card['url'], 'verified': True, 'revision': digest({'requirements': state['requirements_hash'], 'commits': state['commits']})}


def verify_checkout(repo, checkout_path, config, output):
    require(not git(checkout_path, 'status', '--porcelain'), 'Verification requires a clean committed checkout')
    commit = head(checkout_path)
    env = clean_env(Path(output).parent / 'scratch', config['node'])
    require(command([config['node'], '--version']).startswith('v24.'), 'Node 24 required')
    # Dependency lifecycle scripts execute only in the isolated, synthetic verification copy.
    npm = Path(config['node']).parent / 'node_modules/npm/bin/npm-cli.js'
    if not npm.exists():
        candidate = shutil.which('npm.cmd') or shutil.which('npm')
        require(candidate, 'npm unavailable')
        npm = Path(candidate).parent / 'node_modules/npm/bin/npm-cli.js'
    require(npm.exists(), 'Set node to a Node 24 installation with npm alongside it')
    command([config['node'], npm, 'ci', '--no-audit', '--no-fund'], cwd=checkout_path, env=env, timeout=900)
    checks = []
    for args in CHECKS[repo]:
        command([config['node'], Path(checkout_path) / 'node_modules' / args[0], *args[1:]], cwd=checkout_path, env=env, timeout=900)
        checks.append(args)
    require(head(checkout_path) == commit and not git(checkout_path, 'status', '--porcelain'), 'Verification changed tracked source or commit')
    result = {'commit': commit, 'passed': True, 'checks': checks, 'verified_at': now()}
    write(output, result)
    return result
