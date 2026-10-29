# Native isolated workspaces

Validated 2026-10-29 on this Windows machine, Codex CLI 0.165.0-alpha.1.2. The MXC compatibility check returned MXC_OK. No machine accounts, global Codex settings, firewall rules, application credentials or production data were changed.

| Location | Developer | Reviewer / QA | Orchestrator |
| --- | --- | --- | --- |
| Assigned implementation checkout | Read/write, .git read-only | Not supplied | Not supplied |
| Pinned source/baseline snapshots | Not needed | Read-only | Not supplied |
| Current role scratch, including TEMP/cache | Read/write | Read/write | Read/write |
| Current role artifacts and trusted procedures | Read-only | Read-only | Read-only |
| Python/Node/Git installations and Codex minimal runtime paths | Read-only | Read-only | Read-only |
| Controller state, approvals, other runs and unrelated files | Denied | Denied | Denied |
| Assigned top-level .env / .env.local / .env.production / .env.development / .env.test | Denied | Denied | Denied |

The profile starts from root deny and explicit grants; it does not inherit the broad-read workspace preset. MXC is required, with no weaker fallback. Legacy --sandbox or sandbox_mode must not be added: they override profiles. isolation.py generates the exact file rules. Shared policy and result/schema files are outside writable scratch; raw result output is written by the trusted CLI host.

Developer cannot mutate Git metadata. After edits it reports BLOCKED when an operator needs to checkpoint commits. The operator reviews the diff, commits in the assigned checkout, resolves the blocker and uses pin; a fresh Developer run validates committed work before READY. Publication remains a trusted host action. Child roles receive no publication token.

## Reproduce without calling a model

From the backend checkout with Python 3.12+:

```powershell
python orchestration/isolation.py --config ../.finances-host.local.json
python orchestration/check_cli.py --config ../.finances-host.local.json
python orchestration/finances.py --config ../.finances-host.local.json doctor
```

On this machine Python is not on PATH; its executable is `C:\Users\Julio\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`. In PowerShell invoke it with `&` and a quoted path.

The probe creates an owned temporary subtree under state_root/setup-validation, tests synthetic canaries, removes its controlled junction before cleanup and writes workspace-isolation.json. It verifies source permissions per role, scratch writes, .git write denial, .env denial, controller/unrelated read/write denial, shared-policy read-only access, child restrictions, junction traversal denial and Python/Node/Git startup. No real secret is read and no feature ticket/model turn starts.

A passing receipt lasts 24 hours and is bound to this host, CLI path/version, tool roots and policy/launcher files. Live launch requires it in addition to the existing security attestations. Re-run after updates or moving runtimes. Trusted operator tampering is outside this threat model; role command paths cannot access the receipt. CI regression tests mock native execution and do not certify MXC on another machine.

## Remaining boundaries

This closes the tested local-command filesystem gap. It does not provision an OS user/VM, remove saved credentials, audit keyrings/IPC, inventory managed plugins/MCP/browser tools, verify network denial or sandbox the trusted controller. Those remain part of the broader live-execution assessment. Dependency lifecycle scripts executed by trusted verification need the separately validated isolated test host.

Do not put private data in allowed paths. Exact .env rules are additional guards, not detection of arbitrary secrets or newly named/nested files. Never broaden tool roots to a home directory or drive to fix a missing tool. OS ACLs may deny otherwise allowed operations. MXC stops remaining children when a foreground command exits; server lifecycle is part of later QA environment work.

Both live security flags remain false. The filesystem receipt does not authorize a feature ticket or establish all roles as operational.

References: [native permissions](https://learn.chatgpt.com/docs/permissions), [Windows MXC](https://learn.chatgpt.com/docs/windows/windows-sandbox).
