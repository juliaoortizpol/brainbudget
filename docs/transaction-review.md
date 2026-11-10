# Expense assignment review (AEM-BE8)

`GET /transactions?matchingStatus=needs_review&page=1&limit=10` returns the
authenticated owner's reviewable expenses through the existing data/meta envelope.
The only supported matchingStatus query value is `needs_review`.

Review includes persisted `needs_review` expenses (both no-match and conflicting
matches). Persisted `manual` and `matched` rows are excluded. Successful manual
assignment writes `manual`, so subsequent review reads exclude that transaction.

Legacy means the stored matchingStatus is missing or explicitly null. Include
such expenses only when budgetItemId is also missing or null; a saved category
excludes a legacy row. Mongo equality to null covers both missing and explicit
null. Filtering occurs in Mongo before Mongoose hydration: the schema's
needs_review default on hydrated missing fields must not decide eligibility.
No migration, rematching or write on read is performed.

The review predicate is ANDed with ownership and all existing account, category,
date and type filters. Thus type=income combined with review returns an empty
page, rather than overriding the requested type. Existing date-descending sort,
pagination and total/count metadata remain in use. Omitting matchingStatus keeps
the previous list query and behavior.

Use budgetId instead of explicit dates for inclusive-start/exclusive-cutoff budget
coverage, including post-planned-end purchases while open and closed history.
This period includes unassigned review rows; it does not imply category membership.
See [coverage contract](budget-coverage.md).

## Persisted API verification handoff

The trusted host must use only `brainbudget_qa_synthetic`, with synthetic owners
A/B, an active budget and an eligible expense category for A. Insert raw legacy
fixtures to avoid Mongoose defaults: expense rows with missing/null status crossed
with missing/null/saved category. Also persist no-match and conflict needs_review
expenses, matched/manual expenses, a needs_review income and a foreign owner's
needs_review expense. Give fixtures distinct dates and include account/date
variants. Do not put credentials or bearer tokens in evidence.

Verify authenticated GET review returns only A's eligible expenses, correct totals
and multiple non-overlapping pages; verify account/date/category filters compose,
type=income yields zero, and invalid matchingStatus is rejected. PATCH a returned
expense with A's eligible budgetItemId and verify it disappears and total drops
by one. Check missing and null legacy fields separately and confirm assigned
legacy rows stay excluded even though hydration may show a default status.
Compare GET without matchingStatus with the original fixture inventory and
existing filter/pagination metadata. Clean up only these synthetic fixtures.

Local DTO/query regression tests do not substitute for these persisted API checks.
