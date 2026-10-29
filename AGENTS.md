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
Read orchestration/WORKFLOW.md and orchestration/PERMISSIONS.md for the authoritative
Finances workflow and role boundaries. Procedures live under orchestration/procedures.
Use approved ticket scope and isolated branches. Developer, Reviewer and QA need fresh
contexts; never claim another role passed. No merge, deployment, protection changes or
production access during implementation. Do not weaken checks or remove tests for green CI.
Use synthetic data; keep credentials, JWTs, real mail and private finances out of evidence.
