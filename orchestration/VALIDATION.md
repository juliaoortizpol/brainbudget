# Setup validation — 2026-10-29

This records setup checks, not a feature's independent review or QA verdict. No feature ticket, role model turn, merge or deployment was run.

## Results

- Inspected the actual repositories, AGENTS.md, package scripts, CI, PR templates, product/testing/architecture docs and relevant backend/frontend source. Setup branches started from frontend master `2d7ad5487cb3dd60a471a8e99338bb5bccd7198d` and backend master `73f8fa4e98fbe61a3ebca9b5031d4687e98307a7`.
- Frontend CI already includes unit tests (merged PR #13). Both repositories have lint, types, unit, build and aggregate required jobs. The backend setup adds controller regression tests as another dependency of backend-required.
- GitHub branch endpoints returned `protected=false` and rulesets `[]` for both repositories. Detailed protection reads returned HTTP 403 for the connected integration. Enforcement was not changed or demonstrated with a failing PR.
- 35 standard-library controller regression tests pass on Windows with Python 3.12.14. They exercise scope/final approval, exact-commit evidence, all-PR merge requirements, distinct sessions, mocked CLI identity capture, canonical-source tamper rejection, human handoffs, schema generation, retry/lock limits, snapshot exclusions, latest exact-head CI, Trello reconciliation, narrow executable roots and native profile/receipt gates. External service responses and child role execution are mocked in these tests.
- The first restricted-sandbox test invocation encountered Windows temporary-directory ACL errors in filesystem fixtures. Re-running with normal host temporary-directory access passed. This is not evidence that all role filesystem permissions are operational.
- Installed CLI: `codex-cli 0.165.0-alpha.1.2`. All four native role configurations reached deliberately missing output-schema validation, before inference. No model was called and no custom config keys were accepted silently (`--strict-config`).
- The initial native :workspace probe checked scratch writes and outside-write denial only. It has now been superseded by the MXC root-deny profile probe described below. Network, managed tools and credential exposure still need assessment.
- Native probe JSON is stored locally outside both repositories at `../.finances-runs/setup-validation/cli-validation.json`. Run `check_cli.py --help` to reproduce it; never turn a narrow write probe into an isolation claim.

No application source or dependency versions changed. Full application checks are provided by the existing CI jobs; the setup tests do not replace those checks. CI results for setup PRs are reported separately from this local validation record.

## Native workspace boundary follow-up

MXC compatibility returned MXC_OK. The launcher now uses native permission profiles without legacy sandbox overrides. All four role probes passed 17 checks each: role-specific source reads/writes, scratch writes, .git write denial, .env read denial, controller/unrelated read/write denial, shared-policy reads/write denial, Python/Node/Git startup, inherited child restriction and junction read/write denial. Orchestrator received no application source. Only synthetic markers were used; no real credential contents or model inference were involved.

The probe found and corrected two configuration issues before passing: MXC requires the existing SystemDrive environment value, and denying :tmpdir conflicts with a scratch write grant when TEMP points to that same scratch path. The final profile grants no implicit temporary write locations; TEMP/cache point into scratch.

The actual receipt is `../.finances-runs/setup-validation/workspace-isolation.json`; it is required by live launch, bound to host/runtime/policy files and expires after 24 hours. Run isolation.py to renew it. Four role CLI configurations also reached missing-schema validation with the new native profile, before any model call. See [WORKSPACE-ISOLATION.md](WORKSPACE-ISOLATION.md) for scope and remaining boundaries. No security attestation was automatically enabled.

## Pending before live operation

1. Dedicated synthetic test host with verified filesystem, tool, network and credential boundaries. Both security flags in the local config remain false, and live launch fails closed.
2. Isolated MongoDB, guarded seed/reset, repeatable frontend/backend startup, commit/build identity and database readiness evidence. `/health` alone is insufficient. Docker/mongod were unavailable on PATH.
3. QA browser/API access in its isolated session and a successful real screenshot exercise. No screenshots were fabricated or substituted by unit tests.
4. Trello board/list mapping, scoped broker token and live remote reconciliation test. Desktop connector access is not a CLI token. No card was created or moved by setup.
5. Controller-host GitHub access and an exact-head CI read exercise; trusted PR publication remains a host operation. No child role receives publication credentials.
6. Master branch protection and deliberate failing-PR enforcement verification, performed by Julio with repository administration access.

Use [README.md](README.md) for operator commands and [PERMISSIONS.md](PERMISSIONS.md) for enforced versus advisory controls. Missing prerequisites are blockers, not implicit passing evidence.
