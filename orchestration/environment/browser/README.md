# Browser QA tools

For direct QA-agent browser access, use [the supervised MCP service](LIVE-QA.md).
The fixed smoke runner below remains useful for deterministic readiness checks;
its limitations about interactive tools apply to that runner, not the new service.

Run from the backend checkout using Node 24:

```powershell
npm ci --prefix orchestration/environment/browser
node orchestration/environment/browser/node_modules/playwright/cli.js install chromium
node --test orchestration/environment/browser/smoke.test.cjs
node orchestration/environment/run.cjs browser-smoke
```

The trusted supervisor owns server startup, synthetic authentication and cleanup.
It refuses occupied ports and uncommitted tracked application changes. Each run
creates a fresh, nonpersistent Chromium context, with no saved personal profile.
Browser requests are limited to the two loopback test origins; service workers,
WebSockets and downloads are disabled. This routing is defense in depth, not an
OS firewall or a hostile-code containment boundary. Do not run untrusted builds
on a host with production credentials. Browser installation uses Playwright's
normal per-user cache; the restricted CLI role has not been granted that cache.

Evidence is stored in the ignored parent `.finances-runs/qa-environment/browser-*`
directory. `report.json` contains frontend/backend commits, explicit real/mocked
labels, captions and SHA-256 hashes. Screens cover login, required-field validation,
real synthetic accounts at desktop/mobile sizes, and mocked empty/error/loading
responses. Password fields are masked. No traces, HAR, storage state, console
payloads, tokens or raw error call logs are recorded. A failed assertion yields
FAIL, a sanitized stage/error type and any already completed evidence. This is
tool readiness, not a claim that every financial behavior or visual layout passed.

The API readiness check verifies real login, account ownership and soft deletion.
The browser navigates the UI and logs in through the form. Mocked states only
prove rendering for injected responses; they do not prove database behavior.
Servers stop after either success or failure. `readiness.json` is historical;
it does not mean the servers are still running.

For a reviewed ticket, the trusted operator must run the relevant checks against
its exact commits, copy only its sanitized report/images to that QA run's scratch,
and let the independent QA session inspect the images and evaluate each criterion.
Check hashes after copying and record the new paths. Do not copy credentials.json
or set isolation attestations based on this smoke. Additional ticket behaviors
need additional reviewed scenarios. This fixed runner does not grant the model
an interactive browser; autonomous QA remains blocked until scoped credentials
and its network/browser tool boundary are provisioned and validated.

Implementation references: [browser installation](https://playwright.dev/docs/browsers)
and [isolated contexts and request routing](https://playwright.dev/docs/api/class-browsercontext).
