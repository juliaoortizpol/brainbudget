# CI onboarding baseline

Observed at 1eab0406d940a1f4d18f297520f3696afc75d902 on 2026-10-22 with Node 24.19.0
and npm 11.9.0, after npm ci.

| Check | Result |
| --- | --- |
| Dependency installation | Passed |
| Lint | Failed: 139 errors, 55 warnings |
| Type check | Passed |
| Production build | Passed |
| Unit suite | 22 suites, 63 tests passed |

The CI workflow deliberately retains failing lint checks. This baseline is a
snapshot, not a lint exemption. Resolve errors in a dedicated change before
treating the required gate as operational. Do not mass-disable lint rules,
add continue-on-error or downgrade errors to obtain a passing gate.
Independent review and integrated/UI QA were not performed for this onboarding
change. These docs/workflows do not change application runtime behavior.
