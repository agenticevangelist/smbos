> ## Documentation Index
> Fetch the complete documentation index at: https://docs.openclaw.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# cron

# `openclaw cron`

Manage cron jobs for the Gateway scheduler.

Related:

* Cron jobs: [Cron jobs](/automation/cron-jobs)

Tip: run `openclaw cron --help` for the full command surface.

Note: isolated `cron add` jobs default to `--announce` delivery. Use `--no-deliver` to keep
output internal. `--deliver` remains as a deprecated alias for `--announce`.

Note: one-shot (`--at`) jobs delete after success by default. Use `--keep-after-run` to keep them.

Note: recurring jobs now use exponential retry backoff after consecutive errors (30s → 1m → 5m → 15m → 60m), then return to normal schedule after the next successful run.

## Common edits

Update delivery settings without changing the message:

```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Disable delivery for an isolated job:

```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
openclaw cron edit <job-id> --no-deliver
```

Announce to a specific channel:

```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
