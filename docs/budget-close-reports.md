# AEM-BE5 close and report API

All routes require the ordinary owner JWT. Dates in responses are ISO instants.

| Method and path | Request | Successful response |
| --- | --- | --- |
| POST /budgets/:id/close-preview | Empty object for the current instant, or exactly one of `actualCutoffDate` (ISO instant) and `closeThroughDate` (YYYY-MM-DD in the saved timezone) | HTTP 200 with coverage, saved planning configuration, DOP item figures, totals, `transactions`, `includedTransactionIds`, `blockers` and `previewToken`. Preview performs no writes. |
| POST /budgets/:id/close | `confirmed: true`, the preview's exact `actualCutoffDate` and `previewToken` | HTTP 200 with `reportId`, `budgetId` and `closedAt`. The budget ID scoped to its owner is the durable retry identity. A valid repeated confirmation returns the original result. |
| GET /budget-reports | Optional `page` (default 1), `limit` (default 20, max 100) | `{data,page,limit,total}`. Sorts by closure timestamp and budget ID descending. Each budget has `reportStatus`, `reportId` and `totals`. |
| GET /budget-reports/:id | Final report ID | Final saved report with exact included IDs, saved items, purchase detail and currency context. |
| GET /budget-reports/:id/transactions/:transactionId | Final report and saved purchase IDs | One saved purchase. |
| GET /budget-reports/:id/exceptions | Final report ID and optional page and limit | Paginated exceptions for the report. |
| GET /transactions/:id/closed-period-exceptions | Owned live transaction ID and optional page and limit | Paginated exceptions for the transaction. |

Explicit instants require an ISO timestamp with Z or a numeric UTC offset. Use
closeThroughDate for a calendar day in the saved timezone. Coverage includes
the start and excludes the cutoff. The cutoff must follow the
start and cannot be in the future. The planned end remains a planning field and
can pass while the budget stays active. The old report `endDate` field is an alias
of the actual cutoff. `closedAt` is the server confirmation time. The preview's
included IDs denote the full date-selected source set, even when blockers would
prevent persisting that set. DOP amounts with valid assignments contribute to
preview components. Treat figures as incomplete whenever blockers are present.

Per item, sum original purchase values, using absolute expenses and signed income,
then round to two decimals. Round planned amounts to two decimals for report
display and keep the original configuration. Expense variance is planned minus
actual. Income variance is actual minus planned. Totals sum the corresponding
rounded item figures. Saved drill-down returns the original row amounts and
matching metadata so clients can reproduce the same item calculation. Report
reads use saved data, including rule field, operator, value and source.

Use `blockers` to guide the owner. `resolve_budget_lifecycle` and
`resolve_other_budget_lifecycle` require explicit legacy lifecycle resolution.
`conflicting_budget_coverage` requires resolving overlapping coverage.
`resolve_planning_currency` requires explicit DOP planning. Unknown purchase
currency must be verified explicitly and genuine unsupported currency prevents
closure. `unassigned`, `invalid_assignment`, `assignment_type_conflict` and
`assignment_outside_cutoff` require reviewing the owned transaction or cutoff.
Amount/type errors indicate invalid stored figures and require correction.
The error payload identifies affected owned rows and excludes raw purchase
descriptions and account metadata.

Finalization rereads inputs and source rows under the owner lock. HTTP 409
`stale_close_preview` requires a fresh preview and explicit reconfirmation.
HTTP 400 `close_blocked` returns current blockers. Foreign and unavailable
resources return 404. Missing Mongo transaction support or commit failures return
a retryable 503. Deployment requires a transaction-capable Mongo topology and
the report unique index. A failed write aborts both report and status changes.

The old PATCH status-to-closed request returns 400 and directs clients to preview
and confirmed close. Closed budget and item configuration cannot be edited,
deleted or reopened. The legacy planning-currency-only acknowledgement still
applies to an unresolved closed budget. Legacy closed budgets appear as
`reportStatus: "unavailable"` with null report ID and totals. No report is
generated on read. Ordinary Transactions listing and detail retain original
assignment IDs and add owned `assignmentContext` with item/budget labels when
the original link can be resolved, including retained soft-deleted records.

Transaction reads with recorded exceptions add `hasClosedPeriodExceptions: true`.
The dedicated exception endpoints return `{data,page,limit,total}` with the same
pagination defaults and limits as report history. Entries sort by exception ID
descending and include `reportId`, `budgetId`, `transactionId`, `createdAt`,
`kind`, `includedInSnapshot`, `inCoverageAfter` and purchase evidence in `before`
and `after`. A late arrival has null `before` and never enters the saved snapshot.
Only the report owner can read the exception. Use the saved report drill-down
for closing-time evidence and the exception endpoints for subsequent changes.

Manual and Gmail purchases that arrive inside finalized coverage are saved for
review with no active assignment. If a manual create targeted a valid item in
that same finalized period, it still saves for review with no assignment.
Repeat Gmail imports do not create an exception or overwrite the original
purchase. A purchase exactly at the cutoff is outside the finalized period.

An explicit item assignment inside finalized coverage returns HTTP 409
`closed_period_assignment`. An included row can retain its historical item
on a live date, type or currency correction. The change is audited and leaves
the report untouched. An owner can clear the live link explicitly, or assign
it to an eligible active item if a verified corrected date is outside finalized
coverage. The exception preserves the previous live link. Corrections into or
out of finalized coverage are recorded even for rows outside the included set.
An unchanged payload does not append an exception. A historical correction
never converts a currency. Record the verified actual purchase currency.

DELETE /transactions/:id returns HTTP 409
`closed_period_transaction_retained` for originals referenced by final reports
or exceptions. Use a live correction. Unrelated transactions keep ordinary
DELETE behavior. Creates, import upserts, edits, assignments and deletes take
the same owner lock as close. Late arrival and correction evidence commit in
the same Mongo transaction as the corresponding purchase write. An exception
write failure aborts both operations. Imports report such failures as
`SAVE_FAILED`; the original Gmail message can be retried.

Controlled tests exercise cutoff, reconciliation, stale review, owner scope,
lock and session ordering, late imports and manual arrivals, duplicate import
handling, correction evidence and error handling. The persisted synthetic
HTTP/Mongo matrix still needs real transaction rollback, concurrent writes,
unique-index enforcement and retained IDs. A report is one Mongo document, so
an oversized report fails atomically at MongoDB's BSON document limit.
