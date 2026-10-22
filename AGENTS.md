# BrainBudget repository instructions

## Context
This is the NestJS backend. Frontend: https://github.com/juliaoortizpol/chillbudget.
Current composition: Nest modules, controllers, services, DTOs and Mongoose schemas.
Preserve that structure; a broader architecture migration requires an explicit ticket.

## Engineering boundaries
Keep authentication/authorization and validation at API boundaries; scope user-owned
reads and mutations by authenticated user. Preserve soft-delete filters where used.
Check frontend consumers before changing DTOs, routes or response envelopes.
Money currently uses JavaScript numbers. Preserve documented behavior and cover
rounding, dates, currency and duplicate imports when affected; do not introduce a
new money representation without an explicit migration decision.
Keep Gmail parsing, account matching and persistence in their existing pipeline stages.

## Verification
Use Node 24 and npm ci (the initial CI baseline).
Run non-mutating lint: npx --no-install eslint "{src,apps,libs,test}/**/*.ts"
Run types: npx --no-install tsc --noEmit --incremental false -p tsconfig.json
Run unit tests: npm test -- --ci --runInBand
Run build: npm run build
npm run lint applies --fix; do not use it as proof of a non-mutating CI check.
The e2e scaffold is not a verified integration gate; see docs/testing.md.

## Workflow
Read docs/product.md, docs/architecture.md and docs/testing.md before changing behavior.
Use the Trello ticket's acceptance criteria and execution mode; do not invent scope.
Work on a ticket branch and open a PR to master. Link related changes in the other
repository. Keep documentation current when behavior, API contracts or setup change.
Use .github/pull_request_template.md and docs/qa-reporting.md for handoffs.
Developer, Reviewer and QA use separate sessions; do not fill in another role's
verdict or treat a developer summary as independent verification.
Blocking defects return the original ticket to development. Minor defects need
linked follow-up tickets and may pass QA. Julio approves; Done requires merge.
Never merge, deploy, alter protection, or bypass failing checks as part of implementation.
Report exact commands and failures; do not disable rules or delete tests to obtain green CI.
Use synthetic data. Do not log or commit credentials, JWTs, Google tokens or real mail.
