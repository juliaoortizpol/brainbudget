"""Trusted chat-to-controller adapter. No credentials, model calls or scheduling APIs."""
from datetime import datetime, timezone
import math
import flow
import subtasks


def normalize(raw, observed_at):
    flow.require(raw.get('ordinaryUsageAllowed') is True, 'Host has not confirmed usage is allowed')
    buckets = raw.get('rateLimitsByLimitId')
    if not buckets:
        legacy = raw.get('rateLimits')
        buckets = {legacy.get('limitId', 'codex'): legacy} if legacy else {}
    flow.require(buckets, 'Usage unavailable')
    windows = []
    for key, bucket in buckets.items():
        flow.require(isinstance(bucket, dict) and bucket.get('spendControlReached') is not True, 'Usage bucket blocked or unavailable')
        # Both account windows must be observable; never interpret null as unlimited.
        for name in ['primary', 'secondary']:
            value = bucket.get(name)
            flow.require(isinstance(value, dict), 'Usage window missing; supervised inspection required')
            used = value.get('usedPercent')
            flow.require(isinstance(used, (int, float)) and not isinstance(used, bool) and math.isfinite(used) and 0 <= used <= 100, 'Invalid used percentage')
            windows.append({'bucket': key, 'window': name, 'remaining_percent': 100-used, 'resets_at': value.get('resetsAt')})
    snapshot = {'observed_at': observed_at, 'source': 'trusted-host-tool', 'windows': windows}
    subtasks.admit(snapshot, 1)  # Validate timestamps and types; low usage is still a valid observation.
    return snapshot


def intent(state):
    wait = state.get('usage_wait')
    flow.require(wait and wait.get('status') == 'WAITING_FOR_USAGE', 'No deferred work')
    flow.require(wait['requirements_hash'] == state['requirements_hash'] and wait['commits'] == state['commits'], 'Deferred identity changed')
    return flow.digest({'ticket': state['ticket']['id'], 'wait': {k: wait[k] for k in ['requirements_hash', 'commits', 'unit', 'resume_not_before']}})


def confirm(state, receipt):
    key = intent(state)
    flow.require(receipt.get('intent_key') == key and receipt.get('status') == 'ACTIVE' and receipt.get('automation_id'), 'Need matching confirmed active scheduler receipt')
    old = state['usage_wait'].get('automation_id')
    flow.require(not old or old == receipt['automation_id'], 'Reconcile existing automation before replacing it')
    state['usage_wait'].update(scheduled=True, automation_id=receipt['automation_id'], intent_key=key)
    flow.event(state, 'usage-wakeup-confirmed', automation_id=receipt['automation_id'], intent_key=key)


def resume_plan(state, snapshot, estimate, now=None):
    key = intent(state)
    flow.unblocked(state)
    flow.require(state['stage'] == 'In Development', 'No Developer continuation at this stage')
    now = now or datetime.now(timezone.utc)
    flow.require(now.timestamp() >= state['usage_wait']['resume_not_before'], 'Wakeup is early')
    unit = subtasks.next_unit(state)
    flow.require((unit['id'] if unit else 'final-validation') == state['usage_wait']['unit'], 'Deferred unit changed')
    flow.require(not unit or unit['status'] == 'pending', 'Checkpoint requires operator completion')
    reset = subtasks.admit(snapshot, estimate, now)
    return {'intent_key': key, 'usage_ready': reset is None, 'resume_not_before': reset,
            'next_action': 'launch-through-normal-gates' if reset is None else 'reschedule-confirmed-wakeup',
            'execution_authorized': False}
