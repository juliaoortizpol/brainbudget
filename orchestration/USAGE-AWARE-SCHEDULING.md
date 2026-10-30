# Proposed usage-aware admission and recovery

Status: broader scheduling design. The opt-in Developer admission/checkpoint subset
is implemented in DEVELOPER-SUBTASKS.md. Automatic telemetry and scheduling are
still pending. Existing approval, isolation and role-separation gates remain.

## Before a role or bounded subtask

The trusted controller obtains a fresh account usage snapshot, including every
applicable limit bucket, remaining percentage and reset timestamp. Unknown/stale
usage must not be treated as unlimited. The desktop usage tool is not automatically
available inside the Python controller: a supported host adapter is required.

Plan the next bounded unit and estimate its upper usage range from comparable
completed runs (same role/model and similar repository/context/task size). Record
the evidence count and uncertainty. Raw input/output/cached token counts are useful
diagnostics but are not interchangeable with account allowance percentages. Never
convert an unknown account capacity into a fabricated token balance. Concurrent
account activity can contaminate measured before/after deltas.

Proposed initial admission rule: remaining allowance must exceed the estimated
upper cost plus a 15 percentage-point reserve in every applicable bucket. Treat
this threshold as configurable and uncalibrated. If the estimate is unavailable,
use supervised calibration or defer; do not invent confidence. At 10% remaining,
do not begin a new role under this policy. Recheck immediately before dispatch,
since other chats can consume shared usage. Scheduling cannot reserve allowance.

## Checkpoint and defer

At safe boundaries persist requirements hash, repository/branch/HEAD identities,
dirty-file inventory, completed acceptance IDs, actual commands and outcomes,
remaining steps, current findings and artifact paths. A partial unit is not PASS.
Do not manufacture review or QA results or advance the Trello list. Record a
separate WAITING_FOR_USAGE execution state and the reason.

Persist a scheduling intent with a stable key before calling the supported desktop
scheduler. Pick the latest relevant reset among blocking buckets, plus a small
buffer. Weekly limits can dominate a five-hour reset. Save the returned automation
ID and reconcile existing schedules on retry to avoid duplicate wakeups. Only mark
the continuation scheduled after API confirmation. If scheduling fails, preserve
the checkpoint and report intervention needed; never claim a wakeup exists.

Do not hold the controller lock while waiting. Before releasing it, ensure there
is no active role process or unaccounted child. An interrupted role requires the
existing recovery inspection; a wakeup must not launch a duplicate automatically.

## Wakeup

Acquire the lock, reload durable state, check cancellation and live processes,
recheck usage and all normal stage/security gates, then validate current commits
and requirements. Stop on unexpected changes or unresolved decisions. If allowance
is still insufficient, defer with bounded retries/backoff and notify only on an
actionable change. Do not assume the reset happened simply because time elapsed.
Keep the one-active-ticket rule and stop at Julio's final approval gate.

## Developer subtasks and context

Split implementation into coherent units, such as backend contract, frontend
consumer, integration tests and documentation. Each unit has inputs, expected
outputs and verification. Dependencies remain explicit; splitting does not approve
extra scope or waive final integrated tests. Resume with a compact checkpoint and
targeted source context instead of copying an unlimited transcript. Reviewer and
QA still start independently and receive structured evidence, not Developer chats.

The current launcher waits on one role subprocess with a timeout; it cannot check
usage inside that running turn. Mid-role control requires bounded turns/subtask
handoffs and host telemetry polling. Even polling cannot guarantee a clean stop
before sudden account exhaustion. Persist checkpoints throughout work, not only
when nearing the limit. Context-window capacity and account usage allowance are
separate constraints.

## Implementation acceptance

- Admission rejects insufficient, stale or unknown usage and checks all buckets.
- Estimates record uncertainty; no exact token-to-allowance conversion is claimed.
- Crash recovery preserves uncommitted work and never marks partial evidence PASS.
- Scheduling intent/confirmation is durable and duplicate wakeups are reconciled.
- Wakeup rechecks usage, identities, processes and approvals before launching.
- Cancellation, missed wakeup, offline host, weekly exhaustion, scheduler failure,
  concurrent usage and three consecutive deferrals have explicit outcomes.
- A synthetic end-to-end pilot verifies defer, wakeup and resume without production
  access or changing the existing security attestations.
