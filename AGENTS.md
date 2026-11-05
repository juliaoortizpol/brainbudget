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

## Database selection
All tests run by AI agents on Julio's behalf must use `brainbudget_qa_synthetic`.
Julio's own manual testing uses the original `brainbudget` database.
When starting the app for Julio to test personally, use the original development
configuration. Keep AI test servers separate and verify their database target
before running tests; never run AI tests against the original database.
## Verification
Before committing or pushing any executable/configuration change, run `npm run verify:ci`
with Node 24, plus the Python controller tests when orchestration changes. This includes
tooling outside src: the root type-check also discovers orchestration TypeScript files.
Unit/browser smoke passes alone are not evidence that type-checking or building passed.
Inspect the exact-head GitHub checks after pushing before reporting CI success.
Use Node 24 and npm ci (the initial CI baseline).
Run non-mutating lint: npx --no-install eslint "{src,apps,libs,test}/**/*.ts"
Run types: npx --no-install tsc --noEmit --incremental false -p tsconfig.json
Run unit tests: npm test -- --ci --runInBand
Run build: npm run build
npm run lint applies --fix; do not use it as proof of a non-mutating CI check.
The e2e scaffold is not a verified integration gate; see docs/testing.md.

## Workflow
Trello tickets are user stories; labels represent epics. Related backend and frontend
stories share the same epic label. Record the user outcome, priority, scope/modules,
dependencies and testable acceptance criteria in every story. Link frontend stories
to the actual backend prerequisite cards and add reciprocal related-story links.
Always implement and verify the related backend work before starting its frontend
implementation. New stories remain in Backlog for Julio's review; creation is not
scope approval or permission to start development. Use connector tools for Trello;
if browser/computer use is needed, stop and ask Julio to perform that step.
Read orchestration/WORKFLOW.md and orchestration/PERMISSIONS.md for the authoritative
Finances workflow and role boundaries. Procedures live under orchestration/procedures.
Use approved ticket scope and isolated branches. Developer, Reviewer and QA need fresh
contexts; never claim another role passed. No merge, deployment, protection changes or
production access during implementation. Do not weaken checks or remove tests for green CI.
Use synthetic data; keep credentials, JWTs, real mail and private finances out of evidence.
