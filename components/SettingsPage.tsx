'use client';

import { useState, useEffect } from 'react';
import { TextInput, Button, InlineNotification, Toggle } from '@carbon/react';
import { Save, Connection, TrashCan } from '@carbon/icons-react';

const STORAGE_KEY = 'smbos_openclaw_settings';

export type OpenClawSettings = {
  gatewayUrl: string;
  gatewayToken: string;
  autoConnect: boolean;
};

const DEFAULTS: OpenClawSettings = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayToken: '',
  autoConnect: true,
};

export function getOpenClawSettings(): OpenClawSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveOpenClawSettings(settings: OpenClawSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [settings, setSettings] = useState<OpenClawSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getOpenClawSettings());
  }, []);

  const handleSave = () => {
    saveOpenClawSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Dispatch event so useOpenClaw can react
    window.dispatchEvent(new Event('openclaw-settings-changed'));
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    saveOpenClawSettings(DEFAULTS);
    window.dispatchEvent(new Event('openclaw-settings-changed'));
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Settings</h2>
      <p style={{ fontSize: '14px', color: 'var(--cds-text-secondary)', marginBottom: '2rem' }}>
        Configure your connection to the OpenClaw gateway.
      </p>

      {saved && (
        <InlineNotification
          kind="success"
          title="Saved"
          subtitle="Settings saved. Reconnecting..."
          lowContrast
          style={{ marginBottom: '1rem' }}
          onClose={() => setSaved(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>Gateway Connection</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextInput
              id="gateway-url"
              labelText="Gateway URL"
              placeholder="ws://127.0.0.1:18789"
              value={settings.gatewayUrl}
              onChange={(e) => setSettings(s => ({ ...s, gatewayUrl: e.target.value }))}
              helperText="WebSocket URL of your OpenClaw gateway"
            />

            <TextInput
              id="gateway-token"
              type="password"
              labelText="Gateway Secret"
              placeholder="Enter your gateway token"
              value={settings.gatewayToken}
              onChange={(e) => setSettings(s => ({ ...s, gatewayToken: e.target.value }))}
              helperText="The auth token configured in your openclaw.json gateway.secret"
            />

            <Toggle
              id="auto-connect"
              labelText="Auto-connect"
              labelA="Off"
              labelB="On"
              toggled={settings.autoConnect}
              onToggle={(checked) => setSettings(s => ({ ...s, autoConnect: checked }))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
          <Button renderIcon={Save} onClick={handleSave} size="md">
            Save &amp; Reconnect
          </Button>
          <Button renderIcon={TrashCan} onClick={handleReset} kind="danger--tertiary" size="md">
            Reset Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
