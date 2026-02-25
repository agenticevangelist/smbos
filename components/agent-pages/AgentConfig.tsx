'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button, TextInput, Select, SelectItem, InlineLoading,
  InlineNotification, Form, Stack, FormGroup,
} from '@carbon/react';
import { Save, TrashCan } from '@carbon/icons-react';
import type { AgentPageProps, AgentEntry, Binding, ModelEntry } from './types';

export function AgentConfig({ rpc, connected, agentId, isNew, projectId, onAgentChange, onNavigate }: AgentPageProps) {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formEmoji, setFormEmoji] = useState('');
  const [formTheme, setFormTheme] = useState('');
  const [formAvatar, setFormAvatar] = useState('');

  const loadData = useCallback(async () => {
    if (!connected) return;
    setIsLoading(true);
    try {
      const [configRes, modelRes] = await Promise.all([
        rpc<any>('config.get', {}),
        rpc<any>('models.list', {}),
      ]);
      const parsed = configRes.parsed ?? (configRes.raw ? JSON.parse(configRes.raw) : {});
      const list: AgentEntry[] = parsed.agents?.list ?? [];
      if (!list.some(a => a.id === 'main')) {
        list.unshift({ id: 'main', name: 'Main', default: true, workspace: parsed.agents?.defaults?.workspace, model: parsed.agents?.defaults?.model });
      }
      setAgents(list);
      setBindings(parsed.bindings ?? []);
      setModels((modelRes.models ?? []).map((m: any) => ({ id: m.id, name: m.name, provider: m.provider })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [connected, rpc]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (isLoading) return;
    if (isNew) {
      setFormId(''); setFormName(''); setFormModel('');
      setFormEmoji(''); setFormTheme(''); setFormAvatar('');
      setSaveStatus('idle');
    } else {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        setFormId(agent.id);
        setFormName(agent.identity?.name || agent.name || '');
        let m = agent.model;
        if (typeof m === 'object' && m !== null) m = (m as any).primary;
        setFormModel(m as string || '');
        setFormEmoji(agent.identity?.emoji || '');
        setFormTheme(agent.identity?.theme || '');
        setFormAvatar(agent.identity?.avatar || '');
        setSaveStatus('idle');
      }
    }
  }, [agentId, isNew, agents, isLoading]);

  const handleSave = async () => {
    if (!formId) return;
    setSaveStatus('saving');
    setError(null);
    try {
      const freshConfig = await rpc<any>('config.get', {});
      const parsed = freshConfig.parsed ?? JSON.parse(freshConfig.raw);
      const hash = freshConfig.hash;
      const currentList: AgentEntry[] = parsed.agents?.list ?? [];

      const newAgent: AgentEntry = { id: formId };
      if (formName || formEmoji || formTheme || formAvatar) {
        newAgent.identity = {
          name: formName || undefined,
          emoji: formEmoji || undefined,
          theme: formTheme || undefined,
          avatar: formAvatar || undefined,
        };
      }
      if (formModel) newAgent.model = formModel;

      let updatedList: AgentEntry[];
      if (isNew) {
        if (currentList.some(a => a.id === formId)) throw new Error(`Agent '${formId}' already exists.`);
        newAgent.workspace = `~/.openclaw/workspace-${formId}`;
        updatedList = [...currentList, newAgent];
      } else {
        updatedList = currentList.map(a => a.id === formId ? { ...a, ...newAgent } : a);
      }

      await rpc('config.patch', {
        raw: JSON.stringify({ agents: { ...parsed.agents, list: updatedList } }),
        baseHash: hash,
      });

      if (isNew) {
        await fetch('/api/openclaw/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', id: formId }),
        });
        if (projectId) {
          try {
            const pRes = await fetch('/api/projects');
            const pData = await pRes.json();
            const updatedProjects = (pData.projects || []).map((p: any) =>
              p.id === projectId ? { ...p, agentIds: [...(p.agentIds || []), formId] } : p
            );
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projects: updatedProjects })
            });
          } catch {}
        }
        if (onAgentChange) onAgentChange();
        if (onNavigate) onNavigate(`agent-${formId}-config`);
      } else {
        setSaveStatus('success');
        if (onAgentChange) onAgentChange();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveStatus('error');
    }
  };

  const handleDelete = async () => {
    if (!formId || isNew) return;
    if (!confirm(`Delete agent '${formId}'?`)) return;
    setSaveStatus('saving');
    try {
      const freshConfig = await rpc<any>('config.get', {});
      const parsed = freshConfig.parsed ?? JSON.parse(freshConfig.raw);
      const hash = freshConfig.hash;
      await rpc('config.patch', {
        raw: JSON.stringify({
          agents: { ...parsed.agents, list: (parsed.agents?.list ?? []).filter((a: any) => a.id !== formId) },
          bindings: (parsed.bindings ?? []).filter((b: any) => b.agentId !== formId),
        }),
        baseHash: hash,
      });
      await fetch('/api/openclaw/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: formId }),
      });
      if (onAgentChange) onAgentChange();
      if (onNavigate) onNavigate('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveStatus('error');
    }
  };

  if (!connected) return <InlineNotification kind="warning" title="Not connected" subtitle="Connect to gateway first." hideCloseButton />;
  if (isLoading) return <InlineLoading description="Loading..." />;

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>{isNew ? 'Create Agent' : 'Configuration'}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isNew && formId !== 'main' && (
            <Button kind="danger--ghost" renderIcon={TrashCan} onClick={handleDelete} disabled={saveStatus === 'saving'} size="sm">Delete</Button>
          )}
          <Button renderIcon={Save} onClick={handleSave} disabled={saveStatus === 'saving' || (isNew && !formId)} size="sm">
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && <InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} style={{ marginBottom: '1rem' }} />}
      {saveStatus === 'success' && <InlineNotification kind="success" title="Saved" subtitle="Changes saved." onClose={() => setSaveStatus('idle')} style={{ marginBottom: '1rem' }} lowContrast />}

      <Form>
        <Stack gap={6}>
          {isNew && (
            <TextInput
              id="agent-id"
              labelText="Agent ID"
              helperText="Unique identifier (lowercase, hyphens)."
              placeholder="e.g. support-bot"
              value={formId}
              onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              invalid={isNew && !formId}
              invalidText="Required"
            />
          )}
          <FormGroup legendText="Display Profile">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextInput id="agent-name" labelText="Display Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <TextInput id="agent-emoji" labelText="Emoji" value={formEmoji} onChange={(e) => setFormEmoji(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <TextInput id="agent-theme" labelText="Theme" placeholder="e.g. dark" value={formTheme} onChange={(e) => setFormTheme(e.target.value)} />
              <TextInput id="agent-avatar" labelText="Avatar URL" value={formAvatar} onChange={(e) => setFormAvatar(e.target.value)} />
            </div>
          </FormGroup>
          <FormGroup legendText="Intelligence">
            <Select id="agent-model" labelText="LLM Model" value={formModel} onChange={(e) => setFormModel(e.target.value)}>
              <SelectItem value="" text="Use Default (System)" />
              {['anthropic', 'openai', 'google', 'ollama'].flatMap(provider => {
                const pm = models.filter(m => m.provider === provider);
                return pm.map(m => (
                  <SelectItem key={m.id} value={`${m.provider}/${m.id}`} text={`${m.name} (${m.provider})`} />
                ));
              })}
            </Select>
          </FormGroup>
        </Stack>
      </Form>
    </div>
  );
}
