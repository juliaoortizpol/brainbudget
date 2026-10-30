"""Bounded Developer units. Progress is never a ticket-level verdict."""
from datetime import datetime, timezone
import math
import re
import flow


def current(state):
    plan = state.get('development_plan')
    if plan:
        flow.require(plan['requirements_hash'] == state['requirements_hash'], 'Subtask plan is stale; install a revised plan')
    return plan


def install(state, units):
    flow.require(state['stage'] == 'In Development', 'Plan only approved development')
    flow.require(not any(r['status'] == 'running' for r in state['runs'].values()), 'Role still running')
    flow.require(not state.get('development_plan'), 'Existing plan must be retained; use a revised ticket for a new plan')
    flow.require(isinstance(units, list) and 0 < len(units) <= 30, 'Provide 1–30 ordered units')
    ids = set()
    for unit in units:
        flow.require(isinstance(unit, dict), 'Invalid unit')
        flow.require(re.fullmatch(r'[A-Za-z0-9_-]{1,64}', unit.get('id', '')) and unit['id'] not in ids, 'Unique unit id required')
        ids.add(unit['id'])
        for key in ['goal', 'verification']:
            flow.require(isinstance(unit.get(key), str) and unit[key].strip(), f'Unit needs {key}')
        flow.require(isinstance(unit.get('repositories'), list) and unit['repositories'] and set(unit['repositories']) <= set(state['commits']), 'Unit repositories must be in ticket scope')
    state['development_plan'] = {'requirements_hash': state['requirements_hash'], 'units': [dict(u, status='pending', attempts=0, checkpoints=[]) for u in units]}
    state['results'].pop('developer', None)
    flow.event(state, 'development-plan-installed', units=list(ids))


def next_unit(state):
    plan = current(state)
    return next((u for u in plan['units'] if u['status'] != 'done'), None) if plan else None


def admit(snapshot, estimate, now=None):
    """Trusted-host snapshot; percentage estimates, not fabricated token balances."""
    now = now or datetime.now(timezone.utc)
    flow.require(isinstance(estimate, (float, int)) and not isinstance(estimate, bool) and math.isfinite(estimate) and 0 < estimate < 85, 'Supply a conservative estimated upper percentage cost (0–85)')
    age = (now - datetime.fromisoformat(snapshot['observed_at'])).total_seconds()
    flow.require(0 <= age <= 300, 'Usage snapshot stale/future; refresh from host')
    windows = snapshot.get('windows')
    flow.require(isinstance(windows, list) and windows, 'Applicable usage windows required')
    resets = []
    for window in windows:
        remaining = window.get('remaining_percent')
        reset = window.get('resets_at')
        flow.require(isinstance(remaining, (int, float)) and not isinstance(remaining, bool) and math.isfinite(remaining) and 0 <= remaining <= 100, 'Unknown/invalid usage')
        flow.require(isinstance(reset, (int, float)) and math.isfinite(reset) and reset > now.timestamp(), 'Refresh expired usage window')
        if remaining <= estimate + 15:
            resets.append(reset)
    return max(resets) + 120 if resets else None


def checkpoint(state, unit, run_id, report, inventory):
    flow.require(report.get('summary') and report.get('limitations') is not None, 'Checkpoint needs summary and limitations')
    flow.require(report.get('verdict') == 'BLOCKED', 'Subtask must return BLOCKED for trusted checkpointing, never ticket READY')
    unit['checkpoints'].append({'run_id': run_id, 'summary': report['summary'], 'evidence': report.get('evidence', []), 'limitations': report['limitations'], 'inventory': inventory, 'at': flow.now()})
    unit['status'] = 'awaiting-checkpoint'
    state['runs'][run_id]['status'] = 'checkpointed'
    flow.event(state, 'developer-checkpoint', unit=unit['id'], run_id=run_id)


def finish(state, unit_id, evidence):
    unit = next_unit(state)
    flow.require(unit and unit['id'] == unit_id and unit['status'] == 'awaiting-checkpoint', 'Complete only the current checkpointed unit')
    flow.require(evidence.strip(), 'Record trusted verification evidence')
    unit.update(status='done', committed= dict(state['commits']), verification_evidence=evidence)
    flow.event(state, 'developer-unit-completed', unit=unit_id)
