# verify-change

1. Read the ticket, affected repository instructions, product/architecture/testing docs and contracts. Record both commits for cross-repository work.
2. Use only assigned isolated checkouts. Commit source; run `finances.py ... pin`, then `verify`. The trusted runner installs locked dependencies and invokes lint, types, unit tests and production build with Node 24. Backend lint is non-mutating; `npm run lint` auto-fixes and is not proof of CI.
3. Preserve stdout locally only when it contains synthetic data. Report failed commands honestly. Do not waive CI or delete tests.
4. Publish linked PRs through the trusted host/GitHub broker, register URLs using `pr`, and fetch exact-head evidence with `ci`. The model's claimed check status does not satisfy the gate.
5. Provide criterion-by-criterion evidence, documentation changes, exact final commits, limitations and blockers in the structured result. Only Developer READY plus verified local checks and live CI permits Code Review.
