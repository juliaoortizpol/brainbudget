# Finances agent setup

This is a small, dependency-free Python controller around the installed Codex CLI. It prepares Developer, Reviewer, QA and Orchestrator contexts, pins cross-repository evidence, checks gates and brokers Trello updates. It adds no application feature, paid API dependency or custom model runtime. No feature ticket is started by installation or doctor.

Read [WORKFLOW.md](WORKFLOW.md), the single shared workflow policy, [PERMISSIONS.md](PERMISSIONS.md), and [VALIDATION.md](VALIDATION.md) before enabling execution. Technical repository boundaries remain in each AGENTS.md. Short procedures live in procedures/; they are not installable global skills and do not replace enforced permissions.

## Installed environment and local paths

Inspected 2026-10-29:

- Frontend local folder: `../chillbudget`; remote `juliaoortizpol/chillbudget`; inspected master `2d7ad5487cb3dd60a471a8e99338bb5bccd7198d`.
- Backend local folder is currently named `brainbudget-contracts`; remote `juliaoortizpol/brainbudget`; inspected master `73f8fa4e98fbe61a3ebca9b5031d4687e98307a7`.
- Codex CLI `0.165.0-alpha.1.2`, ChatGPT login; Python 3.12.14. PATH Node was 22, so the ignored local config selects the bundled Node 24 executable (24.22.1). Python 3.12+ and Node 24 are required.
- Both CI matrices now include lint, types, unit and build. Frontend tests were added by the already-merged PR #13; no duplicate change is needed.
- Both master branch endpoints report `protected=false`; ruleset lists were empty. Detailed protection reads returned 403 for this connection. No protection settings were changed.

## Configure once

From the backend checkout, copy config/project.example.json to a git-ignored local file outside both application checkouts. Resolve repository paths/state_root to real absolute paths; choose a Node 24 installation with npm and the installed `codex` executable. Keep state_root outside application checkouts. Do not place broker credentials in this file.

For this machine `.finances-host.local.json` was prepared in the parent `Finances software` folder. It contains paths only and intentionally leaves Trello/security prerequisites unset. No global Codex config was edited.

Commands below use `python` as your Python 3.12+ executable; replace it with the bundled interpreter's absolute path if Python is not on PATH:

```powershell
python orchestration/finances.py --config ../.finances-host.local.json doctor
python orchestration/isolation.py --config ../.finances-host.local.json
python -m unittest discover -s orchestration/tests -v
```

Doctor checks actual repository commits/cleanliness, runtime and supported CLI flags, and lists pending prerequisites. `config/*.toml` contains native Codex keys; `project.example.json` and ticket/result/state fields are **harness records**, not Codex configuration fields. The launcher converts only supported settings to `codex exec -c` arguments, always uses `--strict-config`, and does not select a model for you.

The [native workspace profile](WORKSPACE-ISOLATION.md) is validated on this host. It denies unrelated filesystem reads, permits Developer source writes and gives other roles read-only source. A current 24-hour probe receipt is mandatory for live launch, in addition to the remaining host/tool/credential prerequisites. Git metadata stays read-only; a trusted operator checkpoints implementation commits. No global profile was installed.

## Start a ticket — after environment prerequisites are met

1. Julio writes a ticket from examples/ticket.json: actual Trello id, version, explicit scope/mode, affected repositories and observable acceptance ids. Never put secrets or private financial/mail data in it.
2. Initialize Backlog, inspect the printed requirements hash, and obtain Julio's scope decision in an operator-owned file based on examples/scope-approval.json. The example is deliberately pending, not an approval.

```powershell
python orchestration/finances.py --config ../.finances-host.local.json init --ticket /path/to/ticket.json
# Put --ticket-id before each subcommand:
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 status
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 ready --approval /path/to/scope-approval.json
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 sync
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 prepare
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 advance
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 sync
python orchestration/finances.py --config ../.finances-host.local.json --ticket-id FIN-123 launch --role developer
```

`launch` is a dry-run by default. It does not create a model session or change progress. `launch --role developer --execute` starts a fresh CLI session only after isolation/sandbox validation. It uses private checkouts under state_root, a new role scratch root, sanitized environment, supported policy overrides and a generated strict JSON result schema. It never resumes/forks the Developer chat for other roles. The host stamps the actual CLI session id; unsupported event formats fail closed.

Developer code must be committed in assigned checkouts; a sandbox that cannot commit returns BLOCKED for trusted operator checkpointing. Publication requires a separate trusted host/GitHub broker; child roles have no push credential or network. Pair programming/Human-owned are deliberately human-led; automatic Developer launch is disabled. Use `human-handoff --report FILE` for an operator-owned Developer result with `submitted_by: "Julio"`, a unique run_id/session_id and the same requirement/commit/criterion fields as a CLI result. Human session identity is an explicit operator attestation, not a CLI event. All later verification, CI, independent review and QA gates still apply.

After implementation, use `pin` if a trusted checkpoint changed commits. `verify` creates a separate verification checkout, installs locked dependencies and runs all relevant checks. It never verifies an uncommitted source tree. Register each linked PR with `pr --repo frontend --url https://github.com/juliaoortizpol/chillbudget/pull/NUMBER` (and backend as needed), then `ci`. `advance` refreshes exact-head GitHub CI and opens Code Review only when all implementation evidence is present. Any failed/stale check stops it; there is no force/skip-gate option.

## Review, QA, screenshots and final approval

After syncing Code Review, run `launch --role reviewer` to inspect eligibility, then `--execute` on the validated host. The session gets a structured handoff, not the Developer conversation. Scratch experiments/dependencies/reports are allowed; canonical source is outside writable roots and hash-checked. Findings return to Developer; no Reviewer fixes.

After Reviewer PASS, `advance` then `sync` opens QA Testing. Supply an operator-owned QA environment manifest based on examples/qa-environment.json using `environment --manifest FILE` with exact `commits`, `data_mode: "synthetic"`, `isolated: true`, `readiness_verified: true`, `browser_ready: true`, `seed_reset_evidence`, `environment` and `verified_by`. This is explicitly an operator attestation; a bare health response does not establish database readiness or served-build identity. The launcher requires a current manifest and Reviewer PASS before QA.

Run a fresh `launch --role qa --execute` only when browser/API tools are provisioned in that isolated session. With missing browser, MongoDB or seed/reset, QA reports BLOCKED; examples/blocked-result.json shows the handoff format, and the launcher generates each run's strict schema.json. For changed UI, screenshots must be actual files under the run's scratch directory with captions and state names. Open the paths listed in `roles/RUN_ID/result.json`; never accept invented screenshots. Include normal and relevant error/empty/loading/validation/responsive states.

`followups` searches/reconciles minor defects and verifies Backlog plus backlinks. If a potential duplicate is found, inspect it and use `link-followup --finding-id ID --card-id ID` rather than creating another card. Role sessions never move cards. After QA PASS or PASS WITH FOLLOW-UPS and verified links, `advance`/`sync` moves to Your Approval.

Julio inspects reports and screenshots and supplies an explicit final approval based on examples/final-approval.json, tied to the current requirements hash and exact commits. **He merges the linked PRs himself.** `complete --approval FILE` only reads GitHub to verify every relevant PR is already merged at that approved head; it contains no merge command. `sync` records Done. Record deployment separately.

## Progress, interruptions and blockers

`status` reads the structured state without acquiring a write lock. State includes ticket/version/hash, commits, PRs, local verification, CI, role session/results/evidence, environment, blockers, attempt counts, outbox and events. Role transcripts are not stored/passed; only final structured results and actual session identity are used.

`block --reason ... --owner ... --next-action ...` stays in the current list. After the responsible party resolves it, `resolve-blockers --decision ...` records the decision. `pin` invalidates all prior evidence after commit changes; `revise --ticket FILE` requires a new requirements version and returns to Backlog for fresh scope approval.

The controller lock is held during commands, including role execution; `status` remains readable. A crash leaves a lock/running record so duplicate work cannot start silently. Inspect PID and child processes, remote PR/card state and partial files before recovery. Confirm all child processes stopped, archive the diagnostic state, then an operator may remove the stale lock and mark that run failed in the audited record with a recovery event. There is no automatic restart or unbounded retry. Three attempts per role/revision and three Trello attempts require escalation; an operator must inspect/reconcile before a deliberate new attempt/version. Remote effects may have completed despite a timeout.

## Pending environment work

Docker/mongod were not on PATH during initial inspection. The subsequent approved setup uses a separate brainbudget_qa_synthetic database on the existing dev/QA instance, with guarded seed/reset and supervised local application readiness checks. See [QA operations](environment/QA-OPERATIONS.md). A database-scoped user, broader host/tool/network isolation and browser verification remain pending. Do not run repository root ad-hoc auth/account scripts against unknown stores. The inherited backend e2e scaffold still needs isolated configuration, alias mapping and lifecycle cleanup before promotion to a gate.

No live Trello token/board mapping was installed. A desktop plugin connection is not automatically a CLI credential. GitHub read access was demonstrated through the connected plugin; the controller's optional token/network path must be provisioned for its host. No board/card/bug was created or moved by setup. Master protection and its deliberate failing-PR enforcement check are pending. See VALIDATION.md for exactly what ran.
