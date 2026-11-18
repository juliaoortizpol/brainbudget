# AEM-BE5 close and report API

All routes require the ordinary owner JWT. Dates in responses are ISO instants.

| Method and path | Request | Successful response |
| --- | --- | --- |
| POST /budgets/:id/close-preview | Empty object for the current instant, or exactly one of `actualCutoffDate` (ISO instant) and `closeThroughDate` (YYYY-MM-DD in the saved timezone) | HTTP 200 with coverage, saved planning configuration, DOP item figures, totals, `transactions`, `includedTransactionIds`, `blockers` and `previewToken`. Preview performs no writes. |
| POST /budgets/:id/close | `confirmed: true`, the preview's exact `actualCutoffDate` and `previewToken` | HTTP 200 with `reportId`, `budgetId` and `closedAt`. The budget ID scoped to its owner is the durable retry identity. A valid repeated confirmation returns the original result. |
| GET /budget-reports | Optional `page` (default 1), `limit` (default 20, max 100) | `{data,page,limit,total}`. Sorts by closure timestamp and budget ID descending. Each budget has `reportStatus`, `reportId` and `totals`. |
| GET /budget-reports/:id | Final report ID | Final saved report with exact included IDs, saved items, purchase detail and currency context. |
| GET /budget-reports/:id/transactions/:transactionId | Final report and saved purchase IDs | One saved purchase. |

Coverage includes the start and excludes the cutoff. The cutoff must follow the
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

This foundation still requires report-linked late-arrival and correction
exceptions, report-referenced deletion protection, and real synthetic HTTP/Mongo
verification, including rollback and contention. Local controlled tests exercise
the service contract without attesting to Mongo isolation.
