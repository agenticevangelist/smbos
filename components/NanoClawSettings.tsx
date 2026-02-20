'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TextInput,
  Button,
  InlineNotification,
  InlineLoading,
  RadioButtonGroup,
  RadioButton,
  FormGroup,
  Toggle,
  Tag,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@carbon/react';
import { Save, Renew } from '@carbon/icons-react';

interface ConfigData {
  config: Record<string, string>;
  authMethod: 'oauth' | 'api_key' | 'none';
}

interface NanoClawState {
  dbExists: boolean;
  sessions: number;
  groups: Array<{ jid: string; name: string; folder: string; trigger_pattern: string; added_at: string }>;
  taskStats: { total: number; active: number; paused: number; completed: number };
}

export function NanoClawSettings() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [authMethod, setAuthMethod] = useState<'oauth' | 'api_key' | 'none'>('none');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'offline'>('checking');
  const [internalState, setInternalState] = useState<NanoClawState | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/nanoclaw/state');
      if (res.ok) setInternalState(await res.json());
    } catch { /* silently handle */ }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/nanoclaw/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data: ConfigData = await res.json();
      setConfig(data.config);
      setAuthMethod(data.authMethod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    const port = config.HTTP_PORT || '3100';
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      setHealthStatus(res.ok ? 'ok' : 'offline');
    } catch {
      setHealthStatus('offline');
    }
  }, [config.HTTP_PORT]);

  useEffect(() => {
    fetchConfig();
    fetchState();
  }, [fetchConfig, fetchState]);

  useEffect(() => {
    if (!loading) checkHealth();
  }, [loading, checkHealth]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/nanoclaw/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Reload to get fresh masked values
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBooleanField = (key: string, value: boolean) => {
    setConfig(prev => ({ ...prev, [key]: value ? 'true' : 'false' }));
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading settings..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '640px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1>NanoClaw Settings</h1>
          <Tag
            type={healthStatus === 'ok' ? 'green' : healthStatus === 'checking' ? 'cool-gray' : 'red'}
            size="sm"
          >
            {healthStatus === 'ok' ? 'Online' : healthStatus === 'checking' ? 'Checking...' : 'Offline'}
          </Tag>
        </div>
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          Configure NanoClaw authentication and core settings. Changes are written to <code>nanoclaw/.env</code>.
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
          subtitle="Configuration updated successfully"
          lowContrast
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Tabs>
        <TabList aria-label="NanoClaw settings tabs">
          <Tab>Configuration</Tab>
          <Tab>Internal State</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <FormGroup legendText="Authentication">
                <RadioButtonGroup
                  legendText="Auth method"
                  name="auth-method"
                  valueSelected={authMethod}
                  onChange={(value) => {
                    const method = String(value) as 'oauth' | 'api_key';
                    setAuthMethod(method);
                    if (method === 'oauth') {
                      updateField('ANTHROPIC_API_KEY', '');
                    } else {
                      updateField('CLAUDE_CODE_OAUTH_TOKEN', '');
                    }
                  }}
                >
                  <RadioButton
                    labelText="OAuth Token (claude.ai)"
                    value="oauth"
                    id="auth-oauth"
                  />
                  <RadioButton
                    labelText="API Key (console.anthropic.com)"
                    value="api_key"
                    id="auth-apikey"
                  />
                </RadioButtonGroup>

                <div style={{ marginTop: '1rem' }}>
                  {authMethod === 'oauth' ? (
                    <TextInput
                      id="oauth-token"
                      labelText="CLAUDE_CODE_OAUTH_TOKEN"
                      type="password"
                      value={config.CLAUDE_CODE_OAUTH_TOKEN || ''}
                      onChange={(e) => updateField('CLAUDE_CODE_OAUTH_TOKEN', e.target.value)}
                      helperText="OAuth token from claude.ai for Claude Code"
                    />
                  ) : (
                    <TextInput
                      id="api-key"
                      labelText="ANTHROPIC_API_KEY"
                      type="password"
                      value={config.ANTHROPIC_API_KEY || ''}
                      onChange={(e) => updateField('ANTHROPIC_API_KEY', e.target.value)}
                      helperText="API key from console.anthropic.com"
                    />
                  )}
                </div>
              </FormGroup>

              <FormGroup legendText="General" style={{ marginTop: '1.5rem' }}>
                <TextInput
                  id="assistant-name"
                  labelText="Assistant Name"
                  value={config.ASSISTANT_NAME || ''}
                  onChange={(e) => updateField('ASSISTANT_NAME', e.target.value)}
                  placeholder="Andy"
                  helperText="Assistant identity used across channels"
                />
                <div style={{ marginTop: '1rem' }}>
                  <Toggle
                    id="assistant-own-number"
                    labelText="Assistant has own phone number"
                    toggled={config.ASSISTANT_HAS_OWN_NUMBER === 'true'}
                    onToggle={(value) => updateBooleanField('ASSISTANT_HAS_OWN_NUMBER', value)}
                    labelA="No"
                    labelB="Yes"
                  />
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <TextInput
                    id="http-port"
                    labelText="HTTP Port"
                    value={config.HTTP_PORT || ''}
                    onChange={(e) => updateField('HTTP_PORT', e.target.value)}
                    placeholder="3100"
                    helperText="Port for NanoClaw HTTP API"
                  />
                </div>
              </FormGroup>

              <FormGroup legendText="Channels" style={{ marginTop: '1.5rem' }}>
                <TextInput
                  id="telegram-bot-token"
                  labelText="TELEGRAM_BOT_TOKEN"
                  type="password"
                  value={config.TELEGRAM_BOT_TOKEN || ''}
                  onChange={(e) => updateField('TELEGRAM_BOT_TOKEN', e.target.value)}
                  helperText="Optional. Enables NanoClaw built-in Telegram channel."
                />
                <div style={{ marginTop: '1rem' }}>
                  <Toggle
                    id="telegram-only"
                    labelText="Telegram-only mode"
                    toggled={config.TELEGRAM_ONLY === 'true'}
                    onToggle={(value) => updateBooleanField('TELEGRAM_ONLY', value)}
                    labelA="Disabled"
                    labelB="Enabled"
                  />
                </div>
              </FormGroup>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
                <Button
                  renderIcon={saving ? undefined : Save}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  kind="ghost"
                  renderIcon={Renew}
                  onClick={() => {
                    checkHealth();
                    fetchConfig();
                  }}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </TabPanel>
          <TabPanel>
            <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!internalState || !internalState.dbExists ? (
                <p style={{ color: 'var(--cds-text-secondary)' }}>
                  NanoClaw database not found. Start an agent to initialize.
                </p>
              ) : (
                <>
                  <div>
                    <h4 style={{ marginBottom: '0.5rem' }}>Sessions</h4>
                    <Tag type="blue">{internalState.sessions} active session{internalState.sessions !== 1 ? 's' : ''}</Tag>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: '0.5rem' }}>Task Statistics</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Tag type="cool-gray">{internalState.taskStats.total} total</Tag>
                      <Tag type="green">{internalState.taskStats.active} active</Tag>
                      <Tag type="cool-gray">{internalState.taskStats.paused} paused</Tag>
                      <Tag type="blue">{internalState.taskStats.completed} completed</Tag>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: '0.5rem' }}>Registered Groups ({internalState.groups.length})</h4>
                    {internalState.groups.length === 0 ? (
                      <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>No groups registered.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {internalState.groups.map((g) => (
                          <div key={g.jid} style={{
                            padding: '0.75rem',
                            background: 'var(--cds-layer-01)',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}>
                            <div style={{ fontWeight: 600 }}>{g.name}</div>
                            <div style={{ color: 'var(--cds-text-secondary)', marginTop: '0.25rem' }}>
                              Folder: {g.folder} | Trigger: {g.trigger_pattern}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    kind="ghost"
                    renderIcon={Renew}
                    onClick={fetchState}
                    size="sm"
                  >
                    Refresh State
                  </Button>
                </>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
}
