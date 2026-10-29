# Setup validation — 2026-10-29

This records setup checks, not a feature's independent review or QA verdict. No feature ticket, role model turn, merge or deployment was run.

## Results

- Inspected the actual repositories, AGENTS.md, package scripts, CI, PR templates, product/testing/architecture docs and relevant backend/frontend source. Setup branches started from frontend master `2d7ad5487cb3dd60a471a8e99338bb5bccd7198d` and backend master `73f8fa4e98fbe61a3ebca9b5031d4687e98307a7`.
- Frontend CI already includes unit tests (merged PR #13). Both repositories have lint, types, unit, build and aggregate required jobs. The backend setup adds controller regression tests as another dependency of backend-required.
- GitHub branch endpoints returned `protected=false` and rulesets `[]` for both repositories. Detailed protection reads returned HTTP 403 for the connected integration. Enforcement was not changed or demonstrated with a failing PR.
- 31 standard-library controller regression tests pass on Windows with Python 3.12.14. They exercise scope/final approval, exact-commit evidence, all-PR merge requirements, distinct sessions, mocked CLI identity capture, canonical-source tamper rejection, human handoffs, schema generation, retry/lock limits, snapshot exclusions, latest exact-head CI, and Trello duplicate/retry/backlink reconciliation. External service responses and child role execution are mocked in these tests.
- The first restricted-sandbox test invocation encountered Windows temporary-directory ACL errors in filesystem fixtures. Re-running with normal host temporary-directory access passed. This is not evidence that all role filesystem permissions are operational.
- Installed CLI: `codex-cli 0.165.0-alpha.1.2`. All four native role configurations reached deliberately missing output-schema validation, before inference. No model was called and no custom config keys were accepted silently (`--strict-config`).
- A native `codex sandbox --permission-profile :workspace` probe wrote its owned scratch marker and denied a write to an owned marker outside scratch. It did not touch application files. Read isolation, network denial, managed tools and credential exposure were not probed. These remaining controls require a dedicated host assessment.
- Native probe JSON is stored locally outside both repositories at `../.finances-runs/setup-validation/cli-validation.json`. Run `check_cli.py --help` to reproduce it; never turn a narrow write probe into an isolation claim.

No application source or dependency versions changed. Full application checks are provided by the existing CI jobs; the setup tests do not replace those checks. CI results for setup PRs are reported separately from this local validation record.

## Pending before live operation

1. Dedicated synthetic test host with verified filesystem, tool, network and credential boundaries. Both security flags in the local config remain false, and live launch fails closed.
2. Isolated MongoDB, guarded seed/reset, repeatable frontend/backend startup, commit/build identity and database readiness evidence. `/health` alone is insufficient. Docker/mongod were unavailable on PATH.
3. QA browser/API access in its isolated session and a successful real screenshot exercise. No screenshots were fabricated or substituted by unit tests.
4. Trello board/list mapping, scoped broker token and live remote reconciliation test. Desktop connector access is not a CLI token. No card was created or moved by setup.
5. Controller-host GitHub access and an exact-head CI read exercise; trusted PR publication remains a host operation. No child role receives publication credentials.
6. Master branch protection and deliberate failing-PR enforcement verification, performed by Julio with repository administration access.

Use [README.md](README.md) for operator commands and [PERMISSIONS.md](PERMISSIONS.md) for enforced versus advisory controls. Missing prerequisites are blockers, not implicit passing evidence.
