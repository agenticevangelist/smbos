> ## Documentation Index
> Fetch the complete documentation index at: https://docs.openclaw.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# daemon

# `openclaw daemon`

Legacy alias for Gateway service management commands.

`openclaw daemon ...` maps to the same service control surface as `openclaw gateway ...` service commands.

## Usage

```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
openclaw daemon status
openclaw daemon install
openclaw daemon start
openclaw daemon stop
openclaw daemon restart
openclaw daemon uninstall
```

## Subcommands

* `status`: show service install state and probe Gateway health
* `install`: install service (`launchd`/`systemd`/`schtasks`)
* `uninstall`: remove service
* `start`: start service
* `stop`: stop service
* `restart`: restart service

## Common options

* `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
* `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
* lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`openclaw gateway`](/cli/gateway) for current docs and examples.
