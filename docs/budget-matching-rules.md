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
