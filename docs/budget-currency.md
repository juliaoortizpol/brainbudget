# AEM-BE4 currency foundation

Approved requirements v1 hash:
17eb9d473cfcf8feb838bef10ba6ab878c76974ae7a147111b4e6be01b92c1ee.

## DOP-only V1

New budget planning amounts are DOP, compatible with ChillBudget's RD$ display.
The server persists `currencyContext={version:1,currency:"DOP",origin:"dop-v1-planning"}`
at budget creation. Optional budget DTO `currency` accepts only `DOP`. There is no
FX conversion, new money representation or frontend change. Numbers retain the
existing absolute expense and two-decimal rounding behavior.

Manual POST /transactions accepts optional explicit uppercase three-letter
`currency`, including USD. Omission defaults to DOP **only on manual creation**,
with `currencyContextVersion=1,currencyOrigin="manual-default"`. Explicit creation
uses origin `explicit`. Parser persistence preserves its purchase currency and
records origin `mail-parser`, version 1. Account currency is never consulted.
Schema hydration, PATCH omission and repeat imports never default historical
currency. Invalid/null manual currency inputs are rejected by DTO validation.
Schema setters no longer normalize historical currency on hydration or edits;
only exact DOP is supported for assignment and aggregation.

## Reads and eligibility

GET /budgets and /budgets/:id preserve item `spent` and `plannedAmount` numbers.
`spent` sums only exact DOP expenses for each item. The same owner, purchase
coverage (inclusive start, exclusive actual cutoff), ObjectId normalization and
as-of-now ceiling apply. Planning end never truncates active coverage.

Additive budget fields are `actualsCurrency:"DOP"`, `currencyContextResolved`,
`actualsComplete` and `currencyIssues`. Each issue has `transactionId`, original
`budgetItemId` (or null), raw `currency` (or null), and code `unsupported_currency`
for other three-letter uppercase codes or `unknown_currency` otherwise.
Issues cover **all owned in-period, nonfuture transactions**, including income,
unassigned rows and rows linked to removed items; no amounts, account information
or foreign-owner records are included. They describe the purchase-date period,
not exclusive ownership of an assignment by that period. Item metadata adds
`spentCurrency:"DOP"`, `actualsComplete` and issues for that original item ID.
Budget completeness also requires resolved planning context. A DOP component of
100.10 with USD20 and unknown30 must remain 100.10 and incomplete, never 150.10.
Clients must use this metadata before presenting a component as a complete total.

Manual assignment, retained-assignment currency/date/type edits, and remember
learning require supported planning context and exact DOP purchase currency,
in addition to existing owner/live-item/active-parent/type/date checks. Rejected
writes do not change assignments or rules. Automatic matching uses the same
policy and leaves unsupported/unknown imported purchases unassigned for review.
Existing manual choices are preserved even when their currency needs review;
aggregation still excludes those purchases. Import remains insert-only per
owner/source/message ID: repeat sync never overwrites a manual correction.

Actionable HTTP400 assignment messages:

- `Resolve budget planning currency explicitly as DOP before assignment`
- `Transaction currency is unknown; explicitly correct the purchase currency before assignment`
- `Only DOP transactions can be assigned; keep unsupported purchases for review without conversion`

## Legacy records and explicit resolution

No migration or backfill is included. Missing budget/report context remains
missing, and missing transaction currency remains unknown. All original IDs,
transaction/item links, purchase amounts and matching rules are retained.
Ordinary unrelated updates do not manufacture currency evidence.

An owner may acknowledge a legacy budget's DOP planning context with
PATCH /budgets/:id `{"currency":"DOP"}`. It records `explicit-resolution`; it
does not change any transaction. An unresolved closed budget can receive this
acknowledgement once; an already contextualized closed budget rejects currency
edits with `Closed budget currency context cannot be changed`. This changes no
coverage boundaries and does not resolve missing legacy lifecycle decisions.

PATCH /transactions/:id with the verified actual purchase `currency` records
version 1 and `explicit-resolution`. This is an explicit owner correction,
never an account-derived historical inference. An unknown purchase may be
corrected to DOP and assigned in one atomic request. If the verified purchase is
USD, retain USD, optionally clear an old assignment in that same PATCH, and keep
it for review. Do not relabel it as DOP or invent a converted amount. An ordinary
account edit never changes purchase or report currency evidence.

Closing checks all owned transactions in the proposed final coverage, including
income and unassigned rows. Missing planning context returns
`Resolve budget planning currency explicitly as DOP before closing`. Unresolved
purchases return HTTP400 with `currencyIssues` and message
`Currency issues block closing; explicitly correct purchase currencies. Unsupported currencies cannot be converted or relabelled as DOP`.
There is no bypass for a genuine unsupported purchase: V1 cannot finalize that
period until supported explicit resolution exists. Existing coverage-stranding
validation, owner lock and Mongo transaction boundaries remain enforced.

## BE5 report contract

BudgetPeriodReport now requires persisted `currencyContext` for new validation:
version 1, a copied resolved `planning` context, `actualsCurrency:"DOP"`,
`complete:true`, explicit empty `unresolvedTransactionIds`, and explicit
`transactions` evidence array. Each evidence entry retains transactionId,
budgetItemId (or null), DOP currency, version 1 and origin. Recognized origins are
manual-default, explicit, mail-parser, explicit-resolution and legacy-explicit.
The last means a purchase already carrying explicit DOP but predating origin
metadata; it does not permit treating missing currency as explicit.

The exported `reportCurrencyError` and schema validation reject missing context,
unsupported evidence, unresolved IDs, incomplete totals and duplicate transaction
IDs. There is no account reference or mutable account lookup in the monetary
context. Legacy reports hydrate unchanged with unresolved context and fail new
finalization validation. BE5 must construct evidence from the full owned final
coverage under its transaction, prove completeness against source purchases,
copy the context, and retain snapshot immutability. Schema validation alone
cannot detect a caller omitting source purchases. No BE5 preview/close/report
API, immutable-report service or BE6 preparation is implemented here.

## Verification boundary

TC1-TC5 regressions exercise DTOs, services, aggregate expressions, issue mapping,
Mongoose validation/hydration, controlled rollback and repeat imports. Those
tests use synthetic in-memory doubles, not HTTP/Mongo persistence. TC6 requires
Node24 verify:ci, trusted commit/pinning, exact-head CI, fresh Reviewer and QA.
Real HTTP/Mongo tests must use only brainbudget_qa_synthetic and verify rounding,
owner isolation, date boundaries, rejected-write rollback, report round-trip,
account edits and zero remaining owned fixtures/stopped services. No such service
or secrets are supplied to this Developer session. Independent QA must provide
an inspected portable HTML report. API-only screenshots are not applicable.
