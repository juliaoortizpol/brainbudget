# Supervised interactive QA

The QA launcher now connects to http://localhost:15174/mcp rather than spawning
Chromium inside the restricted session. Only the explicitly listed navigation,
inspection, interaction and screenshot tools receive approval. Code execution,
uploads, network-log inspection and browser installation are not exposed to QA.
The native shell filesystem/network profile and ticket launch gates are unchanged.

Operator steps, using Node 24:

1. Install this folder's locked dependencies with `npm ci --prefix orchestration/environment/browser`.
2. Start `node orchestration/environment/run.cjs serve` in a trusted terminal.
3. Prepare the actual QA run's existing scratch directory under `.finances-runs`.
4. In another trusted terminal run `node orchestration/environment/browser/serve.cjs HEADLESS_CHROMIUM_EXE QA_SCRATCH`.
   Use the installed Playwright Chromium **headless shell** executable; this host's
   full chrome.exe failed with spawn UNKNOWN. Do not disable browser sandboxing.
5. Launch QA through the controller once its independent review/environment gates
   are satisfied. Missing MCP service fails startup. For setup validation, a bounded
   operator probe can exercise the same native profile without approving a ticket.
6. Stop both foreground services after QA. Check their PIDs/ports before recovering
   any stale lock. Never delete a live supervisor's lock.

The trusted init script authenticates qa1@example.test internally using only the
synthetic credentials, sets its browser session, and restricts browser requests to
the two test origins. WebSockets/service workers are blocked. No password is given
to the model. Use only synthetic apps/data; do not export storage state or traces.
Screenshots and snapshots are written to the supplied scratch directory.

The HTTP MCP endpoint is loopback-only but has no authentication. It is a trusted
single-operator development service, not a multi-user security boundary. The client
tool allowlist does not remove other tools from the server for other local clients.
Do not leave it running unattended or use it on a shared/untrusted host. Origin
routing is not an OS firewall. Database-scoped credentials and broader host audits
remain pending; isolation attestations must not be changed based on this test.

Validation on 2026-10-29: a fresh Codex QA session made actual MCP calls, verified
Synthetic Bank / masked 0000 / Active at desktop and mobile sizes, inspected the
disconnected Gmail panel, opened Add Account and cancelled without mutations.
Three screenshots were created. External HTTPS navigation returned ERR_FAILED;
file navigation was explicitly blocked. 35 controller regressions passed.
Observed issues: narrow mobile Connections description, an uninvestigated console
error, and one offscreen navigation control timeout. Save/delete/Gmail sync remain
untested. This is setup evidence, not an independent reviewed-ticket approval.

Configuration reference: https://learn.chatgpt.com/docs/extend/mcp
