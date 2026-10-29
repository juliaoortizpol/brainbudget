# qa-evidence

For operator-supervised local browser evidence, see
[browser tools](../environment/browser/README.md). Transfer sanitized evidence
into the assigned QA scratch and verify commit identities and image hashes before
use. The fixed smoke does not provision interactive tools in a restricted session.

1. Require an independent Reviewer PASS and current pinned commits. Confirm an isolated MongoDB, guarded synthetic seed/reset, matching application builds and service readiness. A /health response is process liveness, not proof of database/integration readiness.
2. Provision browser/API tools in the QA environment; the restricted default CLI does not automatically inherit the desktop chat browser or connectors. If missing, report BLOCKED with owner and next action.
3. Test every acceptance id; exercise relevant successful, empty, loading, validation, error and responsive states. Distinguish mocked data from real frontend/backend requests. Preserve field/operator/source and keyword/value semantics.
4. Capture successful changed screens and reproducible defects. Store images under run scratch, with state/viewport and caption; report real relative paths. Keep JWTs, passwords and real financial/mail data out of captures. API-only changes explain screenshot non-applicability and link API evidence.
5. Record environment, commits, expected/actual, reproduction, limitations and severity. PASS=no defects; PASS WITH FOLLOW-UPS=only minor; FAIL=blocking; BLOCKED=incomplete. The controller verifies minor follow-up/backlinks before advancing to Your Approval. A new code/requirements revision invalidates affected evidence (this minimal harness conservatively invalidates all).
