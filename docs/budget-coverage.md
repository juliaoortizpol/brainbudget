# AEM-BE3 coverage contract

Requirements hash: 9aa64f989867da2378e81415e43c11f9c810769d781d24abcd36b8ebe89896da.
This working tree requires trusted checkpointing, synthetic persisted integration,
exact-head CI and fresh role validation. It is not a release or a QA pass.

## Dates and routes

New budgets have coverageVersion=1, explicit IANA timezone, inclusive startDate,
optional plannedEndDate, optional exclusive actualCutoffDate and server-controlled
closedAt. endDate is an optional compatibility alias of the planned end, never a
v1 actual boundary. Both planning names, if supplied, must identify the same instant.
Dates serialize as ISO instants. New creates require explicit timezone; it cannot
be inferred from server timezone, periodType or legacy dates. UTC date-only ISO
inputs remain accepted for compatibility; clients should send explicit offsets.

POST /budgets creates a draft or active budget and preserves existing budgets and
items. Drafts coexist. Active coverage has no final cutoff and continues after
planned end. No automatic expiry/reopening, reset, rematch, deletion or movement
occurs. Timezone is preserved after activation. Active-to-draft is rejected.

PATCH /budgets/:id with `{"status":"closed"}` closes at the confirmed server
instant. Optional actualCutoffDate can be any valid non-future instant strictly
after start. Neither start nor cutoff is rounded or required to be midnight.
closedAt records confirmation time independently of cutoff. Alternatively,
closeThroughDate="2024-11-30" requests the next local midnight in the preserved
timezone, including that completed local day. It cannot accompany actualCutoffDate.
Future/incomplete days and nonexistent next midnights are rejected (use an explicit
instant for the latter). Closed coverage cannot be edited or reopened.

Activation and final closure reject overlap with nondeleted active/closed coverage.
Adjacent periods may share the exact cutoff/start instant. Draft overlap is allowed
until activation. At most one active budget belongs to an owner. Unresolved legacy
lifecycle records cause an actionable migration error, never inferred history.
Legacy endDate edits also require migration because that field still controls
legacy coverage; ordinary name/rule edits do not reinterpret it.

Moving start later or closing earlier checks saved assignments, including string
and ObjectId references and soft-deleted items. HTTP 400 returns a message, up to
20 affectedTransactions (id, date, budgetItemId) and hasMore. Correct dates,
clear/reassign affected rows or choose a suitable cutoff before retrying. Names,
amounts, accounts and foreign records are omitted.

## Shared consumers

Import matching, manual assignment/date/type validation, spending and budget
period/review queries share inclusive-start/exclusive-cutoff purchase coverage.
Purchase date comes from the transaction/parser, never arrival/import time. Open
coverage is unbounded by plan or query clock. Spending additionally retains its
as-of-now ceiling: future purchases do not count before their purchase instant,
while a closed budget still excludes purchases at or after its final cutoff.
HTTP date fields reject impossible calendar dates rather than normalizing them.
Spending retains absolute expense
amounts, ObjectId normalization and two-decimal rounding; currency policy is unchanged.
Assignment still requires owned live items/active parents and compatible types.
Closed history retains saved links/manual metadata.

GET /transactions?budgetId=<owned-budget-id> selects purchase-date coverage,
including unassigned review expenses. Compose with matchingStatus=needs_review,
type/account/category filters and pagination. History omits matchingStatus. Date
scope does not imply assignment to that budget. Foreign/missing/deleted budgets
return 404. Mixing budgetId with startDate/endDate returns 400. Existing explicit
date filters retain inclusive end for compatibility; they are generic timestamp
filters, not budget coverage requests.

## Persistence prerequisites

Lifecycle, transaction create/update (including remember), budget soft deletions
and each mail upsert require Mongo transactions. Each writes the same owner-keyed
budgetCoverageLocks document BEFORE snapshot reads. Closure and assignment/import
contend on a real document; driver retries reread coverage and assignments. There
is no standalone/partial-write fallback. Failures return sanitized retryable 503
(mail reports SAVE_FAILED); competing first-use lock upserts may require caller
retry. The partial unique index one_active_coverage_v1_per_owner adds protection.
Stop old writers before migration: every deployed coverage writer must use this
protocol. Provision/verify replica-set transaction support, collections and indexes
before persisted concurrency checks. No service credentials are provisioned here.

Import retains user/source/message-ID insert-only upserts. Duplicate imports never
overwrite manual corrections. Context is refreshed in each locked transaction to
avoid stale batch coverage across closure. Parser/account/fetch pipeline boundaries
and BE7 ranking and rule serialization are unchanged.

## Conservative synthetic migration

coverage-migration.ts exports pure planCoverageMigration and operator entry point
migrateSyntheticCoverage(connection, userId, decisions, apply=false). Import the
compiled module from an operator-owned runner with an authorized Mongoose connection.
No URI/token is accepted or logged. It refuses every database except
brainbudget_qa_synthetic. This is not original/production migration authorization.

Inventory raw legacy records and assignments first. Supply one decision per live
legacy budget: budgetId, explicit timezone, endInterpretation. Closed records also
require an attested non-future closedAt and either preserve-inclusive-instant or
explicit-cutoff plus actualCutoffDate. Legacy November 30 00:00 was only that exact
instant under the inclusive predicate: preservation means endDate+1 millisecond,
never the whole last day. To explicitly resolve it as a completed day, calculate
next local midnight with completedDayCutoff and supply explicit-cutoff. Never infer
intent from periodType/day-of-month. Active records require open-active acknowledgment
to extend legacy coverage; drafts require draft. No timezone is inferred.

Missing decisions, invalid dates/zones, missing historical closure time, outside
assignments, overlaps and multiple active records make preview inapplicable. Resolve
explicitly, preserving manual history; there is no automatic winner/rematch. Until
migration, legacy reads preserve inclusive end using internal end+1ms. Invalid
legacy intervals are ineligible for assignment/matching, never repaired on read.

Preview writes nothing. Apply rereads/replans the full owner inventory under the
shared lock; all coverage-field updates commit together only without issues. Only
budgets change; _id, endDate and transaction/item IDs, rules, balances and links are
preserved. Reapply skips v1 records. Deleted legacy records remain untouched. Compare
synthetic before/after IDs, links and balances; verify idempotency and no-write preview.

## FE2 / BE5 / BE6 and verification boundary

Routes/envelopes and advanced rules remain compatible. Old clients can send endDate
as a plan; new creates need timezone. Supplied FE4 eligibleCategories uses <=endDate
and hides December choices. FE2 must adopt start<=purchase and (no actualCutoffDate
or purchase<actualCutoffDate), active status, explicit timezone and separate optional
planning/extended-period display. No frontend change is included. BE5 consumes final
cutoff/closedAt for its later immutable reports; none is generated here. BE6 may
start an adjacent budget at cutoff; copying/rollover is outside this ticket.

Local regressions use synthetic controlled persistence. coverage-routes.spec.ts
uses real Nest routes/bootstrap-equivalent ValidationPipe with controlled auth and
services, not real JWT/Mongo. Lock tests do not emulate isolation. Trusted operator
must execute pinned AEM-BE3-integration-matrix.md against brainbudget_qa_synthetic,
including activation and close-vs-assignment/import concurrency, rollback/standalone,
migration preview/apply, ownership, soft deletes and duplicate imports. Then commit,
pin, run exact-head CI and publish the linked backend PR through the broker. Fresh
Developer validation, independent Reviewer and independent QA remain required.
Independent QA supplies portable HTML API evidence. Product screenshots do not apply.
