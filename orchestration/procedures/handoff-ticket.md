# handoff-ticket

1. Product Owner supplies ticket id, version, goal, explicit include/exclude, testable acceptance ids, execution mode, affected repos and Trello card. `init` records exact base commits. No feature starts during setup.
2. Julio gives explicit scope approval in an operator-owned file tied to requirements_hash; `ready` records it. `prepare` creates isolated private branches; `sync` verifies Trello moves. `advance` starts the single active development ticket.
3. Launch each role fresh. Persist only structured handoffs/results and actual session ids, not full conversations. Keep code refs, PRs, CI, evidence, blockers and attempt counts in state.json.
4. One controller lock protects mutations; one active development ticket; role attempts are capped at three per revision. Interruptions remain visible. Never remove a stale lock until its PID/child tree is confirmed stopped; inspect state and remote effects before retrying.
5. `pin` rejects dirty/uncommitted code and invalidates verification/review/QA/approval after commit changes. `revise` requires a new requirements version and returns to Backlog. BLOCKED records owner/next action and stays put.
6. After passing QA, sync Your Approval and give Julio report/screenshot paths. His final approval file must match requirements+commits. He merges all linked PRs himself. `complete` only verifies those merges; it never merges/deploys. Sync Done separately; record deployment elsewhere.
