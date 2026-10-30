# Host scheduling bridge — supervised commissioning

The scheduled chat owns the supported usage/scheduler tools; Python owns durable
ticket state and normal gates. No private API, CLI credential export or shell
scheduler is used. The configured heartbeat remains paused until the pilot and
service/isolation prerequisites pass. There is no approved active feature ticket.

On a coordinator wakeup:

1. Read host configuration and state; find at most one WAITING_FOR_USAGE ticket.
   Do nothing if none. Never create tickets, alter approvals or flip security flags.
2. Get fresh usage with the host get_usage_limits tool. Keep observation time from
   the actual tool call. Save only ordinaryUsageAllowed and rate-limit buckets to a
   uniquely named ignored state file, excluding account identity/credits. Run
   `finances.py --config HOST usage-export --input RAW --observed-at ISO --output SNAPSHOT`.
   Both windows are required. Unknown/expired readings stop; never fabricate them.
3. Use `--ticket-id ID usage-intent` to retrieve the stable scheduling key and
   resume time. Before creating anything, reconcile existing automations by their
   recorded ID or this key. An ambiguous prior creation requires inspection.
4. Before resume time, reschedule the existing heartbeat through the app tool;
   do not spin/poll. Use the relevant reset plus buffer, not a fixed five hours.
   Only after an ACTIVE response, write a receipt with intent_key, automation_id
   and status ACTIVE, then use `usage-confirm --receipt FILE`. A paused/failed
   creation is not a scheduled continuation. Receipts are trusted host attestations.
5. At/after resume time, use `usage-resume-plan --usage SNAPSHOT --estimate-percent N`.
   N must be a recorded conservative estimate, not an invented token conversion.
   Missing estimate needs calibration. The command checks identity, branch/clean
   state, blockers and current unit. Its result does not authorize execution.
6. If usage is ready, invoke the normal Developer launch with the same fresh
   snapshot/estimate. Existing host isolation, Trello, scope and process gates all
   remain. Awaiting-checkpoint means operator review/verification/commit is needed;
   no automatic commit has been implemented. Do not silently complete subtasks.
7. After a run, reread state. Stop at approval, blockers, unclear process recovery,
   or three consecutive unsuccessful deferrals. Record actionable reason and next
   step. Notify only on completion, failure or required action; remain quiet when
   unchanged. Do not repeatedly consume model turns to check a known future reset.

Supported CLI additions: usage-export, usage-intent, usage-confirm, usage-resume-plan.
They do not create schedules themselves. Account percentage estimates and automatic
checkpoint commits remain separate implementation work. Context and limit windows
are independent. A running role can still exhaust usage before its checkpoint.

Commissioning requires: synthetic lifecycle tests, manual execution of this prompt,
one confirmed scheduled wakeup pilot, scoped service credentials, working Trello
mapping, and validated role isolation. Do not enable unattended work on the strength
of unit tests alone. The computer must remain awake and the desktop app running.
