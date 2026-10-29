# Synthetic QA environment

Julio confirmed on 2026-10-29 that backend .env points at the shared dev/QA instance and approved a separate database, brainbudget_qa_synthetic. The tools read only MONGODB_URI from that file; they do not copy its other secrets into QA processes. The original database and production instance are not targets. A separate database is logical data separation, not a separate MongoDB account or network boundary.

Use Node 24 from the backend checkout (the bundled node.exe may be needed because PATH currently selects Node 22):

```powershell
node --test orchestration/environment/qa.test.cjs
node orchestration/environment/qa.cjs pin
node orchestration/environment/qa.cjs seed
node orchestration/environment/run.cjs smoke
node orchestration/environment/run.cjs serve
node orchestration/environment/run.cjs browser-smoke
```

Seed is repeatable without overwriting existing fixture records. Reset uses `node orchestration/environment/qa.cjs reset`, checks the ownership marker and all collection document IDs before deleting only known fixture IDs, then recreates them. It refuses unknown documents and never drops a database or collection. Stop the supervised app before seed/reset; an exclusive local server.lock prevents simultaneous operations. This is an operator utility, not a distributed lock. Do not give other writers access to the synthetic database during reset. A crash may leave the lock: verify its recorded PID and children have stopped before removing it.

The supervisor builds the backend, checks tracked application files are committed, refuses occupied ports, binds child servers to loopback, and runs from an isolated working folder so the backend cannot load its normal .env. The local wrapper restricts backend listen calls without changing application source. API: http://127.0.0.1:13000; UI: http://127.0.0.1:15173. The frontend gets an explicit VITE_API_URL and the API CORS origin matches it. Smoke verifies readiness then stops both child processes. Serve stays in the foreground; Ctrl+C stops its children. It does not stop unrelated development servers.

Fixtures include qa1@example.test and qa2@example.test, separate accounts for ownership checks, a soft-deleted account, active/closed/deleted budgets, a budget item and a manually assigned transaction. The random test password and JWT signing secret are stored locally in ../.finances-runs/qa-environment/credentials.json. Never paste them into chat, Git, screenshots or reports. They are synthetic credentials, not the MongoDB password. Windows file ACLs are inherited; no separate OS identity is claimed.

Sanitized seed-report.json and readiness.json live in the same ignored folder. Readiness exercises actual synthetic login and a database-dependent accounts request, verifies cross-user denial and excludes the deleted account. Browser smoke additionally records browser readiness and a report path; see [installation and evidence workflow](browser/README.md). No ticket QA PASS or isolated-environment manifest is fabricated. A prior readiness report is historical, not proof a server is currently running.

Remaining work: create a database user scoped to this database before autonomous roles receive access; validate autonomous network/browser tool credentials; add ticket-specific matching, duplicate-mail and financial edge-case fixtures. No real Google/Gmail service credentials are passed. Existing unit suites still cover matching/import logic; this smoke test does not establish Gmail integration or complete behavioral QA.

The source connection is explicitly operator-approved, not automatically classified as non-production. Pin records a credential-free hash of the approved host list and refuses to overwrite a different pin. Every later connection checks it; changing .env to another instance stops before connecting. Never delete the pin to bypass a mismatch; reconfirm with Julio. Authentication database selection is preserved while changing the application database; see the MongoDB driver connection documentation.
