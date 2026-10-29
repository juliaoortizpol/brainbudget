# classify-defect

1. Classify by user impact. Blocking: broken primary flows, incorrect financial results, data loss, security/privacy, unusable required UI, or material departure from scope/requirements.
2. Minor: cosmetic/low-impact issues that do not materially affect correctness, security, accessibility or usability. Uncertain severity requires Julio's decision and cannot advance automatically.
3. Blocking review/QA returns the original card to In Development with reproducible findings. BLOCKED stays in the current list with reason/resolver/next action.
4. For minor defects run `followups` through the sole trusted controller. It searches deterministic markers and exact-title candidates, reuses interrupted creates, and verifies Backlog plus links both directions. A possible unmarked duplicate requires operator selection instead of automatic creation. A single controller/state root is required; this is not distributed exactly-once delivery.
5. Keep the role's verdict intact. Decisions and follow-ups are artifacts; the orchestrator cannot invent a PASS or silently narrow acceptance criteria.
