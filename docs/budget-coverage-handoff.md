# AEM-BE3 developer checkpoint handoff

Requirements: 9aa64f989867da2378e81415e43c11f9c810769d781d24abcd36b8ebe89896da.
HEAD remains 873695badcbc514ed33a55dfa74d59f69250d4de. The complete feature is
saved in the working tree; this role cannot commit because .git is read-only.
This checkpoint is BLOCKED, not READY or independently reviewed/QA verified.

The verified recovery archive restored 31 files. Follow-up work fixes typed Jest
calls, strict calendar validation (including null purchase-date updates), the
existing as-of-now spending ceiling, CommonJS-compatible HTTP test imports and
ObjectId-preserving migration test snapshots. Legacy endDate edits now require
explicit migration. Regressions cover completed days across DST/year/leap changes,
impossible calendar dates, exact closing instants and open/closed spending ranges.
See [the contract](budget-coverage.md) for implementation and FE2/BE5/BE6 boundaries.

## Actual verification on 2026-11-09

Node 24.16.0, assigned Windows checkout, cmd.exe/login=false, provisioned locked
dependencies. No install, production/original database, OAuth or real mail access.

- Required `npm.cmd run verify:ci` remains failed: the sandbox denies loopback
  connections from all six real HTTP tests with EACCES 127.0.0.1. Tests remain
  enabled and no stage gate has been weakened. Lint and types pass before Jest.
  Final result: 36 suites / 255 tests passed; one suite / six tests failed solely
  at loopback connection. Total: 37 suites / 261 tests. Exit code 1.
- In-process ValidationPipe/service/matcher/migration tests use synthetic data and
  controlled persistence. They do not establish Mongo transaction isolation.
- Separately executed production build and all three environment/browser guards
  pass. These are partial evidence, not a replacement for verify:ci.
- `git diff --check` passes. Earlier failed lint/type/import/snapshot attempts are
  historical diagnostics, not passing verification.

Sanitized command logs are in this role's scratch: verify-ci-final.log, build.log
and guards.log. No real persisted integration, exact-head CI, independent review
or independent QA has run in this role.

## Trusted operator next actions

Review/checkpoint all saved source, tests and docs. Run the unchanged full
verify:ci gate on an authorized host that permits the local synthetic HTTP server.
Resolve any actual failure rather than waiving it. Pin the resulting actual
commit and run exact-head CI. No implementation commit is fabricated here.

Provision only brainbudget_qa_synthetic and execute the pinned integration matrix:
real authenticated routes/ValidationPipe, transaction support/index prerequisites,
activation and close-vs-assignment/import concurrency, rollback/standalone refusal,
ownership/soft deletes, purchase-date totals/review, duplicate imports and migration
preview/apply/idempotency with persisted IDs/associations/balances comparisons.

Publication broker handoff: create the backend PR titled "AEM-BE3: keep budget
coverage active until manual closure", link the approved Trello story and linked
FE2/BE5/BE6 dependencies, and use the coverage contract plus this verification
status in its body. No PR URL exists yet. Do not merge or deploy.

After the trusted checkpoint and evidence, launch fresh whole-ticket Developer
validation, then independent Reviewer and QA at their respective gates. Independent
QA must generate/inspect its portable HTML report. Product screenshots do not
apply to this backend-only change.

Trusted operator follow-up: unchanged verify:ci passed all261 tests and three guards on the dedicated account with loopback available. Unit route transport was then adapted to in-memory Node HTTP request/response injection, preserving every route, ValidationPipe/auth/service assertion, so the same unit suite can run under network-disabled isolation. Real authenticated TCP/Mongo checks remain a separate mandatory integration gate. This is a test transport change, not a test skip or a network-policy expansion. Reverification is required after this change.
