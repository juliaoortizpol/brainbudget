# Finances workflow — authoritative shared policy

Julio is Product Owner and Technical Lead: he writes/prioritizes tickets, approves scope, resolves important product/architecture and uncertain-severity decisions, and gives final approval. This file owns workflow rules for both repositories. Repository AGENTS.md files own technical boundaries; procedures explain operations without replacing this policy.

Backlog → Ready → In Development → Code Review → QA Testing → Your Approval → Done.

Start Here holds board rules, ticket template and QA guide; it is not a ticket stage.

| Stage | Entry requirement |
| --- | --- |
| Backlog | Ticket is being defined; no development permission implied. |
| Ready | Julio explicitly approved the current requirements hash; acceptance criteria are testable. |
| In Development | One active ticket; explicit AI-owned, Pair programming or Human-owned mode. |
| Code Review | Developer handoff, clean pinned commits, deterministic checks and live exact-head CI pass; linked PRs exist. |
| QA Testing | Independent Reviewer PASS for current commits; minor findings have verified linked Backlog cards. |
| Your Approval | QA PASS or PASS WITH FOLLOW-UPS, complete criterion evidence, required screenshots and linked minor defects. |
| Done | Julio approved these requirements/commits and every relevant PR was actually merged. Deployment is recorded separately. |

Developer, Reviewer, QA and Orchestrator are separate fresh sessions. Do not pass full Developer conversations to Reviewer/QA. Initial context contains role instructions, ticket/criteria, relevant shared instructions and necessary source/contracts/structured artifacts. Context separation is not a permission boundary; see PERMISSIONS.md.

Only the deterministic controller/trusted broker owns Trello moves and defect creation. Role sessions return reports; they cannot override verdicts or move cards. The controller serializes mutations with a lock, allows one active ticket, uses stable operation/defect keys, persists progress before launches/writes, and caps attempts. A crash never silently launches a replacement session. Search/reconcile remote effects before retrying.

Blocking review or QA findings return the original card to In Development with reproduction/evidence. Blocking means broken primary flows, incorrect financial results, data loss, security/privacy failures, unusable required UI, or material departure from approved requirements. Minor means low-impact issues without material correctness, security, accessibility or usability impact. Uncertain severity is Julio's decision; it cannot advance automatically.

Minor defects must have separate Backlog cards, duplicate search and links in both directions. PASS means no defects; PASS WITH FOLLOW-UPS means only minor defects and verified follow-up links. QA FAIL means blocking defects; BLOCKED means incomplete verification and stays in its current list with reason, resolver and next action. A required failed CI check is never waived by a minor QA finding.

Reports identify requirements hash/version, exact relevant frontend/backend commits, actual role session, environment, acceptance results, expected/actual behavior, reproduction, findings, limitations and evidence. UI QA includes captioned successful changed screens and relevant normal, empty, loading, validation, error and responsive states. API-only work explains screenshot non-applicability and supplies API evidence. Mark real integration versus mocks explicitly.

Use synthetic accounts, transactions and mail only. Never expose credentials, JWTs, real mail or private financial data in logs/screenshots. No role may merge, deploy, administer repositories or access production. Do not weaken checks/delete tests for green CI. The minimal controller conservatively invalidates all verification, review, QA, environment and final approval when commits or requirements change. Old reports remain historical evidence, not a current verdict.

Human approval files are operator-owned attestations tied to hashes/commits, not authenticated identity signatures. Never fill one in on Julio's behalf. Local gate enforcement cannot replace master branch protection, service credentials/permissions, or independent behavioral judgment.
