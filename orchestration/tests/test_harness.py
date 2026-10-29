"""Synthetic controller tests; no Codex inference, external services or feature ticket runs."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flow
import finances
import runtime as rt

A, B = 'a' * 40, 'b' * 40


def ticket():
    return {'id': 'SYNTHETIC-1', 'trello_card_id': 'card1', 'title': 'Synthetic scope',
            'requirements_version': '1', 'goal': 'Exercise gates', 'include': 'Synthetic checks',
            'exclude': 'Application features', 'execution_mode': 'AI-owned',
            'repositories': ['frontend', 'backend'],
            'acceptance_criteria': [{'id': 'AC1', 'expected': 'Observable expected behavior'}],
            'ui_changed': False, 'requires_integration': False}


def state(stage='In Development'):
    s = flow.initial(ticket(), {'frontend': A, 'backend': B})
    s['stage'] = stage
    return s


def approval(s, kind='scope'):
    return {'ticket_id': s['ticket']['id'], 'kind': kind, 'requirements_hash': s['requirements_hash'],
            'approved_by': 'Julio', 'decision': 'approved', 'approved_at': '2026-10-29T12:00:00Z', 'commits': s['commits']}


def result(s, role, verdict=None, session=None):
    run_id = role + '-run'
    session = session or role + '-session'
    s['runs'][run_id] = {'role': role, 'revision': flow.identity(s), 'status': 'awaiting-result', 'session_id': session}
    return {'role': role, 'run_id': run_id, 'session_id': session,
            'requirements_hash': s['requirements_hash'], 'commits': copy.deepcopy(s['commits']),
            'verdict': verdict or {'developer': 'READY', 'reviewer': 'PASS', 'qa': 'PASS', 'orchestrator': 'RECOMMEND'}[role],
            'summary': 'Synthetic result', 'limitations': [], 'evidence': ['synthetic assertion'],
            'acceptance_results': [{'id': 'AC1', 'result': 'pass', 'evidence': 'synthetic check'}],
            'findings': [], 'environment': 'Isolated synthetic fixture', 'integration': 'mocked',
            'screenshots': [], 'screenshot_not_applicable': 'Controller-only change', 'blocker': None}


def accept(s, role, verdict=None):
    value = result(s, role, verdict)
    flow.accept_result(s, role, value, value['run_id'])
    return value


def verified(s):
    s['verification'] = {r: {'commit': sha, 'passed': True} for r, sha in s['commits'].items()}
    s['ci'] = copy.deepcopy(s['verification'])
    s['prs'] = {r: f'https://github.com/juliaoortizpol/{rt.REPOSITORIES[r]}/pull/123' for r in s['commits']}


def ack(s):
    for op in s['outbox']:
        op['status'] = 'done'


class GateTests(unittest.TestCase):
    def test_context_paths_reject_windows_traversal_on_every_host(self):
        for path in ['..\\escape', '\\escape', '//server/share']:
            with self.subTest(path=path), self.assertRaises(flow.GateError):
                flow.validate_ticket({**ticket(), 'context_paths': [path]})

    def test_command_timeout_requests_process_tree_cleanup(self):
        with patch('runtime.subprocess.Popen') as popen, patch('runtime.kill_tree') as kill:
            child = popen.return_value
            child.communicate.side_effect = [subprocess.TimeoutExpired('synthetic', 1), ('', '')]
            with self.assertRaises(flow.GateError):
                rt.command(['synthetic'], timeout=1)
            kill.assert_called_once_with(child)

    def test_ticket_requires_observable_scope_and_unique_criteria(self):
        for edit in [{'acceptance_criteria': []}, {'include': ''}, {'execution_mode': 'automatic'},
                     {'context_paths': ['../escape']}, {'context_paths': ['C:\\escape']},
                     {'acceptance_criteria': [{'id': 'AC1', 'expected': 'x'}, {'id': 'AC1', 'expected': 'y'}]}]:
            with self.subTest(edit=edit), self.assertRaises(flow.GateError):
                flow.validate_ticket({**ticket(), **edit})

    def test_ready_requires_julio_approval_of_exact_requirements(self):
        s = state('Backlog')
        for edit in [{'approved_by': 'Developer'}, {'requirements_hash': 'old'}, {'decision': 'pending'}]:
            with self.subTest(edit=edit), self.assertRaises(flow.GateError):
                flow.approve_ready(s, {**approval(s), **edit})
        flow.approve_ready(s, approval(s))
        self.assertEqual(s['stage'], 'Ready')
        with self.assertRaises(flow.GateError):
            flow.advance(s)  # The card transition must actually synchronize first.
        ack(s); flow.advance(s)
        self.assertEqual(s['stage'], 'In Development')

    def test_complete_workflow_needs_local_ci_review_qa_and_all_merges(self):
        s = state()
        with self.assertRaises(flow.GateError):
            flow.advance(s)
        accept(s, 'developer')
        with self.assertRaises(flow.GateError):
            flow.advance(s)
        verified(s); flow.advance(s); ack(s)
        self.assertEqual(s['stage'], 'Code Review')
        with self.assertRaises(flow.GateError):
            flow.advance(s)
        accept(s, 'reviewer'); flow.advance(s); ack(s)
        self.assertEqual(s['stage'], 'QA Testing')
        accept(s, 'qa'); flow.advance(s); ack(s)
        self.assertEqual(s['stage'], 'Your Approval')
        with self.assertRaises(flow.GateError):
            flow.advance(s)  # No automatic final approval.
        with self.assertRaises(flow.GateError):
            flow.complete(s, approval(s, 'final'), {'frontend': True, 'backend': False})
        flow.complete(s, approval(s, 'final'), {'frontend': True, 'backend': True})
        self.assertEqual(s['stage'], 'Done')

    def test_results_cannot_reuse_a_developer_session_or_forge_identity(self):
        s = state('Code Review'); accept(s, 'developer')
        value = result(s, 'reviewer', session='developer-session')
        with self.assertRaises(flow.GateError):
            flow.accept_result(s, 'reviewer', value, value['run_id'])
        value = result(s, 'reviewer'); value['session_id'] = 'invented'
        with self.assertRaises(flow.GateError):
            flow.accept_result(s, 'reviewer', value, value['run_id'])

    def test_stale_commit_or_requirement_report_is_rejected(self):
        for key, value in [('commits', {'frontend': B, 'backend': B}), ('requirements_hash', 'old')]:
            s = state(); report = result(s, 'developer'); report[key] = value
            with self.subTest(key=key), self.assertRaises(flow.GateError):
                flow.accept_result(s, 'developer', report, report['run_id'])

    def test_commit_changes_conservatively_invalidate_all_evidence(self):
        s = state('Your Approval'); accept(s, 'reviewer'); accept(s, 'qa'); verified(s)
        s['approval'] = approval(s, 'final'); s['qa_environment'] = {'commits': s['commits']}
        flow.pin(s, {'frontend': B, 'backend': B})
        self.assertEqual(s['stage'], 'In Development')
        for field in ['results', 'verification', 'ci']:
            self.assertEqual(s[field], {})
        self.assertIsNone(s['approval']); self.assertIsNone(s['qa_environment'])

    def test_requirements_revision_needs_new_scope_approval(self):
        s = state('QA Testing'); accept(s, 'reviewer')
        flow.revise(s, {**ticket(), 'requirements_version': '2', 'goal': 'Updated outcome'})
        self.assertEqual(s['stage'], 'Backlog'); self.assertEqual(s['results'], {})
        with self.assertRaises(flow.GateError):
            flow.revise(s, {**ticket(), 'requirements_version': '2'})

    def test_blocked_stays_in_current_list_and_requires_actionable_blocker(self):
        s = state('QA Testing'); value = result(s, 'qa', 'BLOCKED')
        with self.assertRaises(flow.GateError):
            flow.accept_result(s, 'qa', value, value['run_id'])
        self.assertNotIn('qa', s['results'])
        value['blocker'] = {'reason': 'No browser', 'owner': 'Test environment owner', 'next_action': 'Provision isolated browser'}
        flow.accept_result(s, 'qa', value, value['run_id'])
        self.assertEqual(s['stage'], 'QA Testing')
        with self.assertRaises(flow.GateError):
            flow.advance(s)

    def test_review_and_qa_failures_return_original_ticket_to_development(self):
        for role, verdict, stage in [('reviewer', 'CHANGES REQUESTED', 'Code Review'), ('qa', 'FAIL', 'QA Testing')]:
            s = state(stage); accept(s, 'developer')
            report = result(s, role, verdict)
            report['findings'] = [{'id': 'F1', 'severity': 'blocking', 'title': 'Wrong amount', 'impact': 'Incorrect financial result', 'evidence': 'Reproduction steps'}]
            flow.accept_result(s, role, report, report['run_id'])
            self.assertEqual(s['stage'], 'In Development'); self.assertNotIn('developer', s['results'])

    def test_minor_findings_need_verified_current_backlog_links(self):
        s = state('Code Review'); report = result(s, 'reviewer')
        report['findings'] = [{'id': 'F1', 'severity': 'minor', 'title': 'Spacing', 'impact': 'Cosmetic', 'evidence': 'Synthetic screenshot'}]
        flow.accept_result(s, 'reviewer', report, report['run_id'])
        with self.assertRaises(flow.GateError):
            flow.advance(s)
        s['followups']['F1'] = {'verified': True, 'revision': 'old'}
        with self.assertRaises(flow.GateError):
            flow.advance(s)
        s['followups']['F1']['revision'] = flow.identity(s)
        flow.advance(s); self.assertEqual(s['stage'], 'QA Testing')

    def test_uncertain_severity_cannot_advance(self):
        s = state('Code Review'); report = result(s, 'reviewer')
        report['findings'] = [{'id': 'F1', 'severity': 'uncertain', 'title': 'Unclear scope', 'impact': 'Needs Julio decision', 'evidence': 'Requirement ambiguity'}]
        flow.accept_result(s, 'reviewer', report, report['run_id'])
        with self.assertRaises(flow.GateError):
            flow.advance(s)

    def test_qa_pass_needs_acceptance_screenshots_and_real_integration_when_required(self):
        for edit in [{'acceptance_results': []}, {'screenshots': []}, {'integration': 'mocked'}]:
            s = state('QA Testing'); s['ticket'].update(ui_changed=True, requires_integration=True)
            report = result(s, 'qa'); report.update(integration='real', screenshots=[{'path': 'normal.png', 'caption': 'Synthetic desktop normal state', 'state': 'normal'}]); report.update(edit)
            with self.subTest(edit=edit), self.assertRaises(flow.GateError):
                flow.accept_result(s, 'qa', report, report['run_id'])


class IsolationTests(unittest.TestCase):
    def test_lock_prevents_concurrent_controller_and_survives_existing_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            with flow.lock(directory):
                with self.assertRaises(flow.GateError):
                    with flow.lock(directory):
                        pass
            self.assertFalse((Path(directory) / 'controller.lock').exists())

    def test_single_active_ticket_and_retry_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            s = state(); other = state('Code Review'); other['ticket']['id'] = 'OTHER'
            flow.write(Path(directory) / 'OTHER/state.json', other)
            cfg = {'state_root': directory}
            with self.assertRaises(flow.GateError):
                finances.only_one(cfg, s)
            other['stage'] = 'Done'; flow.write(Path(directory) / 'OTHER/state.json', other)
            s['attempts']['developer:' + flow.identity(s)] = 3
            with self.assertRaises(flow.GateError):
                finances.launch(cfg, s, 'developer', Path(directory) / 'state.json')

    def test_launch_is_dry_by_default_and_live_launch_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            s = state(); cfg = {'state_root': directory, 'security': {}}
            with patch('subprocess.Popen') as child:
                plan = finances.launch(cfg, s, 'developer', Path(directory) / 'state.json')
                self.assertTrue(plan['fresh_session']); self.assertFalse(s['runs']); child.assert_not_called()
                with self.assertRaises(flow.GateError):
                    finances.launch(cfg, s, 'developer', Path(directory) / 'state.json', True)
                child.assert_not_called()

    def test_pair_and_human_modes_do_not_autolaunch_a_developer(self):
        for mode in ['Pair programming', 'Human-owned']:
            with tempfile.TemporaryDirectory() as directory, self.subTest(mode=mode):
                s = state(); s['ticket']['execution_mode'] = mode
                with self.assertRaises(flow.GateError):
                    finances.launch({'state_root': directory}, s, 'developer', Path(directory) / 'state.json')

    def test_secret_environment_values_are_not_forwarded(self):
        with patch.dict(os.environ, {'FINANCES_GITHUB_TOKEN': 'synthetic', 'FINANCES_TRELLO_TOKEN': 'synthetic', 'MONGODB_URI': 'production-placeholder', 'GOOGLE_CLIENT_SECRET': 'synthetic', 'OPENAI_API_KEY': 'synthetic'}):
            self.assertFalse(set(rt.clean_env()) & {'FINANCES_GITHUB_TOKEN', 'FINANCES_TRELLO_TOKEN', 'MONGODB_URI', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY'})

    def test_reviewer_launch_has_no_writable_source_and_no_transcript(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory); (folder / 'scratch').mkdir()
            s = state('Code Review'); accept(s, 'developer')
            cfg = {'node': sys.executable, 'codex': 'codex'}
            args, prompt, env = finances.role_command(cfg, s, 'reviewer', folder, 'fresh-id', {'frontend': str(folder / 'sources/frontend')})
            self.assertIn('--ephemeral', args); self.assertIn('--ignore-user-config', args)
            self.assertNotIn('resume', args); self.assertNotIn('fork', args)
            self.assertIn('sandbox_workspace_write.writable_roots=[]', args)
            self.assertIn('sandbox_workspace_write.network_access=false', args)
            self.assertNotIn('full_conversation', prompt)

    def test_path_traversal_in_ticket_state_is_rejected(self):
        with self.assertRaises(flow.GateError):
            finances.state_path({'state_root': '.'}, '../escape')

    def test_schema_is_strict_and_pins_independent_role_commits(self):
        for role in flow.ROLES:
            schema = finances.role_schema(state(), role, 'run1')
            self.assertFalse(schema['additionalProperties'])
            self.assertEqual(set(schema['required']), set(schema['properties']))
            if role != 'developer':
                self.assertEqual(schema['properties']['commits']['properties']['frontend']['const'], A)

    def test_mocked_role_launch_stamps_real_event_id_and_rejects_source_tampering(self):
        for tamper in [False, True]:
            with self.subTest(tamper=tamper), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                s = state('Code Review'); accept(s, 'developer')
                template = result(s, 'reviewer'); s['runs'].pop(template['run_id'])
                cfg = {'state_root': directory, 'node': sys.executable, 'codex': 'not-invoked',
                       'security': {'isolated_test_host': True, 'sandbox_probe_passed': True}}
                def snapshot(_source, destination, _commit):
                    destination.mkdir(parents=True)
                    (destination / 'code.txt').write_text('pinned synthetic source')
                    return rt.tree_hash(destination)
                class Child:
                    pid = 123456
                    returncode = 0
                    def __init__(self, args, **kwargs):
                        self.output = Path(args[args.index('--output-last-message') + 1])
                        self.schema = flow.read(args[args.index('--output-schema') + 1])
                    def communicate(self, _prompt, timeout):
                        report = copy.deepcopy(template)
                        report['run_id'] = self.schema['properties']['run_id']['const']
                        report['session_id'] = 'untrusted-model-claim'
                        flow.write(self.output, report)
                        if tamper:
                            (self.output.parent / 'sources/frontend/code.txt').write_text('modified')
                        return json.dumps({'type': 'thread.started', 'thread_id': 'actual-cli-session'}), ''
                    def poll(self):
                        return 0
                with patch('finances.current_heads', return_value=s['commits']), patch('runtime.snapshot', side_effect=snapshot), patch('runtime.git', return_value='synthetic patch'), patch('subprocess.Popen', Child):
                    if tamper:
                        with self.assertRaisesRegex(flow.GateError, 'modified'):
                            finances.launch(cfg, s, 'reviewer', root / 'state.json', True)
                        self.assertNotIn('reviewer', s['results'])
                    else:
                        outcome = finances.launch(cfg, s, 'reviewer', root / 'state.json', True)
                        self.assertEqual(outcome['verdict'], 'PASS')
                        self.assertEqual(s['results']['reviewer']['session_id'], 'actual-cli-session')

    def test_human_handoff_is_operator_attested_and_does_not_waive_ci(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['frontend', 'backend']:
                (root / name).mkdir()
            cfg = {'state_root': str(root / 'state'), 'repositories': {r: {'path': str(root / r)} for r in ['frontend', 'backend']}, 'security': {}, 'trello': {'board_id': '', 'lists': {}}}
            config_path = root / 'host.json'; flow.write(config_path, cfg)
            s = state(); s['ticket']['execution_mode'] = 'Human-owned'; s['requirements_hash'] = flow.digest(s['ticket'])
            value = result(s, 'developer'); s['runs'].clear(); value['submitted_by'] = 'Julio'
            report_path = root / 'report.json'; flow.write(report_path, value)
            path = finances.state_path(cfg, s['ticket']['id']); flow.write(path, s)
            with patch('finances.current_heads', return_value=s['commits']):
                finances.main(['--config', str(config_path), '--ticket-id', s['ticket']['id'], 'human-handoff', '--report', str(report_path)])
            actual = flow.read(path)
            self.assertEqual(actual['results']['developer']['verdict'], 'READY')
            self.assertEqual(actual['runs']['developer-run']['identity_source'], 'human-attestation')
            with self.assertRaises(flow.GateError):
                flow.advance(actual)

    def test_snapshot_uses_committed_files_without_env_git_or_conversations(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'repo'; source.mkdir()
            rt.command(['git', 'init', str(source)])
            (source / 'AGENTS.md').write_text('Synthetic instructions')
            (source / 'code.txt').write_text('committed source')
            (source / '.env.example').write_text('SECRET=synthetic')
            rt.git(source, 'add', '.')
            rt.command(['git', '-C', str(source), '-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + str(Path(directory) / 'no-hooks'), 'commit', '-m', 'synthetic'])
            (source / 'developer-conversation.txt').write_text('Not committed, must not transfer')
            target = Path(directory) / 'snapshot'
            before = rt.snapshot(source, target, rt.head(source))
            self.assertTrue((target / 'code.txt').exists())
            self.assertFalse((target / '.env.example').exists()); self.assertFalse((target / '.git').exists())
            self.assertFalse((target / 'developer-conversation.txt').exists())
            (target / 'code.txt').write_text('altered')
            self.assertNotEqual(before, rt.tree_hash(target))


class FakeGitHub:
    def __init__(self, missing=None, head=A, conclusion='success'):
        self.missing, self.head, self.conclusion = missing, head, conclusion

    def call(self, method, path):
        if '/pulls/' in path:
            return {'head': {'sha': self.head, 'repo': {'full_name': 'juliaoortizpol/chillbudget'}}}
        if '/jobs?' in path:
            return {'jobs': [{'name': 'frontend-' + name, 'status': 'completed', 'conclusion': 'success'} for name in ['lint', 'types', 'unit', 'build', 'required'] if name != self.missing]}
        return {'workflow_runs': [{'id': 1, 'name': 'Frontend CI', 'head_sha': A, 'status': 'completed', 'conclusion': self.conclusion, 'html_url': 'https://github.com/synthetic/run/1'}]}


class BrokerTests(unittest.TestCase):
    def test_ci_requires_exact_head_all_jobs_and_latest_success(self):
        url = 'https://github.com/juliaoortizpol/chillbudget/pull/123'
        self.assertTrue(rt.github_ci('frontend', A, url, FakeGitHub())['passed'])
        for api in [FakeGitHub(missing='unit'), FakeGitHub(head=B), FakeGitHub(conclusion='failure')]:
            with self.subTest(api=api), self.assertRaises(flow.GateError):
                rt.github_ci('frontend', A, url, api)

    def test_trello_retry_reconciles_completed_remote_move_without_duplicate_put(self):
        s = state('Ready'); flow.move(s, 'In Development')
        calls = []
        class API:
            def call(self, method, path, data=None):
                calls.append(method)
                return {'idBoard': 'board1', 'idList': 'dev'}
        cfg = {'trello': {'board_id': 'board1', 'lists': {'Ready': 'ready', 'In Development': 'dev'}}}
        rt.synchronize(s, cfg, API()); rt.synchronize(s, cfg, API())
        self.assertEqual(calls, ['GET']); self.assertEqual(s['outbox'][0]['status'], 'done')

    def test_trello_wrong_board_and_retry_limit_fail_closed(self):
        s = state('Ready'); flow.move(s, 'In Development')
        class API:
            def call(self, *args):
                return {'idBoard': 'other', 'idList': 'dev'}
        cfg = {'trello': {'board_id': 'board1', 'lists': {'Ready': 'ready', 'In Development': 'dev'}}}
        for _ in range(3):
            with self.assertRaises(flow.GateError):
                rt.synchronize(s, cfg, API())
        with self.assertRaisesRegex(flow.GateError, 'attempt limit'):
            rt.synchronize(s, cfg, API())

    def test_existing_possible_duplicate_blocks_new_followup_creation(self):
        class API:
            def call(self, method, path, data=None):
                if method != 'GET':
                    raise AssertionError('Must not create a duplicate')
                return [{'id': 'existing', 'name': 'Spacing', 'desc': 'Already reported', 'idList': 'backlog'}]
        cfg = {'trello': {'board_id': 'board1', 'lists': {'Backlog': 'backlog'}}}
        with self.assertRaisesRegex(flow.GateError, 'Possible duplicate'):
            rt.followup(state(), {'id': 'F1', 'title': 'Spacing', 'impact': 'Cosmetic', 'evidence': 'Screenshot'}, cfg, API())

    def test_interrupted_create_is_reused_and_both_actual_card_links_are_verified(self):
        s = state(); finding = {'id': 'R1', 'title': 'Spacing', 'impact': 'Cosmetic', 'evidence': 'Screenshot'}
        marker = 'finances-defect:' + flow.digest({'ticket': s['ticket']['id'], 'finding': finding['id'], 'requirements': s['requirements_hash']})
        original = {'id': 'card1', 'idBoard': 'board1', 'url': 'https://trello.com/c/ORIGINAL', 'desc': 'Original requirements'}
        existing = {'id': 'followup1', 'name': 'Spacing', 'idList': 'backlog', 'url': 'https://trello.com/c/FOLLOWUP', 'desc': marker + '\nOriginal: ' + original['url']}
        calls = []
        class API:
            def call(self, method, path, data=None):
                calls.append((method, path))
                if '/boards/' in path:
                    return [existing]
                card = original if path.split('?')[0] == '/cards/card1' else existing
                if method == 'PUT':
                    card.update(data)
                if method == 'POST':
                    raise AssertionError('An interrupted create must be reconciled, not duplicated')
                return copy.deepcopy(card)
        cfg = {'trello': {'board_id': 'board1', 'lists': {'Backlog': 'backlog'}}}
        one = rt.followup(s, finding, cfg, API())
        two = rt.followup(s, finding, cfg, API())
        self.assertEqual(one['id'], two['id']); self.assertTrue(one['verified'])
        self.assertEqual(sum(method == 'PUT' for method, path in calls), 1)
        self.assertIn(existing['url'], original['desc'])

    def test_newest_failed_run_is_not_hidden_by_older_success(self):
        class API(FakeGitHub):
            def call(self, method, path):
                value = super().call(method, path)
                if 'workflow_runs' in value:
                    value['workflow_runs'].append({**value['workflow_runs'][0], 'id': 2, 'conclusion': 'failure'})
                return value
        with self.assertRaises(flow.GateError):
            rt.github_ci('frontend', A, 'https://github.com/juliaoortizpol/chillbudget/pull/123', API())


if __name__ == '__main__':
    unittest.main()
