# Bounded Developer sessions

The [host coordinator bridge](HOST-COORDINATOR.md) now provides usage conversion,
schedule receipt recording and wakeup revalidation commands. Its chat automation
is configured paused; scheduling and telemetry calls are made by the trusted chat,
not directly by Python. Unattended operation has not passed commissioning.

Opt-in for an approved AI-owned ticket already In Development. No scheduler or
account telemetry API is installed by this change. Existing security gates still
apply. Each launch is one fresh session, never an automatic loop.

Write a JSON array of ordered units, each with `id`, `goal`, `repositories` (subset
of ticket repositories), and `verification`. Keep goals within approved ticket
scope; this plan does not grant new scope. Include integrated testing as a unit.
Install using `finances.py --config HOST --ticket-id ID dev-plan --file PLAN`.

Before each Developer launch, the trusted host supplies `--usage SNAPSHOT` and
`--estimate-percent N` along with `launch --role developer --execute`. Snapshot:

```json
{
  "observed_at": "2026-10-29T20:00:00+00:00",
  "windows": [
    {"remaining_percent": 70, "resets_at": 1793310000},
    {"remaining_percent": 80, "resets_at": 1793900000}
  ]
}
```

Example timestamps are not reusable. Obtain all applicable windows from the host
usage tool, not the agent's guess. Snapshot age must be at most five minutes and
reset times must be in the future. This is a trusted operator attestation, not a
signed measurement. N is a conservative upper allowance percentage estimate;
raw tokens are not equivalent. Unknown estimates require supervised calibration.
Remaining allowance must be greater than N + 15 in every supplied window.

Insufficient allowance records WAITING_FOR_USAGE, a suggested reset-plus-buffer
time, and `scheduled: false`. No process or attempt starts. The operator can create
a supported scheduled continuation; this controller does not yet broker that API.
Wakeup must fetch fresh usage and rerun all gates. No five-hour reset is assumed.

The first pending unit and prior structured checkpoints are passed to Developer.
It implements only that unit and returns BLOCKED with summary, actual checks,
remaining work and limitations. The controller records its actual CLI session,
HEADs and Git status, preserves dirty files, and ends the session. No ticket-level
Developer result is accepted. Review the report and diff, run required checks,
commit through the trusted operator, then run:

`finances.py --config HOST --ticket-id ID dev-complete --subtask UNIT --evidence "actual verification summary"`

Completion requires clean assigned branches. It pins commits and records the
operator's verification attestation. It does not independently rerun that evidence.
The next launch gets the next unit. Each unit has a three-launch cap independent
of commit changes. A failed/interrupted process never completes a unit; inspect its
PID, files and report before retry. Do not delete partial work to recover.

Once all units are done, launch Developer again with fresh usage for full-ticket
validation. Only its normal READY result plus deterministic checks, exact-head CI
and PR links can enter Code Review. Review and QA remain independent. Revisions
archive the old plan and require a fresh plan. Existing tickets without a plan
retain their prior whole-ticket behavior.

Current limitations: no mid-turn usage polling, automatic scheduling, automatic
commit, automatic cost estimator, subtask revision command or crash-proof in-turn
checkpoint guarantee. Agents must save files regularly. Context splitting reduces
each session's scope but does not reserve account allowance or guarantee completion.
