"""Deterministic Finances workflow. Standard library only; no model/API dependency."""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

STAGES = ['Backlog', 'Ready', 'In Development', 'Code Review', 'QA Testing', 'Your Approval', 'Done']
ROLES = ['developer', 'reviewer', 'qa', 'orchestrator']
MODES = ['AI-owned', 'Pair programming', 'Human-owned']


class GateError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise GateError(message)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.write-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextlib.contextmanager
def lock(root):
    """A crash leaves this lock in place: inspect recovery, never guess a stale lock."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    path = root / 'controller.lock'
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise GateError(f'Controller locked: {path}. Inspect the owning process before manual recovery.') from exc
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(json.dumps({'pid': os.getpid(), 'created_at': now()}))
        yield
    finally:
        path.unlink()


def validate_ticket(ticket):
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', ticket.get('id', '')), 'Invalid ticket id')
    for field in ['title', 'requirements_version', 'goal', 'include', 'exclude']:
        require(isinstance(ticket.get(field), str) and ticket[field].strip(), f'Missing {field}')
    require(ticket.get('execution_mode') in MODES, 'Choose an explicit execution_mode')
    criteria = ticket.get('acceptance_criteria', [])
    require(criteria and all(isinstance(c, dict) and c.get('id') and c.get('expected') for c in criteria), 'Testable acceptance criteria with id and expected are required')
    require(len({c['id'] for c in criteria}) == len(criteria), 'Duplicate acceptance ids')
    require(ticket.get('repositories') and set(ticket['repositories']) <= {'frontend', 'backend'}, 'Select affected repositories')
    require(len(ticket['repositories']) == len(set(ticket['repositories'])), 'Duplicate repositories')
    require(re.fullmatch(r'[A-Za-z0-9]+', ticket.get('trello_card_id', '')), 'A Trello card id is required')
    for path in ticket.get('context_paths', []):
        require(isinstance(path, str) and path and not path.replace('\\', '/').startswith('/')
                and '..' not in path.replace('\\', '/').split('/') and ':' not in path, 'Unsafe context path')
    return ticket


def initial(ticket, refs):
    validate_ticket(ticket)
    require(set(refs) == set(ticket['repositories']), 'Provide exact commits for all affected repositories')
    require(all(re.fullmatch(r'[a-f0-9]{40}', sha) for sha in refs.values()), 'Full 40-character commits are required')
    return {
        'schema_version': 1, 'ticket': ticket, 'requirements_hash': digest(ticket),
        'stage': 'Backlog', 'base_commits': dict(refs), 'commits': dict(refs), 'prs': {}, 'results': {}, 'ci': {},
        'verification': {}, 'qa_environment': None, 'attempts': {}, 'runs': {}, 'followups': {},
        'blockers': [], 'outbox': [], 'events': [], 'approval': None,
    }


def identity(state):
    return digest({'requirements': state['requirements_hash'], 'commits': state['commits']})


def event(state, action, **details):
    state['events'].append({'at': now(), 'action': action, **details})


def move(state, stage):
    if stage == state['stage']:
        return
    before = state['stage']
    state['stage'] = stage
    operation = {'kind': 'move', 'ticket_id': state['ticket']['id'],
                 'card_id': state['ticket']['trello_card_id'], 'from': before, 'to': stage,
                 'revision': identity(state), 'sequence': len(state['events'])}
    operation['id'] = digest(operation)
    operation.update(status='pending', attempts=0)
    state['outbox'].append(operation)
    event(state, 'transition', before=before, after=stage)


def unblocked(state):
    require(not state['blockers'], 'Resolve recorded blockers first')
    require(not any(op['status'] != 'done' for op in state['outbox']), 'Synchronize the Trello outbox first')
    require(not any(run['status'] == 'running' for run in state['runs'].values()), 'A role is still running; inspect/recover it first')


def approve_ready(state, approval):
    unblocked(state)
    require(state['stage'] == 'Backlog', 'Ready approval only applies to Backlog')
    check_approval(state, approval, 'scope')
    event(state, 'scope-approved', approval=approval)
    move(state, 'Ready')


def check_approval(state, approval, kind):
    require(approval.get('approved_by') == 'Julio' and approval.get('kind') == kind, 'Julio approval is required')
    require(approval.get('ticket_id') == state['ticket']['id'] and approval.get('requirements_hash') == state['requirements_hash'], 'Approval is for different requirements')
    require(approval.get('approved_at') and approval.get('decision') == 'approved', 'Explicit dated approval required')
    if kind == 'final':
        require(approval.get('commits') == state['commits'], 'Final approval is stale')


def pin(state, refs):
    require(set(refs) == set(state['commits']) and all(re.fullmatch(r'[a-f0-9]{40}', v) for v in refs.values()), 'Invalid commit set')
    require(not any(r['status'] == 'running' for r in state['runs'].values()), 'Cannot repin a running role')
    if refs == state['commits']:
        return
    require(state['stage'] not in ['Backlog', 'Ready', 'Done'], 'Pin changes during development/rework')
    event(state, 'evidence-invalidated', previous=state['commits'], results=state['results'])
    state.update(commits=refs, results={}, ci={}, verification={}, qa_environment=None, approval=None)
    move(state, 'In Development')


def revise(state, ticket):
    validate_ticket(ticket)
    require(ticket['id'] == state['ticket']['id'] and ticket['repositories'] == state['ticket']['repositories'], 'Repository/ticket changes require a new run')
    require(not any(r['status'] == 'running' for r in state['runs'].values()), 'Cannot revise a running role')
    require(ticket['requirements_version'] != state['ticket']['requirements_version'], 'Increment requirements_version')
    event(state, 'requirements-revised', previous=state['requirements_hash'])
    state.update(ticket=ticket, requirements_hash=digest(ticket), results={}, ci={}, verification={}, qa_environment=None, approval=None)
    move(state, 'Backlog')


def check_result(state, role, result, run_id):
    require(role in ROLES, 'Unknown role')
    run = state['runs'].get(run_id)
    require(run and run['role'] == role and run['revision'] == identity(state), 'Unrecognized or stale role run')
    require(run['status'] == 'awaiting-result', 'Role process did not finish successfully')
    require(result.get('role') == role and result.get('run_id') == run_id, 'Result does not identify its run')
    require(result.get('requirements_hash') == state['requirements_hash'] and result.get('commits') == state['commits'], 'Result refers to stale requirements/commits')
    for other_role, previous in state['results'].items():
        require(other_role == role or previous['session_id'] != result.get('session_id'), 'Roles must have separate sessions')
    require(result.get('session_id') == run.get('session_id') and result['session_id'], 'Session identity must match trusted CLI events')
    require(result.get('summary') and result.get('limitations') is not None, 'Summary and limitations required')
    findings = result.get('findings', [])
    require(len({f['id'] for f in findings}) == len(findings), 'Duplicate finding id')
    for finding in findings:
        require(finding.get('severity') in ['blocking', 'minor', 'uncertain'], 'Classify findings by impact')
        require(all(finding.get(k) for k in ['id', 'title', 'impact', 'evidence']), 'Findings need impact and evidence')
    for other_role, previous in state['results'].items():
        if other_role != role:
            require(not ({f['id'] for f in findings} & {f['id'] for f in previous.get('findings', [])}), 'Finding ids must be globally unique; prefix them with the role')
    if role in ['developer', 'qa'] and result.get('verdict') in ['READY', 'PASS', 'PASS WITH FOLLOW-UPS']:
        expected = {c['id'] for c in state['ticket']['acceptance_criteria']}
        actual = result.get('acceptance_results', [])
        require({a['id'] for a in actual} == expected and len(actual) == len(expected), 'Report every acceptance criterion exactly once')
        require(all(a.get('result') == 'pass' and a.get('evidence') for a in actual), 'Acceptance results must pass with evidence')
    if role == 'qa':
        require(result.get('environment') and result.get('integration') in ['real', 'mocked', 'not-tested'], 'Describe the tested environment/integration')
        require(not state['ticket'].get('requires_integration') or result['integration'] == 'real' or result['verdict'] in ['FAIL', 'BLOCKED'], 'Mocked behavior does not establish integration')
        if state['ticket'].get('ui_changed') and result['verdict'] in ['PASS', 'PASS WITH FOLLOW-UPS']:
            shots = result.get('screenshots', [])
            require(shots and all(s.get('path') and s.get('caption') and s.get('state') for s in shots), 'Captioned screenshots required for UI QA')
        else:
            require(result.get('screenshots') or result.get('screenshot_not_applicable'), 'Explain when screenshots are not applicable')
    verdicts = {'developer': ['READY', 'BLOCKED'], 'reviewer': ['PASS', 'CHANGES REQUESTED', 'BLOCKED'],
                'qa': ['PASS', 'PASS WITH FOLLOW-UPS', 'FAIL', 'BLOCKED'], 'orchestrator': ['RECOMMEND', 'BLOCKED']}
    require(result.get('verdict') in verdicts[role], 'Invalid verdict for role')
    if result['verdict'] == 'BLOCKED':
        blocker = result.get('blocker') or {}
        require(all(blocker.get(key) for key in ['reason', 'owner', 'next_action']), 'Blocked reports need reason, resolver and next action')
    has_blocker = any(f['severity'] == 'blocking' for f in findings)
    require(not has_blocker or result['verdict'] in ['CHANGES REQUESTED', 'FAIL', 'BLOCKED'], 'Blocking findings cannot pass')
    if role == 'qa':
        minor = any(f['severity'] == 'minor' for f in findings)
        require(not (result['verdict'] == 'PASS' and findings), 'PASS means no defects')
        require(result['verdict'] != 'PASS WITH FOLLOW-UPS' or minor, 'PASS WITH FOLLOW-UPS needs minor findings')


def accept_result(state, role, result, run_id):
    check_result(state, role, result, run_id)
    state['results'][role] = result
    state['runs'][run_id]['status'] = 'complete'
    event(state, 'role-result', role=role, run_id=run_id, verdict=result['verdict'])
    if result['verdict'] == 'BLOCKED':
        require(result.get('blocker'), 'A blocked result needs owner/next action')
        add_blocker(state, **result['blocker'])
    elif result['verdict'] in ['CHANGES REQUESTED', 'FAIL']:
        state['results'].pop('developer', None)
        if role == 'reviewer':
            state['results'].pop('qa', None)
        move(state, 'In Development')


def add_blocker(state, reason, owner, next_action):
    require(reason and owner and next_action, 'Blocker needs reason, resolver and next action')
    value = {'reason': reason, 'owner': owner, 'next_action': next_action}
    if value not in state['blockers']:
        state['blockers'].append(value)
    event(state, 'blocked', **value)


def passing(state, role, verdicts):
    result = state['results'].get(role, {})
    require(result.get('verdict') in verdicts and result.get('commits') == state['commits'] and result.get('requirements_hash') == state['requirements_hash'], f'Current {role} result required')
    require(not any(f['severity'] in ['blocking', 'uncertain'] for f in result.get('findings', [])), 'Resolve blocking findings; Julio decides uncertain severity')
    for finding in result.get('findings', []):
        if finding['severity'] == 'minor':
            followup = state['followups'].get(finding['id'], {})
            require(followup.get('verified') and followup.get('revision') == identity(state), 'Verify linked Backlog follow-ups before advancing')


def advance(state):
    unblocked(state)
    stage = state['stage']
    if stage == 'Ready':
        move(state, 'In Development')
    elif stage == 'In Development':
        passing(state, 'developer', ['READY'])
        require(set(state['verification']) == set(state['commits']), 'Run deterministic verification for all affected repos')
        require(set(state['ci']) == set(state['commits']), 'Verify passing CI for all affected repos')
        for repo, commit in state['commits'].items():
            require(state['verification'][repo].get('commit') == commit and state['verification'][repo].get('passed'), 'Local checks are stale/failed')
            require(state['ci'][repo].get('commit') == commit and state['ci'][repo].get('passed'), 'CI is stale/failed')
        require(set(state['prs']) == set(state['commits']), 'Linked PRs required')
        move(state, 'Code Review')
    elif stage == 'Code Review':
        passing(state, 'reviewer', ['PASS'])
        move(state, 'QA Testing')
    elif stage == 'QA Testing':
        passing(state, 'reviewer', ['PASS'])
        passing(state, 'qa', ['PASS', 'PASS WITH FOLLOW-UPS'])
        move(state, 'Your Approval')
    else:
        raise GateError('Use scope approval for Ready and explicit final approval/merge verification for Done')


def complete(state, approval, merged):
    unblocked(state)
    require(state['stage'] == 'Your Approval', 'Final approval is after QA')
    passing(state, 'reviewer', ['PASS'])
    passing(state, 'qa', ['PASS', 'PASS WITH FOLLOW-UPS'])
    check_approval(state, approval, 'final')
    require(set(merged) == set(state['commits']) and all(merged.values()), 'Every relevant PR must be merged at the approved head')
    state['approval'] = approval
    event(state, 'final-approved', approval=approval)
    move(state, 'Done')
