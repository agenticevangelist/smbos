> ## Documentation Index
> Fetch the complete documentation index at: https://docs.openclaw.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Getting Started

# Getting Started

Goal: go from zero to a first working chat with minimal setup.

<Info>
  Fastest chat: open the Control UI (no channel setup needed). Run `openclaw dashboard`
  and chat in the browser, or open `http://127.0.0.1:18789/` on the
  <Tooltip headline="Gateway host" tip="The machine running the OpenClaw gateway service.">gateway host</Tooltip>.
  Docs: [Dashboard](/web/dashboard) and [Control UI](/web/control-ui).
</Info>

## Prereqs

* Node 22 or newer

<Tip>
  Check your Node version with `node --version` if you are unsure.
</Tip>

## Quick setup (CLI)

<Steps>
  <Step title="Install OpenClaw (recommended)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```

        <img src="https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=461cd845ecef4a1e5bda13a958ab6eac" alt="Install Script Process" className="rounded-lg" data-og-width="1370" width="1370" data-og-height="581" height="581" data-path="assets/install-script.svg" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=280&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=40f20deebd7237ed17915975e169a217 280w, https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=560&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=a14d093f47ac3816aab1900c21746ce1 560w, https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=840&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=56bb0eedf98f62d51ffb1e060c9881bc 840w, https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=1100&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=5af13f209e53c92d0af8cf94b92787ea 1100w, https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=1650&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=99f516125bf4b5076191994b606522e6 1650w, https://mintcdn.com/clawdhub/A8OxQpxR3DcyCCHY/assets/install-script.svg?w=2500&fit=max&auto=format&n=A8OxQpxR3DcyCCHY&q=85&s=6fb2be77662e1cd057924298b8e912f6 2500w" />
      </Tab>

      <Tab title="Windows (PowerShell)">
        ```powershell  theme={"theme":{"light":"min-light","dark":"min-dark"}}
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
      Other install methods and requirements: [Install](/install).
    </Note>
  </Step>

  <Step title="Run the onboarding wizard">
    ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
    openclaw onboard --install-daemon
    ```

    The wizard configures auth, gateway settings, and optional channels.
    See [Onboarding Wizard](/start/wizard) for details.
  </Step>

  <Step title="Check the Gateway">
    If you installed the service, it should already be running:

    ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
    openclaw gateway status
    ```
  </Step>

  <Step title="Open the Control UI">
    ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
  If the Control UI loads, your Gateway is ready for use.
</Check>

## Optional checks and extras

<AccordionGroup>
  <Accordion title="Run the Gateway in the foreground">
    Useful for quick tests or troubleshooting.

    ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
    openclaw gateway --port 18789
    ```
  </Accordion>

  <Accordion title="Send a test message">
    Requires a configured channel.

    ```bash  theme={"theme":{"light":"min-light","dark":"min-dark"}}
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```
  </Accordion>
</AccordionGroup>

## Useful environment variables

If you run OpenClaw as a service account or want custom config/state locations:

* `OPENCLAW_HOME` sets the home directory used for internal path resolution.
* `OPENCLAW_STATE_DIR` overrides the state directory.
* `OPENCLAW_CONFIG_PATH` overrides the config file path.

Full environment variable reference: [Environment vars](/help/environment).

## Go deeper

<Columns>
  <Card title="Onboarding Wizard (details)" href="/start/wizard">
    Full CLI wizard reference and advanced options.
  </Card>

  <Card title="macOS app onboarding" href="/start/onboarding">
    First run flow for the macOS app.
  </Card>
</Columns>

## What you will have

* A running Gateway
* Auth configured
* Control UI access or a connected channel

## Next steps

* DM safety and approvals: [Pairing](/channels/pairing)
* Connect more channels: [Channels](/channels)
* Advanced workflows and from source: [Setup](/start/setup)
