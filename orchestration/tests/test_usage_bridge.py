import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flow
import usage_bridge as bridge
from test_harness import state


class BridgeTests(unittest.TestCase):
    def test_normalizes_both_windows_without_identity(self):
        now = datetime.now(timezone.utc)
        window = {'usedPercent': 20, 'resetsAt': now.timestamp()+1000}
        raw = {'ordinaryUsageAllowed': True, 'accountId': 'private', 'rateLimitsByLimitId': {'codex': {'primary': window, 'secondary': window}}}
        snapshot = bridge.normalize(raw, now.isoformat())
        self.assertEqual(len(snapshot['windows']), 2)
        self.assertEqual(snapshot['windows'][0]['remaining_percent'], 80)
        self.assertNotIn('accountId', snapshot)
        raw['rateLimitsByLimitId']['codex']['secondary'] = None
        with self.assertRaises(flow.GateError): bridge.normalize(raw, now.isoformat())

    def deferred(self):
        s = state()
        s['usage_wait'] = {'status': 'WAITING_FOR_USAGE', 'requirements_hash': s['requirements_hash'], 'commits': dict(s['commits']), 'unit': 'final-validation', 'resume_not_before': datetime.now(timezone.utc).timestamp()-1, 'scheduled': False}
        return s

    def test_receipt_requires_matching_active_schedule_and_is_idempotent(self):
        s = self.deferred()
        receipt = {'intent_key': bridge.intent(s), 'automation_id': 'a', 'status': 'PAUSED'}
        with self.assertRaises(flow.GateError): bridge.confirm(s, receipt)
        self.assertFalse(s['usage_wait']['scheduled'])
        receipt['status'] = 'ACTIVE'; bridge.confirm(s, receipt); bridge.confirm(s, receipt)
        receipt['automation_id'] = 'duplicate'
        with self.assertRaises(flow.GateError): bridge.confirm(s, receipt)
        s['commits']['backend'] = 'c'*40
        with self.assertRaises(flow.GateError): bridge.intent(s)

    def test_resume_never_authorizes_execution_and_rechecks_usage(self):
        s = self.deferred(); now = datetime.now(timezone.utc)
        snapshot = {'observed_at': now.isoformat(), 'windows': [{'remaining_percent': 80, 'resets_at': now.timestamp()+1000}]}
        result = bridge.resume_plan(s, snapshot, 10, now)
        self.assertTrue(result['usage_ready']); self.assertFalse(result['execution_authorized'])
        snapshot['windows'][0]['remaining_percent'] = 10
        self.assertFalse(bridge.resume_plan(s, snapshot, 10, now)['usage_ready'])
        with self.assertRaises(flow.GateError): bridge.resume_plan(s, snapshot, 10, now-timedelta(minutes=1))
