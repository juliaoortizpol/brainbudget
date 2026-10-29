"""Native filesystem profiles and synthetic MXC boundary checks. No model calls."""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import flow
import runtime as rt

PROFILE = 'finances-isolated'
VERSION = 1


def overrides(settings):
    args = []
    for key, value in settings.items():
        if isinstance(value, dict):
            encoded = '{' + ', '.join(json.dumps(k) + ' = ' + json.dumps(v) for k, v in value.items()) + '}'
        else:
            encoded = json.dumps(value, ensure_ascii=True)
        args += ['-c', key + '=' + encoded]
    return args


def tool_roots(config):
    # These are executable installations, never a user home or credential directory.
    roots = {Path(sys.executable).resolve().parent}
    node = Path(config['node']).resolve().parent
    roots.add(node.parent if node.name.lower() == 'bin' else node)
    git = shutil.which('git')
    flow.require(git, 'Git installation is required')
    git = Path(git).resolve().parent
    roots.add(git.parent if git.name.lower() in ['cmd', 'bin'] else git)
    home = Path.home().resolve()
    for root in roots:
        flow.require(root.parent != root and not home.is_relative_to(root),
                     'Executable installation root would expose a drive/home ancestor; choose a dedicated installation')
    return sorted(str(root) for root in roots)


def settings(config, role, scratch, sources, read_roots=()):
    flow.require(role in flow.ROLES, 'Unknown role')
    # No extends: temporary locations receive no implicit write grant. TEMP points to scratch.
    filesystem = {':root': 'deny', ':minimal': 'read'}
    for root in tool_roots(config):
        filesystem[str(Path(root).resolve())] = 'read'
    for root in read_roots:
        filesystem[str(Path(root).resolve())] = 'read'
    filesystem[str(Path(scratch).resolve())] = 'write'
    for root in sources.values():
        root = Path(root).resolve()
        filesystem[str(root)] = 'write' if role == 'developer' else 'read'
        # Exact carveouts protect even files created after a sandbox command starts.
        for name in ['.git', '.agents', '.codex', '.aws', '.ssh']:
            filesystem[str(root / name)] = 'read' if name == '.git' else 'deny'
        for name in ['.env', '.env.local', '.env.production', '.env.development', '.env.test']:
            filesystem[str(root / name)] = 'deny'
    return {
        'default_permissions': PROFILE,
        'permissions.' + PROFILE + '.filesystem': filesystem,
        'permissions.' + PROFILE + '.network.enabled': False,
        'windows.sandbox': 'mxc',
        'approval_policy': 'never',
    }


def fingerprint(config):
    files = [Path(__file__), rt.BASE / 'finances.py', rt.BASE / 'runtime.py', *sorted((rt.BASE / 'config').glob('*.toml'))]
    return flow.digest({'version': VERSION, 'codex': rt.command([config['codex'], '--version']),
                        'codex_path': str(Path(config['codex']).resolve()),
                        'platform': platform.platform(), 'tool_roots': tool_roots(config),
                        'files': {p.name: flow.digest(p.read_bytes().hex()) for p in files}})


def validate_receipt(config):
    path = Path(config['state_root']) / 'setup-validation' / 'workspace-isolation.json'
    flow.require(path.is_file(), 'Run isolation.py --config FILE to validate native workspace isolation first')
    report = flow.read(path)
    flow.require(report.get('passed') is True and report.get('fingerprint') == fingerprint(config),
                 'Workspace isolation receipt is failed/stale; rerun isolation.py on this host')
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(report['at'])).total_seconds()
    flow.require(0 <= age <= 86400, 'Workspace isolation receipt expired; rerun the probe (24-hour validity)')


def probe(config):
    flow.require(os.name == 'nt', 'This native workspace probe requires Windows MXC; no weaker fallback is selected')
    parent = Path(config['state_root']) / 'setup-validation'
    root = parent / ('workspace-' + str(uuid.uuid4()))
    root.mkdir(parents=True)
    outside = root / 'unrelated'; outside.mkdir()
    (outside / 'private.txt').write_text('synthetic unrelated marker')
    controller = root / 'controller.json'; controller.write_text('synthetic controller state')
    shared = root / 'shared'; shared.mkdir()
    (shared / 'policy.txt').write_text('synthetic read-only shared policy')
    source = root / 'assigned'; source.mkdir()
    (source / 'code.txt').write_text('synthetic source')
    (source / '.env').write_text('SYNTHETIC_SECRET=not-a-real-secret')
    (source / '.git').mkdir(); (source / '.git/config').write_text('synthetic git metadata')
    # A controlled junction tests path aliases without reading any personal file.
    junction = source / 'escape'
    junction_result = subprocess.run(['cmd.exe', '/d', '/c', 'mklink', '/J', str(junction), str(outside)],
                                     capture_output=True, timeout=30)
    program = r'''
import json, pathlib, subprocess, sys
source, outside, controller, shared, writable, readable, node, git = sys.argv[1:]
source, outside, controller, shared = map(pathlib.Path, [source, outside, controller, shared])
def read_ok(path):
    try:
        path.read_bytes(); return True
    except PermissionError:
        return False
def write_ok(path):
    try:
        with path.open('a') as stream: stream.write('synthetic append')
        return True
    except PermissionError:
        return False
scratch = pathlib.Path.cwd() / 'scratch.txt'
scratch.write_text('synthetic scratch')
child = subprocess.run([sys.executable, '-c', 'import pathlib,sys; pathlib.Path(sys.argv[1]).read_bytes()', str(outside / 'private.txt')], capture_output=True)
print(json.dumps({
    'scratch_write': scratch.is_file(),
    'source_read_matches_role': read_ok(source / 'code.txt') == (readable == 'yes'),
    'source_write_matches_role': write_ok(source / 'code.txt') == (writable == 'yes'),
    'git_metadata_read_matches_role': read_ok(source / '.git/config') == (readable == 'yes'),
    'git_metadata_write_denied': not write_ok(source / '.git/config'),
    'env_read_denied': not read_ok(source / '.env'),
    'unrelated_read_denied': not read_ok(outside / 'private.txt'),
    'unrelated_write_denied': not write_ok(outside / 'private.txt'),
    'controller_read_denied': not read_ok(controller),
    'controller_write_denied': not write_ok(controller),
    'shared_policy_read': read_ok(shared / 'policy.txt'),
    'shared_policy_write_denied': not write_ok(shared / 'policy.txt'),
    'node_runs': subprocess.run([node, '--version'], capture_output=True).returncode == 0,
    'git_runs': subprocess.run([git, '--version'], capture_output=True).returncode == 0,
    'child_unrelated_read_denied': child.returncode != 0,
    'junction_read_denied': not read_ok(source / 'escape/private.txt'),
    'junction_write_denied': not write_ok(source / 'escape/private.txt')
}))
'''
    report = {'version': VERSION, 'at': flow.now(), 'inference_started': False,
              'fingerprint': fingerprint(config), 'sandbox': 'mxc', 'roles': {}, 'passed': False,
              'scope': 'Filesystem commands and descendants; not an OS account, credential-keyring or tool audit'}
    try:
        flow.require(junction_result.returncode == 0, 'Controlled junction creation failed; boundary probe is incomplete')
        for role in flow.ROLES:
            scratch = root / role / 'scratch'; scratch.mkdir(parents=True)
            sources = {'synthetic': source} if role != 'orchestrator' else {}
            policy = settings(config, role, scratch, sources, [shared])
            args = [config['codex'], *overrides(policy), 'sandbox', '--include-managed-config',
                    '--permission-profile', PROFILE, '-C', str(scratch), '--', sys.executable,
                    '-c', program, str(source), str(outside), str(controller), str(shared),
                    'yes' if role == 'developer' else 'no', 'yes' if sources else 'no', config['node'], shutil.which('git')]
            result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace',
                                    env=rt.clean_env(scratch, config['node']), timeout=60)
            records = []
            for line in result.stdout.splitlines():
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
            report['roles'][role] = {'exit_code': result.returncode, 'checks': records[-1] if records else {},
                                     'passed': result.returncode == 0 and bool(records) and all(records[-1].values())}
            # Never log arbitrary stderr or marker contents as evidence.
        report['passed'] = all(r['passed'] for r in report['roles'].values()) and len(report['roles']) == len(flow.ROLES)
    finally:
        # Unlink the junction itself before deleting the owned probe tree; never recurse through it.
        if junction.exists():
            os.rmdir(junction)
        flow.write(parent / 'workspace-isolation.json', report)
        flow.require(root.resolve().parent == parent.resolve() and root.name.startswith('workspace-'),
                     'Refusing cleanup outside the owned workspace probe directory')
        shutil.rmtree(root)
    return report


if __name__ == '__main__':
    import finances
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    try:
        result = probe(finances.configuration(args.config))
        print(json.dumps(result, indent=2))
        sys.exit(0 if result['passed'] else 2)
    except (flow.GateError, OSError, subprocess.TimeoutExpired) as error:
        print('Workspace validation failed: ' + str(error), file=sys.stderr)
        sys.exit(2)
