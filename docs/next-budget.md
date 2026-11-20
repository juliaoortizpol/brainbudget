# AEM-BE6 next-budget drafts and activation

Requirements v2 hash
`186001d9471df1aa8bc6798fb90c992507abea1f0ea78d3caaa06417ae3771b0`.
All endpoints below require the ordinary owner JWT. Successful budget responses
use the existing unwrapped budget object with `items`, DOP context, and budget
and item actuals metadata. Dates serialize as ISO instants.

| Method and path | Body | Response |
| --- | --- | --- |
| POST /budgets/:sourceId/drafts | Required `name`, `periodType`, `startDate`, `timezone`. Optional `currency: "DOP"`, `plannedEndDate` and compatible `endDate` alias. | 201 with the new draft and fresh item IDs. |
| POST /budgets | Same planning fields plus `status: "draft"`. Omit `items` or pass an empty array for an empty draft. | 201 with the editable draft. |
| POST /budgets/:draftId/activate | Send `{}` for the default, or `{"startDate":"2025-02-03T04:00:00Z"}` to choose an explicit coverage start. | 200 with the active budget, effective start and existing item IDs. |
| PATCH /budgets/:draftId | Send `{"status":"active"}` with optional `startDate`. | Same activation response as POST /budgets/:draftId/activate. |

`periodType` accepts monthly, weekly or custom. Supply a valid budget timezone.
For `startDate`, create, copy, PATCH (including status changes) and dedicated
activation accept the existing `YYYY-MM-DD` format. If you include a time, send
an ISO timestamp with `Z` or a numeric UTC offset, such as
`2025-02-03T04:00:00Z` or the equivalent `2025-02-03T00:00:00-04:00`.
An offsetless timestamp returns 400 with a `startDate` validation message.
Add the intended offset or submit a date-only value and retry.
Draft creation needs a provisional start even while the prior cutoff is unknown.
The two planned-end fields must agree when both are sent. The planned end must
follow the effective start, including when activation defaults to a later cutoff.
Edit the draft plan before retrying if its end would precede or equal that cutoff.
Use ordinary budget and item GET/PATCH routes, plus POST/DELETE item routes, for
draft review. Copy never takes client-supplied items, status, closure fields or IDs.

Copy reads an owned, retained active or closed source and its retained live items
under the owner lock, including when the source has passed its planned end.
It copies name, description, type, planned amount, icon, color, alert settings and
advanced rules in their saved order. Rule `id`, `field`, `operator`, `value` and
`source` remain unchanged within each new item. FE5 can use its existing
serialization adapter for the display keyword and wire value. Source planning
must already be resolved as DOP. If eligible for explicit BE4 acknowledgement,
resolve the source separately with its existing currency-only PATCH. Supply new
dates and timezone explicitly. Copy leaves legacy source dates and currency as
stored and does not read report snapshots as item templates.

## Activation and errors

Finish the prior active budget with BE5 close preview and explicit confirmation.
If retained closed budgets exist, the latest exclusive cutoff must have a
matching saved final report. Unresolved retained coverage blocks activation.
An omitted activation start uses that latest cutoff, including when the draft
has a different provisional start. With no retained history, it uses the saved
draft start. An explicit start may equal the cutoff or leave a gap. The active
period starts inclusively and stays open until confirmed closure. Prior planned
end and closure timestamp are independent of the chosen start. The draft's
timezone and DOP context carry into the active budget.

Status-to-active PATCH uses the same checks and default as dedicated activation.
It accepts only `status: "active"` and optional `startDate`. A request that
also includes planning fields or `items` returns 400 before any budget or item
changes. Save configuration with a separate ordinary PATCH without
`status: "active"` or with the existing item routes, then send activation.
Ordinary PATCH requests remain available for draft and active budget edits.
Existing direct active POST retains its required explicit start and runs the
same prior-closure and coverage checks. It creates a new record, so reconcile
the owned budget list if its response is lost. Active and closed budgets cannot be
soft-deleted to bypass closure or coverage guards. Legacy unresolved history
requires an authorized explicit resolution before retrying. A resolved interval
alone does not establish the latest prior budget's final report.

- **400** means invalid planning or lifecycle context. `invalid_source_item`
  includes only the owned item ID and a validation message. Correct the active
  source's configuration or use an empty draft if an immutable closed source is
  invalid. No draft or partial set of copied items is saved on validation failure.
- **404** covers missing, foreign, soft-deleted and malformed source/target IDs.
- **409** means an active budget must be closed first or a repeated activation
  requested a different start. Close via BE5 or reload the budget as applicable.
- **503** means the transactional write could not be confirmed. Reload the owned
  budget list and check current state before retrying. A copy request creates a
  new draft per successful submission, so reconcile before resending it.

Activation retries over either existing-budget route are safe while the same
budget remains active. Omit the start or pass an equivalent instant to return
the active record without reapplying a write to the budget or items. Closed targets stay
immutable. Each transaction attempt derives an omitted start from the confirmed
cutoff visible to that attempt. If a competing request activated the same draft
between attempts, an omitted start returns the committed active budget.
Concurrent activation contends on the shared per-owner Mongo lock
and retains the unique active-budget index. Draft creation and all item inserts
commit together. No standalone Mongo fallback is supported.

## FE5 review and historical purchases

Copy and activation do not write any purchases, accounts, reports or exceptions.
Drafts never enter automatic matching. New item actuals begin at zero, with
existing DOP-only eligible expense and rounding behavior. Budget-level currency
issues can already include owned in-period purchases that need review.

After activation, list `GET /transactions?budgetId=<activeId>&matchingStatus=needs_review`
with the existing `{data,meta}` envelope. Use the returned transaction ID for
`PATCH /transactions/:id` with `{"budgetItemId":"<eligible owned item ID>"}`.
The existing assignment path checks owner, active item, date, type and DOP.
An eligible pre-imported expense retains its saved ID and purchase/source
evidence. No automatic rematch occurs. If a to-be-closed active budget already
owns an assignment outside the proposed cutoff, address the blocker in the BE5
preview before confirmation. Finalized-period late arrivals and corrections
remain in the original exception workflow. Read the original report ID for
saved financial data, and use existing exception routes for later changes.

## Verification

The Developer regressions use controlled persistence and Nest route injection.
TC1–TC5 and TC9 cover route validation, copy projection and rule validation,
fresh IDs, the empty alternative, guards, cutoff default and same-draft retry
through both activation routes. TC5 and TC9 also cover rejected mixed PATCH
requests, competing same-draft starts and successful separate configuration edits.
Real authenticated HTTP/Mongo verification must use only
`brainbudget_qa_synthetic` and the approved TC1–TC10 matrix. It includes
post-native-write faults, concurrent activation, retained history and
import/assignment, followed by fixture and service teardown. Product screenshots
are inapplicable. Independent QA supplies portable HTML with API evidence.
