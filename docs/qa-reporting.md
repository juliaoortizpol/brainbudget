# QA and handoffs

## Ownership
Trello owns requirements, scope, priority and task status. Repository docs own
durable technical context. PRs own implementation, review and QA evidence.
Start with one ticket in development. Julio chooses execution mode and final approval.
Use separate sessions for Development, Review and QA. Share artifacts and relevant
source, not entire conversations. Do not claim a role ran when it did not.

## Verdict and movement
- PASS: acceptance criteria verified, no defects; move to Your Approval.
- PASS WITH FOLLOW-UPS: intended behavior works and only minor defects remain;
  create or link bug tickets in Backlog before moving to Your Approval.
- FAIL: blocking defect; document findings on the original card and return to
  In Development with a checklist of required fixes.
- BLOCKED: verification incomplete; stay in QA Testing and record the missing
  environment, access or decision and the next action.

Blocking defects include broken primary flows, incorrect financial results,
data loss, security/privacy issues, unusable required UI, and material departures
from agreed requirements or established behavior. Judge user impact, not fix size.
Minor defects are cosmetic or low-impact issues that do not materially affect
correctness, security, accessibility or usability. Search for duplicates and link
original and follow-up tickets in both directions. Escalate uncertain severity
to Julio; never silently narrow acceptance criteria.

## Required evidence
Record PR, exact tested commit(s), environment, acceptance results, expected
versus actual behavior, reproduction steps, findings and testing limitations.
For UI changes attach captioned screenshots of the normal state and relevant
empty, loading, validation or error states; capture desktop/mobile where supported.
Use synthetic transactions and accounts. Never include tokens, real mail bodies,
credentials or private financial data. API-only work may explain why screenshots
are not applicable, but must include API/test evidence.

Retest fixes and affected behavior at the new commit; obtain renewed independent
review where affected. Record both repository commits for integrated testing.
QA pass is completion from QA's perspective; Done still requires Julio's approval
and merge of all PRs needed for the ticket. Deployment is recorded separately.
A minor QA finding does not waive a failed required CI check.
