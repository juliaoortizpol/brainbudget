# Transaction assignment API

POST /transactions accepts the existing frontend name, amount, type, ISO date
and optional accountId/budgetItemId payload without matching metadata.
Omitted or null budgetItemId creates an unassigned needs_review transaction.
An explicit item ID on POST or PATCH assigns/reassigns it with matchingStatus
manual and matchingSource manual. The item and its parent budget must belong to
the authenticated user and must not be soft deleted.
The parent must be active (draft and closed budgets are ineligible), the item
type must equal the resulting transaction type, and the resulting transaction
date must fall within inclusive startDate / exclusive actualCutoffDate coverage.
Active v1 budgets have no cutoff, so plannedEndDate/endDate never blocks a later
purchase. Legacy records retain inclusive end until explicit migration. See
[coverage contract](budget-coverage.md).

PATCH /transactions/:id with `{"budgetItemId":null}` clears the assignment,
sets needs_review and removes matchingSource and matchingConfidence. Omitting
budgetItemId preserves assignment metadata on ordinary edits. A clear request
does not prevent future automatic matching.
Changing date or type while retaining an assignment revalidates that assignment
using the effective values (existing values for omitted fields). Reassignment
also uses effective values. Incompatible requests return HTTP 400 before any
transaction write. Explicit clearing can accompany incompatible date/type edits.
Unavailable, foreign and deleted references share a generic actionable error;
owned live references report inactive budget, type mismatch or out-of-period
date problems. Rejected requests leave the transaction unchanged.
Eligibility-sensitive PATCH writes compare the read date, type and item reference
with the persisted transaction. A concurrent change returns HTTP 400 asking the
caller to reload and retry, rather than applying a stale validation result.

Matching status/source are optional compatibility fields; supplied values must
agree with the derived assignment. Client confidence and metadata-only PATCH
requests are rejected. Explicit assignments clear stale automatic confidence.
Transaction create/update participates in the owner coverage lock and Mongo
transaction. Transactional database support is required; failures return sanitized
503 without partial-write fallback.
The source of an imported transaction remains gmail; matchingSource is separate.
The matcher already preserves manual status/source and import deduplication
continues to use insert-only persistence.

Regression coverage: transactions.service.spec.ts uses synthetic model doubles.
Persisted HTTP and repeat-sync verification still requires the isolated
brainbudget_qa_synthetic service; unit results do not establish that evidence.
