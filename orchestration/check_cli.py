"""Validate native config without inference; optional scratch/source-write sandbox probe."""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import finances
import flow
import runtime as rt


def check(config, sandbox=False):
    root = Path(config['state_root']) / 'setup-validation'
    root.mkdir(parents=True, exist_ok=True)
    report = {'codex': rt.command([config['codex'], '--version']), 'inference_started': False,
              'native_config': {}, 'sandbox': 'not probed', 'read_isolation': 'not validated',
              'network_isolation': 'configured, not probed', 'credentials_and_tools': 'not validated'}
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        directory = Path(temporary)
        scratch = directory / 'scratch'; scratch.mkdir()
        state = {'ticket': {'id': 'SETUP-CONFIG-PROBE'}, 'requirements_hash': 'setup-only',
                 'base_commits': {}, 'commits': {}, 'prs': {}, 'results': {}, 'ci': {},
                 'verification': {}, 'qa_environment': None, 'stage': 'Backlog', 'blockers': [], 'attempts': {}}
        for role in flow.ROLES:
            args, prompt, env = finances.role_command(config, state, role, directory, 'setup-only', {})
            # Deliberately missing schema: exits before any model turn, even if config is valid.
            args[args.index('--output-schema') + 1] = str(directory / 'deliberately-missing-schema.json')
            result = subprocess.run(args, input=prompt, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env, timeout=60)
            text = result.stdout + result.stderr
            report['native_config'][role] = {'accepted_to_schema_validation': 'Failed to read output schema file' in text,
                                             'host_access_warning': 'Access is denied' in text or 'failed to open state db' in text}
        if sandbox:
            denied = directory / 'canonical-source-probe.txt'
            program = '''import json, pathlib, sys
scratch = pathlib.Path.cwd() / 'scratch-probe.txt'
scratch.write_text('synthetic probe')
denied = False
try:
    pathlib.Path(sys.argv[1]).write_text('synthetic unexpected write')
except PermissionError:
    denied = True
print(json.dumps({'scratch_writable': scratch.exists(), 'source_write_denied': denied}))
'''
            args = [config['codex'], 'sandbox', '--permission-profile', ':workspace', '-C', str(scratch),
                    '-c', 'sandbox_workspace_write.network_access=false', '-c', 'sandbox_workspace_write.writable_roots=[]',
                    '--', sys.executable, '-c', program, str(denied)]
            result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace', env=rt.clean_env(scratch, config['node']), timeout=60)
            records = []
            for line in result.stdout.splitlines():
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
            report['sandbox'] = records[-1] if records else {'validated': False, 'exit_code': result.returncode, 'next_action': 'Inspect native Windows sandbox setup; no raw diagnostic output copied'}
    flow.write(root / 'cli-validation.json', report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--sandbox-probe', action='store_true')
    args = parser.parse_args()
    print(json.dumps(check(finances.configuration(args.config), args.sandbox_probe), indent=2))
