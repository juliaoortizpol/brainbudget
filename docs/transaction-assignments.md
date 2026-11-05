# Transaction assignment API

POST /transactions accepts the existing frontend name, amount, type, ISO date
and optional accountId/budgetItemId payload without matching metadata.
Omitted or null budgetItemId creates an unassigned needs_review transaction.
An explicit item ID on POST or PATCH assigns/reassigns it with matchingStatus
manual and matchingSource manual. The item and its parent budget must belong to
the authenticated user and must not be soft deleted.

PATCH /transactions/:id with `{"budgetItemId":null}` clears the assignment,
sets needs_review and removes matchingSource and matchingConfidence. Omitting
budgetItemId preserves assignment metadata on ordinary edits. A clear request
does not prevent future automatic matching.

Matching status/source are optional compatibility fields; supplied values must
agree with the derived assignment. Client confidence and metadata-only PATCH
requests are rejected. Explicit assignments clear stale automatic confidence.
Assignment and metadata changes use one atomic transaction-document update.
The source of an imported transaction remains gmail; matchingSource is separate.
The matcher already preserves manual status/source and import deduplication
continues to use insert-only persistence.

Regression coverage: transactions.service.spec.ts uses synthetic model doubles.
Persisted HTTP and repeat-sync verification still requires the isolated
brainbudget_qa_synthetic service; unit results do not establish that evidence.
