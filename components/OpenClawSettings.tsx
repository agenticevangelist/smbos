'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TextInput,
  Button,
  InlineNotification,
  InlineLoading,
  FormGroup,
  Toggle,
  Tag,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Select,
  SelectItem,
  NumberInput,
} from '@carbon/react';
import { Save, Renew } from '@carbon/icons-react';

interface GatewayStatus {
  status: string;
  running: boolean;
  port: number;
  uptime?: number;
  version?: string;
  agents?: Array<{ id: string; name?: string; model?: string }>;
  sessions?: number;
  channels?: Record<string, { connected: boolean }>;
  cron?: { enabled: boolean; activeJobs: number };
}

export function OpenClawSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  // Editable fields
  const [gatewayPort, setGatewayPort] = useState(18789);
  const [authToken, setAuthToken] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [cronEnabled, setCronEnabled] = useState(true);
  const [cronMaxConcurrent, setCronMaxConcurrent] = useState(3);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-6');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/status');
      if (res.ok) setGatewayStatus(await res.json());
    } catch { /* silently handle */ }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/config');
      if (!res.ok) {
        if (res.status === 503) {
          setLoading(false);
          return;
        }
        throw new Error('Failed to load config');
      }
      const data = await res.json();
      const cfg = data.config || {};
      setConfig(cfg);

      // Populate fields from config
      const gw = cfg.gateway as Record<string, unknown> | undefined;
      if (gw?.port) setGatewayPort(Number(gw.port));
      if (gw?.auth && typeof gw.auth === 'object') {
        const auth = gw.auth as Record<string, unknown>;
        if (auth.token) setAuthToken(String(auth.token));
      }

      const ui = cfg.ui as Record<string, unknown> | undefined;
      if (ui?.assistantName) setAssistantName(String(ui.assistantName));

      const cron = cfg.cron as Record<string, unknown> | undefined;
      if (cron) {
        if (typeof cron.enabled === 'boolean') setCronEnabled(cron.enabled);
        if (cron.maxConcurrentRuns) setCronMaxConcurrent(Number(cron.maxConcurrentRuns));
      }

      const channels = cfg.channels as Record<string, unknown> | undefined;
      if (channels?.telegram && typeof channels.telegram === 'object') {
        const tg = channels.telegram as Record<string, unknown>;
        if (tg.botToken) setTelegramBotToken(String(tg.botToken));
      }

      const agents = cfg.agents as Record<string, unknown> | undefined;
      if (agents?.defaults && typeof agents.defaults === 'object') {
        const defaults = agents.defaults as Record<string, unknown>;
        if (defaults.model) setDefaultModel(String(defaults.model));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
  }, [fetchStatus, fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const patch: Record<string, unknown> = {
        gateway: {
          port: gatewayPort,
          auth: authToken ? { mode: 'token', token: authToken } : undefined,
        },
        ui: {
          assistantName: assistantName || undefined,
        },
        cron: {
          enabled: cronEnabled,
          maxConcurrentRuns: cronMaxConcurrent,
        },
        agents: {
          defaults: {
            model: defaultModel,
          },
        },
      };

      // Only include telegram if token is set
      if (telegramBotToken && !telegramBotToken.includes('****')) {
        patch.channels = {
          telegram: { botToken: telegramBotToken },
        };
      }

      const res = await fetch('/api/openclaw/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchConfig();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading settings..." />
      </div>
    );
  }

  const isOnline = gatewayStatus?.status === 'online' || gatewayStatus?.running;

  return (
    <div style={{ padding: '2rem', maxWidth: '640px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1>OpenClaw Settings</h1>
          <Tag
            type={isOnline ? 'green' : 'red'}
            size="sm"
          >
            {isOnline ? 'Online' : 'Offline'}
          </Tag>
          {gatewayStatus?.version && (
            <Tag type="cool-gray" size="sm">v{gatewayStatus.version}</Tag>
          )}
        </div>
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          Configure OpenClaw gateway, models, channels, and scheduling. Changes are applied via hot-reload.
        </p>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onClose={() => setError(null)}
          lowContrast
          style={{ marginBottom: '1rem' }}
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Saved"
          subtitle="Configuration updated and applied"
          lowContrast
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Tabs>
        <TabList aria-label="OpenClaw settings tabs">
          <Tab>Gateway</Tab>
          <Tab>Models</Tab>
          <Tab>Channels</Tab>
          <Tab>Automation</Tab>
          <Tab>Status</Tab>
        </TabList>
        <TabPanels>
          {/* Gateway */}
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <FormGroup legendText="Gateway">
                <NumberInput
                  id="gateway-port"
                  label="Port"
                  value={gatewayPort}
                  onChange={(_e: unknown, { value }: { value: string | number }) => setGatewayPort(Number(value))}
                  min={1024}
                  max={65535}
                  helperText="OpenClaw gateway port (default: 18789)"
                />
                <div style={{ marginTop: '1rem' }}>
                  <TextInput
                    id="auth-token"
                    labelText="Auth Token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    helperText="Token for authenticating with the gateway"
                  />
                </div>
              </FormGroup>

              <FormGroup legendText="Identity" style={{ marginTop: '1.5rem' }}>
                <TextInput
                  id="assistant-name"
                  labelText="Assistant Name"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  placeholder="Andy"
                  helperText="Display name used across all channels"
                />
              </FormGroup>
            </div>
          </TabPanel>

          {/* Models */}
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <FormGroup legendText="Default Model">
                <Select
                  id="default-model"
                  labelText="Default model for new agents"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                >
                  <SelectItem value="claude-sonnet-4-6" text="Claude Sonnet 4.6" />
                  <SelectItem value="claude-opus-4-6" text="Claude Opus 4.6" />
                  <SelectItem value="claude-haiku-4-5" text="Claude Haiku 4.5" />
                  <SelectItem value="gpt-4o" text="GPT-4o" />
                  <SelectItem value="gpt-4o-mini" text="GPT-4o Mini" />
                  <SelectItem value="gemini-2.5-pro" text="Gemini 2.5 Pro" />
                  <SelectItem value="gemini-2.5-flash" text="Gemini 2.5 Flash" />
                  <SelectItem value="deepseek-chat" text="DeepSeek Chat" />
                  <SelectItem value="llama-3.3-70b" text="Llama 3.3 70B" />
                </Select>
              </FormGroup>

              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                  Per-agent model selection is configured in each agent&apos;s <code>agent.md</code> frontmatter.
                  API keys for non-Anthropic models are configured in <code>openclaw.json</code> under <code>auth.profiles</code>.
                </p>
              </div>
            </div>
          </TabPanel>

          {/* Channels */}
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <FormGroup legendText="Telegram">
                <TextInput
                  id="telegram-bot-token"
                  labelText="Bot Token"
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  helperText="Telegram bot token for messaging channel"
                />
              </FormGroup>

              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                  OpenClaw supports 12+ channels: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Google Chat, Microsoft Teams, Matrix, and more.
                  Configure additional channels in <code>openclaw.json</code> under <code>channels</code>.
                </p>
              </div>

              {gatewayStatus?.channels && Object.keys(gatewayStatus.channels).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Connected Channels</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {Object.entries(gatewayStatus.channels).map(([name, info]) => (
                      <Tag key={name} type={info.connected ? 'green' : 'red'} size="sm">
                        {name}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabPanel>

          {/* Automation */}
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <FormGroup legendText="Cron Scheduler">
                <Toggle
                  id="cron-enabled"
                  labelText="Enable scheduled tasks"
                  toggled={cronEnabled}
                  onToggle={(value) => setCronEnabled(value)}
                  labelA="Disabled"
                  labelB="Enabled"
                />
                <div style={{ marginTop: '1rem' }}>
                  <NumberInput
                    id="cron-max-concurrent"
                    label="Max concurrent jobs"
                    value={cronMaxConcurrent}
                    onChange={(_e: unknown, { value }: { value: string | number }) => setCronMaxConcurrent(Number(value))}
                    min={1}
                    max={10}
                    helperText="Maximum number of cron jobs running simultaneously"
                  />
                </div>
              </FormGroup>

              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                  Cron jobs can be created via the Scheduled Tasks page or by agents using the <code>cron</code> tool.
                  Supports one-shot (at), interval (every), and cron expression schedules.
                </p>
              </div>
            </div>
          </TabPanel>

          {/* Status */}
          <TabPanel>
            <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!isOnline ? (
                <p style={{ color: 'var(--cds-text-secondary)' }}>
                  OpenClaw gateway is not running. Start it with <code>openclaw gateway run</code>.
                </p>
              ) : (
                <>
                  {gatewayStatus?.uptime !== undefined && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Uptime</h4>
                      <Tag type="blue">{formatUptime(gatewayStatus.uptime)}</Tag>
                    </div>
                  )}

                  {gatewayStatus?.sessions !== undefined && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Sessions</h4>
                      <Tag type="blue">{gatewayStatus.sessions} active</Tag>
                    </div>
                  )}

                  {gatewayStatus?.agents && gatewayStatus.agents.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Registered Agents ({gatewayStatus.agents.length})</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {gatewayStatus.agents.map((a) => (
                          <div key={a.id} style={{
                            padding: '0.75rem',
                            background: 'var(--cds-layer-01)',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}>
                            <div style={{ fontWeight: 600 }}>{a.name || a.id}</div>
                            <div style={{ color: 'var(--cds-text-secondary)', marginTop: '0.25rem' }}>
                              Model: {a.model || 'default'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gatewayStatus?.cron && (
                    <div>
                      <h4 style={{ marginBottom: '0.5rem' }}>Cron</h4>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Tag type={gatewayStatus.cron.enabled ? 'green' : 'red'} size="sm">
                          {gatewayStatus.cron.enabled ? 'Enabled' : 'Disabled'}
                        </Tag>
                        <Tag type="blue" size="sm">
                          {gatewayStatus.cron.activeJobs} active jobs
                        </Tag>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button
                kind="ghost"
                renderIcon={Renew}
                onClick={() => { fetchStatus(); fetchConfig(); }}
                size="sm"
              >
                Refresh
              </Button>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
        <Button
          renderIcon={saving ? undefined : Save}
          onClick={handleSave}
          disabled={saving || !isOnline}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
        <Button
          kind="ghost"
          renderIcon={Renew}
          onClick={() => { fetchStatus(); fetchConfig(); }}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
