import unittest
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flow
import subtasks
import finances
from test_harness import state


class SubtaskTests(unittest.TestCase):
    def test_launch_defers_without_process_or_attempt(self):
        s = self.plan()
        now = datetime.now(timezone.utc)
        usage = {'observed_at': now.isoformat(), 'windows': [{'remaining_percent': 10, 'resets_at': now.timestamp()+1000}]}
        with tempfile.TemporaryDirectory() as directory, patch('isolation.validate_receipt'), patch('subprocess.Popen') as process:
            cfg = {'state_root': directory, 'security': {'isolated_test_host': True, 'sandbox_probe_passed': True}}
            result = finances.launch(cfg, s, 'developer', Path(directory)/'state.json', True, usage, 5)
            self.assertEqual(result['status'], 'WAITING_FOR_USAGE')
            self.assertFalse(result['scheduled'])
            self.assertEqual(s['attempts'], {})
            process.assert_not_called()

    def test_dirty_developer_result_is_checkpointed_not_pinned(self):
        s = self.plan()
        now = datetime.now(timezone.utc)
        usage = {'observed_at': now.isoformat(), 'windows': [{'remaining_percent': 90, 'resets_at': now.timestamp()+1000}]}
        class Child:
            pid = 123456
            returncode = 0
            def __init__(self, args, **kwargs):
                self.output = Path(args[args.index('--output-last-message')+1])
                self.schema = flow.read(args[args.index('--output-schema')+1])
            def communicate(self, prompt, timeout):
                assert 'assigned_subtask' in prompt
                flow.write(self.output, {'run_id': self.schema['properties']['run_id']['const'], 'requirements_hash': s['requirements_hash'], 'verdict': 'BLOCKED', 'summary': 'Changes saved, tests run, integration next', 'limitations': []})
                return json.dumps({'type': 'thread.started', 'thread_id': 'fresh-session'}), ''
            def poll(self): return 0
        with tempfile.TemporaryDirectory() as directory, patch('isolation.validate_receipt'), patch('finances.current_heads', return_value=s['commits']) as heads, patch('runtime.git', return_value=' M source.ts'), patch('runtime.head', return_value='a'*40), patch('subprocess.Popen', Child):
            cfg = {'state_root': directory, 'node': sys.executable, 'codex': 'not-invoked', 'security': {'isolated_test_host': True, 'sandbox_probe_passed': True}}
            result = finances.launch(cfg, s, 'developer', Path(directory)/'state.json', True, usage, 5)
            self.assertEqual(result['status'], 'awaiting-checkpoint')
            self.assertEqual(heads.call_count, 1)
            self.assertNotIn('developer', s['results'])
            self.assertEqual(subtasks.next_unit(s)['checkpoints'][0]['inventory']['backend']['status'], ' M source.ts')

    def plan(self):
        s = state()
        subtasks.install(s, [{'id': 'api', 'goal': 'Implement approved API scope', 'verification': 'API tests', 'repositories': list(s['commits'])}, {'id': 'integration', 'goal': 'Verify integration', 'verification': 'Integration checks', 'repositories': list(s['commits'])}])
        return s

    def test_order_checkpoint_completion_and_no_ticket_verdict(self):
        s = self.plan(); u = subtasks.next_unit(s)
        s['runs']['r'] = {'status': 'awaiting-result'}
        subtasks.checkpoint(s, u, 'r', {'verdict': 'BLOCKED', 'summary': 'API implemented; integration remains', 'limitations': []}, {'backend': {'status': ' M source.ts'}})
        self.assertNotIn('developer', s['results'])
        self.assertEqual(subtasks.next_unit(s)['id'], 'api')
        with self.assertRaises(flow.GateError): subtasks.finish(s, 'integration', 'checks')
        subtasks.finish(s, 'api', 'Operator ran API tests and committed')
        self.assertEqual(subtasks.next_unit(s)['id'], 'integration')
        self.assertEqual(s['runs']['r']['status'], 'checkpointed')
        with self.assertRaises(flow.GateError): flow.advance(s)

    def test_reject_ready_and_stale_plan(self):
        s = self.plan(); u = subtasks.next_unit(s)
        with self.assertRaises(flow.GateError): subtasks.checkpoint(s, u, 'r', {'verdict': 'READY', 'summary': 'x', 'limitations': []}, {})
        s['requirements_hash'] = 'changed'
        with self.assertRaises(flow.GateError): subtasks.next_unit(s)

    def test_usage_all_windows_reserve_and_freshness(self):
        now = datetime.now(timezone.utc)
        snap = {'observed_at': now.isoformat(), 'windows': [{'remaining_percent': 80, 'resets_at': now.timestamp()+300}, {'remaining_percent': 20, 'resets_at': now.timestamp()+900}]}
        self.assertEqual(subtasks.admit(snap, 5, now), now.timestamp()+1020)
        self.assertIsNone(subtasks.admit(snap, 4, now))
        snap['windows'][0]['remaining_percent'] = None
        with self.assertRaises(flow.GateError): subtasks.admit(snap, 4, now)
        snap['observed_at'] = '2000-01-01T00:00:00+00:00'
        with self.assertRaises(flow.GateError): subtasks.admit(snap, 4, now)

    def test_plan_scope_and_duplicates(self):
        s = state()
        unit = {'id': 'one', 'goal': 'x', 'verification': 'y', 'repositories': list(s['commits'])}
        with self.assertRaises(flow.GateError): subtasks.install(s, [unit, unit])
        self.assertNotIn('development_plan', s)


if __name__ == '__main__': unittest.main()
