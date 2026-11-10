# AEM-BE3 implementation checkpoint

Requirements hash: 9aa64f989867da2378e81415e43c11f9c810769d781d24abcd36b8ebe89896da.

This is an incomplete implementation checkpoint, not a released API contract.
The new pure `budget-coverage.ts` helper expresses inclusive purchase coverage
start and optional exclusive actual cutoff. An absent cutoff is unbounded.
Planned end dates never participate in these predicates. Boundaries must be
valid instants at local midnight in an explicitly supplied timezone; the host
timezone is irrelevant. Final closure requires a cutoff no later than the
closure timestamp, which must not be in the future. Adjacent intervals do not
overlap. No records, IDs, saved assignments or balances are changed by the helper.

## Remaining implementation

The helper is deliberately not wired into existing services yet. Current routes
still use legacy fixed endDate behavior. Do not advertise extended active coverage
to FE2 or execute a legacy migration from this checkpoint.

- Add schema/DTO fields and safe lifecycle transitions, preserving supported
  existing request/response consumers; document explicit planned end semantics.
- Remove create-time soft deletion of existing budgets/items. Enforce one active
  budget per owner and overlap checks with persisted concurrency protection.
- Coordinate closure against assignment/import writes; reject a cutoff that
  strands saved assignments with safe actionable details, without rematching.
- Wire one purchase-date policy into matching, assignment/date/type edits,
  spending and budget-period/review queries. Preserve eligibility, ownership,
  soft deletes, manual metadata, matching precedence and import idempotency.
- Build conservative synthetic migration tooling. Legacy last-day midnight is
  ambiguous: do not infer timezone, convert to an exclusive boundary or silently
  reinterpret saved history. Inventory and explicitly resolve conflicts before
  mutation; preserve transaction IDs and associations.
- Supply final FE2/BE5/BE6 contract documentation. Immutable reports, rollover,
  currency redesign and frontend implementation remain outside this ticket.
- Add service/DTO/concurrency/migration regressions and trusted persisted route
  verification using only brainbudget_qa_synthetic. Unit helper tests alone do
  not verify ValidationPipe, MongoDB behavior or the approved acceptance criteria.

The trusted operator must review/checkpoint the diff because .git is read-only
for this role. Pin final commits, run exact-head CI and publish linked PRs through
the broker. Fresh Developer validation, independent Reviewer and independent QA
(including portable sanitized API HTML evidence) remain required. No UI changed.

## Actual local verification

On 2026-11-09, Node 24.16.0 `npm.cmd run verify:ci` exited 0 in the assigned
backend checkout: non-mutating lint, TypeScript checks, 33 Jest suites / 209 tests,
three environment/browser guard tests and production build passed. Six new
coverage helper tests use synthetic in-memory dates; no database or live service
was accessed. This validates the uncommitted checkpoint only, not exact-head CI
or complete ticket behavior. HEAD remains
`a8068c06caf8f51481f38a3f060fde1241788497`.
