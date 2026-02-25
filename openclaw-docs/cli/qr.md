> ## Documentation Index
> Fetch the complete documentation index at: https://docs.openclaw.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# qr

# `openclaw qr`

Generate an iOS pairing QR and setup code from your current Gateway configuration.

## Usage

```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
openclaw qr
openclaw qr --setup-code-only
openclaw qr --json
openclaw qr --remote
openclaw qr --url wss://gateway.example/ws --token '<token>'
```

## Options

* `--remote`: use `gateway.remote.url` plus remote token/password from config
* `--url <url>`: override gateway URL used in payload
* `--public-url <url>`: override public URL used in payload
* `--token <token>`: override gateway token for payload
* `--password <password>`: override gateway password for payload
* `--setup-code-only`: print only setup code
* `--no-ascii`: skip ASCII QR rendering
* `--json`: emit JSON (`setupCode`, `gatewayUrl`, `auth`, `urlSource`)

## Notes

* `--token` and `--password` are mutually exclusive.
* After scanning, approve device pairing with:
  * `openclaw devices list`
  * `openclaw devices approve <requestId>`
