"""Validate native config without inference; optional scratch/source-write sandbox probe."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import finances
import flow
import runtime as rt
import isolation


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
            report['sandbox'] = isolation.probe(config)
            report['read_isolation'] = 'synthetic filesystem boundary passed' if report['sandbox']['passed'] else 'failed'
    flow.write(root / 'cli-validation.json', report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--sandbox-probe', action='store_true')
    args = parser.parse_args()
    print(json.dumps(check(finances.configuration(args.config), args.sandbox_probe), indent=2))
