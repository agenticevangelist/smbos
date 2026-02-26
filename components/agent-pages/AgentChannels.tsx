'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button, TextInput, Select, SelectItem, InlineLoading,
  InlineNotification, Stack, TextArea, Toggle, NumberInput,
  Modal, Tag,
} from '@carbon/react';
import { Save, Add, Close } from '@carbon/icons-react';
import { CHANNEL_DEFS } from './channelDefs';
import type { AgentPageProps, Binding } from './types';

function getChannelDefaults(chKey: string): Record<string, any> {
  const def = CHANNEL_DEFS[chKey];
  if (!def) return {};
  const defaults: Record<string, any> = {};
  for (const f of def.fields) {
    if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
  }
  return defaults;
}

export function AgentChannels({ rpc, connected, agentId }: AgentPageProps) {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [configuredChannels, setConfiguredChannels] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [channelConfigs, setChannelConfigs] = useState<Record<string, Record<string, any>>>({});
  const [formBindings, setFormBindings] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedNewChannel, setSelectedNewChannel] = useState('');
  const [newAccountId, setNewAccountId] = useState('');

  const loadData = useCallback(async () => {
    if (!connected) return;
    setIsLoading(true);
    try {
      const configRes = await rpc<any>('config.get', {});
      const parsed = configRes.parsed ?? (configRes.raw ? JSON.parse(configRes.raw) : {});
      setBindings(parsed.bindings ?? []);

      const chConfigs: Record<string, any> = {};
      for (const chKey of Object.keys(CHANNEL_DEFS)) {
        if (parsed.channels?.[chKey]) chConfigs[chKey] = parsed.channels[chKey];
      }
      setConfiguredChannels(chConfigs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [connected, rpc]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (isLoading) return;
    const agentBindings = bindings.filter(b => b.agentId === agentId);
    const bindingKeys = agentBindings.map(b => {
      const ch = b.match.channel ?? '';
      const acc = b.match.accountId;
      return acc && acc !== '*' ? `${ch}:${acc}` : ch;
    });
    setFormBindings(bindingKeys);

    const chConfigs: Record<string, Record<string, any>> = {};
    for (const binding of agentBindings) {
      const chName = binding.match.channel;
      if (!chName) continue;
      const accountId = binding.match.accountId;
      const globalChConfig = configuredChannels[chName];
      if (accountId && accountId !== '*') {
        // Per-account binding: load from channels[ch].accounts[accountId]
        const bindingKey = `${chName}:${accountId}`;
        const accountConfig = globalChConfig?.accounts?.[accountId] ?? {};
        chConfigs[bindingKey] = { ...getChannelDefaults(chName), ...accountConfig };
      } else {
        // Channel-level binding (default account)
        const { accounts, ...topLevel } = globalChConfig ?? {};
        chConfigs[chName] = { ...getChannelDefaults(chName), ...topLevel };
      }
    }
    setChannelConfigs(chConfigs);
  }, [agentId, bindings, isLoading, configuredChannels]);

  const updateField = (chKey: string, fieldKey: string, value: any) => {
    setChannelConfigs(prev => ({ ...prev, [chKey]: { ...prev[chKey], [fieldKey]: value } }));
  };

  const addChannel = (chKey: string, accountId?: string) => {
    // Determine the binding key: "channel" or "channel:accountId"
    const bindingKey = accountId ? `${chKey}:${accountId}` : chKey;
    if (!chKey || channelConfigs[bindingKey]) return;
    const def = CHANNEL_DEFS[chKey];
    if (!def) return;
    const base = getChannelDefaults(chKey);
    if (accountId) {
      const accountConfig = configuredChannels[chKey]?.accounts?.[accountId] ?? {};
      setChannelConfigs(prev => ({ ...prev, [bindingKey]: { ...base, ...accountConfig } }));
    } else {
      const { accounts, ...topLevel } = configuredChannels[chKey] ?? {};
      setChannelConfigs(prev => ({ ...prev, [bindingKey]: { ...base, ...topLevel } }));
    }
    if (!formBindings.includes(bindingKey)) setFormBindings(prev => [...prev, bindingKey]);
    setAddModalOpen(false);
    setSelectedNewChannel('');
    setNewAccountId('');
  };

  const removeChannel = (bindingKey: string) => {
    setChannelConfigs(prev => { const n = { ...prev }; delete n[bindingKey]; return n; });
    setFormBindings(prev => prev.filter(b => b !== bindingKey));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setError(null);
    try {
      const freshConfig = await rpc<any>('config.get', {});
      const parsed = freshConfig.parsed ?? (freshConfig.raw ? JSON.parse(freshConfig.raw) : {});
      const hash = freshConfig.hash;

      // Build bindings: keep other agents' bindings, replace this agent's
      const otherBindings = (parsed.bindings ?? []).filter((b: any) => b.agentId !== agentId);

      const newBindings: Binding[] = formBindings.map(ch => {
        const parts = ch.split(':');
        const channelKey = parts[0];
        const accountId = parts[1] || undefined;
        return { agentId, match: { channel: channelKey, ...(accountId ? { accountId } : {}) } };
      });

      const updatedBindings = [...otherBindings, ...newBindings];

      // Build channel configs: merge this agent's channel settings into the global config
      const updatedChannels = { ...(parsed.channels || {}) };
      for (const [bindingKey, chConfig] of Object.entries(channelConfigs)) {
        const parts = bindingKey.split(':');
        const chKey = parts[0];
        const accountId = parts[1] || null;

        const processed = { ...chConfig };

        // Normalize textarea fields
        if (typeof processed.allowFrom === 'string') {
          processed.allowFrom = processed.allowFrom.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }
        if (chKey === 'irc' && typeof processed.channels === 'string') {
          processed.channels = processed.channels.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }

        if (accountId) {
          // Per-account config: write under channels[ch].accounts[accountId]
          // enabled lives at top-level channel, not per-account
          if (!processed.dmPolicy || processed.dmPolicy === 'disabled') {
            const existingAccountDmPolicy = configuredChannels[chKey]?.accounts?.[accountId]?.dmPolicy;
            if (!existingAccountDmPolicy) processed.dmPolicy = 'pairing';
          }
          const existingCh = updatedChannels[chKey] || {};
          const existingAccounts = existingCh.accounts || {};
          updatedChannels[chKey] = {
            ...existingCh,
            enabled: true,
            accounts: {
              ...existingAccounts,
              [accountId]: { ...(existingAccounts[accountId] || {}), ...processed },
            },
          };
        } else {
          // Top-level (default account) config
          processed.enabled = true;

          // If dmPolicy is "disabled", warn but still save (user explicitly chose it)
          // For new channels being added, ensure dmPolicy defaults to something usable
          if (!processed.dmPolicy || processed.dmPolicy === 'disabled') {
            // Only override if the channel is freshly added (no prior config)
            if (!configuredChannels[chKey]?.dmPolicy) {
              processed.dmPolicy = 'pairing';
            }
          }

          // Merge into global channel config (preserving fields we don't manage, like accounts)
          updatedChannels[chKey] = { ...(updatedChannels[chKey] || {}), ...processed };
        }
      }

      await rpc('config.patch', {
        raw: JSON.stringify({ bindings: updatedBindings, channels: updatedChannels }),
        baseHash: hash,
      });
      setSaveStatus('success');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveStatus('error');
    }
  };

  const renderField = (bindingKey: string, field: typeof CHANNEL_DEFS[string]['fields'][0]) => {
    const value = channelConfigs[bindingKey]?.[field.key] ?? field.defaultValue ?? '';
    // Use bindingKey for IDs to ensure uniqueness (e.g. telegram:nano vs telegram)
    switch (field.type) {
      case 'text':
      case 'password':
        return <TextInput key={field.key} id={`ch-${bindingKey}-${field.key}`} labelText={field.label} type={field.type === 'password' ? 'password' : 'text'} value={value} onChange={(e) => updateField(bindingKey, field.key, e.target.value)} placeholder={field.placeholder} helperText={field.helperText} invalid={field.required && !value} invalidText="Required" />;
      case 'select':
        return <Select key={field.key} id={`ch-${bindingKey}-${field.key}`} labelText={field.label} value={value} onChange={(e) => updateField(bindingKey, field.key, e.target.value)} helperText={field.helperText}>{field.options?.map(o => <SelectItem key={o.value} value={o.value} text={o.text} />)}</Select>;
      case 'toggle':
        return <Toggle key={field.key} id={`ch-${bindingKey}-${field.key}`} labelText={field.label} toggled={!!value} onToggle={(c) => updateField(bindingKey, field.key, c)} />;
      case 'number':
        return <NumberInput key={field.key} id={`ch-${bindingKey}-${field.key}`} label={field.label} value={value || 0} onChange={(_e: any, { value: v }: any) => updateField(bindingKey, field.key, v)} helperText={field.helperText} min={0} />;
      case 'textarea':
        return <TextArea key={field.key} id={`ch-${bindingKey}-${field.key}`} labelText={field.label} value={Array.isArray(value) ? value.join('\n') : value} onChange={(e) => updateField(bindingKey, field.key, e.target.value)} placeholder={field.placeholder} helperText={field.helperText} rows={3} />;
      default: return null;
    }
  };

  // All channel types are always available — multiple accounts of the same channel are allowed
  const availableNew = Object.entries(CHANNEL_DEFS)
    .map(([k, d]) => ({ id: k, label: d.label, description: d.description }));

  if (!connected) return <InlineNotification kind="warning" title="Not connected" subtitle="Connect to gateway first." hideCloseButton />;
  if (isLoading) return <InlineLoading description="Loading channels..." />;

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Channels</h3>
          <p style={{ fontSize: '13px', color: 'var(--cds-text-secondary)', marginTop: '4px' }}>
            Configure which messaging channels this agent listens on.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button renderIcon={Add} size="sm" kind="tertiary" onClick={() => setAddModalOpen(true)}>Add Channel</Button>
          <Button renderIcon={Save} size="sm" onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && <InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} style={{ marginBottom: '1rem' }} />}
      {saveStatus === 'success' && <InlineNotification kind="success" title="Saved" subtitle="Channel config saved." onClose={() => setSaveStatus('idle')} style={{ marginBottom: '1rem' }} lowContrast />}

      {Object.keys(channelConfigs).length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--cds-border-subtle)', color: 'var(--cds-text-secondary)' }}>
          <p style={{ marginBottom: '1rem' }}>No channels bound to this agent.</p>
          <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => setAddModalOpen(true)}>Add your first channel</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(channelConfigs).map(([bindingKey]) => {
            const [chName, accountId] = bindingKey.split(':');
            const def = CHANNEL_DEFS[chName];
            if (!def) return null;
            const isDmDisabled = channelConfigs[bindingKey]?.dmPolicy === 'disabled';
            const isConfigured = accountId
              ? !!configuredChannels[chName]?.accounts?.[accountId]
              : !!configuredChannels[chName];
            return (
              <div key={bindingKey} style={{ border: '1px solid var(--cds-border-subtle)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h5 style={{ margin: 0, fontWeight: 600 }}>{def.label}{accountId ? ` (${accountId})` : ''}</h5>
                      {isConfigured && <Tag type="green" size="sm">Configured</Tag>}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--cds-text-secondary)', marginTop: '2px' }}>{def.description}</p>
                  </div>
                  <Button kind="danger--ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Remove" onClick={() => removeChannel(bindingKey)} />
                </div>
                {isDmDisabled && (
                  <InlineNotification kind="warning" title="DMs are disabled" subtitle="The DM policy is set to 'Disabled' — the bot will ignore all direct messages. Change it to 'Open', 'Pairing', or 'Allowlist' to receive messages." hideCloseButton lowContrast style={{ marginBottom: '1rem' }} />
                )}
                {def.pairingRequired && (
                  <InlineNotification kind="info" title="Pairing Required" subtitle={def.pairingHint} hideCloseButton lowContrast style={{ marginBottom: '1rem' }} />
                )}
                <Stack gap={5}>{def.fields.map(f => renderField(bindingKey, f))}</Stack>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={addModalOpen}
        modalHeading="Add Channel"
        primaryButtonText="Add"
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!selectedNewChannel || (!!configuredChannels[selectedNewChannel] && !newAccountId.trim())}
        onRequestSubmit={() => {
          const accountId = newAccountId.trim() || undefined;
          addChannel(selectedNewChannel, accountId);
        }}
        onRequestClose={() => { setAddModalOpen(false); setSelectedNewChannel(''); setNewAccountId(''); }}
        size="sm"
      >
        <p style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>Select a messaging channel to configure.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {availableNew.map(ch => (
            <div key={ch.id} onClick={() => { setSelectedNewChannel(ch.id); setNewAccountId(''); }} style={{
              padding: '1rem',
              border: `2px solid ${selectedNewChannel === ch.id ? 'var(--cds-interactive-01)' : 'var(--cds-border-subtle)'}`,
              cursor: 'pointer',
              background: selectedNewChannel === ch.id ? 'var(--cds-layer-selected-01)' : 'transparent',
            }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{ch.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--cds-text-secondary)', marginTop: '2px' }}>{ch.description}</div>
            </div>
          ))}
        </div>
        {selectedNewChannel && configuredChannels[selectedNewChannel] && (
          <div style={{ marginTop: '1rem' }}>
            <TextInput
              id="new-account-id"
              labelText="Account ID"
              helperText={`This channel already has a default account. Enter a unique ID for this bot (e.g. "${agentId}").`}
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              placeholder={agentId}
              invalid={!newAccountId.trim()}
              invalidText="Required when channel already has a default account"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
