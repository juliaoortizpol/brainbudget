# Budget matching rules

Budget create, budget update with new items, add-item and item update validate
provided matchingRules before any persistence or soft deletion. Omission preserves
existing rules; an empty array clears rules. Null arrays and null entries are invalid.
Each item accepts at most 100 rules, IDs up to 128 characters and raw values up to
256 characters. IDs must be nonblank and unique within the item. Values must remain
nonempty after MerchantNormalizationService normalization. Duplicate tuples of
field, operator and normalized value are invalid within an item, regardless of
source. Overlapping rules across different items are allowed.

Validation preserves IDs, raw display values, merchant/description fields,
equals/contains operators and user/learned/suggested sources. Unrelated updates do
not validate or rewrite legacy saved rules. No history migration or rematching runs.

The existing matcher compares eligible rules in this order:

1. Exact normalized equality outranks partial matches, including a contains rule
   whose value equals the entire normalized field.
2. Longer normalized values outrank shorter values.
3. Equally specific user and learned rules outrank accepted suggestions (suggested).

User and learned have equal preference. Equal-ranked rules on different items
require review, including equal sources. Multiple winning rules on one item count
as one winner. Array order never breaks a tie. Manual assignments remain unchanged.
Existing ownership, expense/income, active-budget/date and soft-delete filters apply.

## Remember a manual assignment (AEM-BE9 / FE4 contract)

Authenticated `PATCH /transactions/:id` accepts the existing assignment payload plus
`rememberMerchant: true` and `merchantKeyword: "Synthetic Shop"`. Supply an explicit
`budgetItemId`; clearing or omitting the item cannot request learning. This applies
to an existing owned expense and an eligible owned expense item. The transaction's
effective date must fall within the active parent budget. Converting an income to
an expense in the same request cannot enable learning.

Omitted/false remember consent retains normal assignment/reassignment/clear behavior.
A keyword alone never learns. Controls are never persisted as transaction fields.
`POST /transactions` does not accept these controls. The PATCH success response is
the existing transaction object with manual assignment metadata, with no new response
envelope or learning fields. FE4 can read the item's rules through the existing budget
API when needed. No matcher or import invocation occurs during this request.

Learning appends a UUID-identified `merchant`/`contains`/`learned` rule, preserving the
supplied raw keyword. BE7 normalization determines equivalence and rejects unusable
values; raw keywords are limited to 256 characters and items to 100 rules. Existing
equivalent user/learned rules are reused (including when at the rule limit). An
equivalent suggested rule changes only its source to learned, retaining ID and raw
value. Other rules and other items are untouched. Changed rule lists must satisfy
BE7 validation; invalid legacy lists require correction before learning a new rule.

MongoDB `withTransaction` commits the item mutation and assignment together. Reads
and writes use the same session; concurrent writes to an item produce write conflicts
and driver transaction retries read a fresh snapshot before deciding equivalence.
There is no standalone Mongo/partial-write fallback. Invalid consent/keyword/item
requests return 400; missing/foreign transactions return 404. Persistence or missing
transaction support returns a sanitized 503 instructing the caller to retry or assign
without remember. No raw database errors are returned. A lost HTTP response can be
retried with the same payload without duplicating the rule.

### Trusted persisted verification still required

Use only `brainbudget_qa_synthetic`. Record the checkpoint commit and sanitized HTTP
request/response plus persisted before/after evidence for each case:

- Omit consent and use false consent for assign/reassign/clear; verify all rules unchanged.
- Learn a valid keyword, GET transaction/item, confirm controls absent and advanced
  IDs/raw values/fields/operators/sources preserved. Reject nonboolean/null consent,
  missing/null/blank/normalization-empty/overlength keyword and missing/clear item.
- Reject foreign/missing transactions, foreign/deleted items or parents, income,
  inactive budgets and out-of-period dates without either document changing.
- Retry equivalent requests and send concurrent equivalent requests against both the
  same and different transactions targeting one item. Expect one rule. Include
  concurrent distinct keywords and preserve both. Reuse user/learned and promote a
  suggested equivalent without changing its identity/raw value; test the 100-rule limit.
- Force failures at item write, transaction write and commit; compare persisted
  snapshots to prove rollback. Run against a standalone synthetic Mongo deployment
  to verify explicit 503 and zero writes when transactions are unsupported.
- Import synthetic mail after learning through the existing import pipeline; verify
  an unambiguous match, cross-item tie review, historical manual assignment preservation
  and repeated-message idempotency. No Gmail OAuth or real mail is needed.

`remember-assignment.spec.ts` uses controlled persistence for session routing,
failure propagation/rollback requests, normalized retries and matcher compatibility.
It does not prove MongoDB rollback, real concurrency or HTTP integration. Produce
the portable HTML QA report with short expected/actual API use cases and sanitized
evidence. Screenshots do not apply: this backend ticket changes no UI.

## Verification

matching-rule-validation.spec.ts checks all four service and DTO write entry points,
schema validation, raw advanced-rule serialization, limits and unrelated legacy edits.
budget-matching.service.spec.ts covers specificity, source preference and ties.
These tests use synthetic objects and mocked persistence; they do not establish
MongoDB persistence or real API integration.

At the trusted operator checkpoint, target only brainbudget_qa_synthetic. For each
write endpoint, submit invalid rules (blank, normalization-empty, duplicate IDs,
normalized duplicates, nulls and over-limit payloads), expect HTTP 400 with an
actionable field/index error and verify prior data remains unchanged. Include a
later invalid item in a multi-item budget write to check rejection before mutations.
Create valid merchant/description and equals/contains rules with all three sources,
GET them back and compare IDs, raw values, fields, operators and sources. Allow
cross-item overlaps, clear with [], and confirm an unrelated edit preserves legacy
rules. Record exact checkpoint commit and synthetic API/database evidence.
