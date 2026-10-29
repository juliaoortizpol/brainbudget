# review-change

1. Start a fresh Reviewer session through `launch --role reviewer`; source snapshots and exact CI/implementation artifacts are supplied without the Developer chat.
2. Independently inspect requirements, PR diff/base and surrounding contracts. Examine negative authorization, ownership, soft deletes, import duplicates, manual matching, money/date semantics, algorithm assumptions, compatibility and maintainability.
3. Probe meaningful failure cases in writable scratch if needed. Keep the canonical snapshot untouched; dependency/test output belongs in scratch or the runner's verification copy.
4. Findings need id, severity, file/line, impact, reproduction/evidence. Test assertions must distinguish correct behavior from plausible wrong implementations.
5. Return PASS or CHANGES REQUESTED against exact commits; report BLOCKED where inspection cannot finish. The controller rejects stale/session-reused reports and returns blocking findings to Development. No silent fixes.
