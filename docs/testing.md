# Verification and CI

## Reproducible setup
Initial CI baseline: Node 24, npm, npm ci using the committed package-lock.json.
Install from the repository root. Dependency installation failure is a failed
check, not a successful test. Review lockfile changes deliberately.

## Commands
- Lint (no writes): npx --no-install eslint "{src,apps,libs,test}/**/*.ts"
- Types (includes unit/e2e TypeScript): npx --no-install tsc --noEmit --incremental false -p tsconfig.json
- Unit suite: npm test -- --ci --runInBand
- Build: npm run build

The unit suite uses Jest/ts-jest and @/ module mapping configured in package.json.
npm run lint auto-fixes files; CI deliberately invokes ESLint without --fix.
npm run test:e2e currently imports the full AppModule. It needs isolated MongoDB
and OAuth configuration; test/jest-e2e.json lacks the unit suite's @/ mapper and
the scaffold does not close the app after tests. It is not a required check yet.
Repair/configure it and verify deterministic cleanup before promoting it to CI.
Do not run root test-auth.js/test-accounts.js against unknown data stores.

## Required checks rollout
.github/workflows/ci.yml runs on every PR, push to master and manual dispatch.
Its backend-required job fails if any matrix check fails or is cancelled.
No continue-on-error, silent missing-script success or path-based workflow skips.
Runtime tests needing credentials/data stay outside this initial gate.

After the workflow is merged and has reported checks on master:
1. Resolve baseline failures; do not suppress them in the workflow.
2. In GitHub branch protection/rulesets for master, require pull requests and
   the exact check name backend-required from GitHub Actions.
3. Require resolved review conversations; prevent force pushes/deletion and
   avoid agent bypass permissions.
4. Keep Julio's approval/merge decision as the final workflow step.
   A sole PR author cannot approve their own PR as a GitHub required reviewer;
   choose an eligible independent reviewer before requiring approval counts.
5. Verify enforcement using a deliberately failing test PR before relying on it.

Workflow files alone do NOT enable branch protection. Protection configuration
is a separate admin step and is not claimed as active by this PR.

## QA
Use docs/qa-reporting.md. For integrated testing, record both repositories' exact
commits, isolated environment and synthetic data. Unit/build checks do not replace
independent review, browser QA, authorization checks or financial correctness tests.
