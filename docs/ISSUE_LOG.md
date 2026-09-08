# Issue Log

A running, terse knowledge base of bugs we've hit and how we fixed them. **Scan this before starting any fix** - the issue may already be solved here. **Add a new entry after every solved issue.** Keep entries to a few lines; newest first.

Format: `### YYYY-MM-DD - Title` - **Symptom** - **Cause** - **Fix** (files) - optional **Note**.

### 2026-09-08 - Scheduled hour-registration job fails under launchd
**Symptom** The daily `me.jurre.hour-registration` LaunchAgent failed instantly. First with `error: An unknown error occurred, possibly due to low max file descriptors / Current limit: 256`, then after fixing that with a bare `error: An unknown error occurred (Unexpected)`.
**Cause** Two stacked environment differences between a terminal shell and a launchd-spawned process: (1) launchd's soft `maxfiles` limit is 256, too low for Claude Code; (2) the portal repo lives under `~/Desktop`, which macOS TCC protects — a launchd process gets `Operation not permitted` reading files there, and Claude Code surfaces that as an unhelpful generic error. Directory listing still succeeds, which makes it look like access is fine.
**Fix** `ulimit -n 65536` in the script plus `SoftResourceLimits/NumberOfFiles` in the plist; moved the job's working dir out of `~/Desktop` to `~/.hour-registration/` with its own `env` holding `DATABASE_URL` (`~/.claude/skills/hour-registration-backfill/run-autonomous.sh`, `~/Library/LaunchAgents/me.jurre.hour-registration.plist`).
**Note** To diagnose a launchd-only failure, run the probe *through launchd* (`launchctl kickstart -k gui/$(id -u)/<label>`). Reproducing with `env -i` from a terminal does not trigger TCC, so it passes and hides the real cause.
