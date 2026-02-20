'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClickableTile,
  Grid,
  Column,
  Button,
  Tag,
  Modal,
  TextInput,
  TextArea,
  InlineNotification,
  InlineLoading,
  CodeSnippet,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@carbon/react';
import { Add, UserAvatar, Play, Stop, Restart, TrashCan, View } from '@carbon/icons-react';

interface AgentSummary {
  id: string;
  name: string;
  model: string;
  version: string;
  status: 'running' | 'stopped' | 'error';
  port?: number;
  toolsCount: number;
  enabledTools: number;
}

interface AgentDetail {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  port: number | null;
  tools: any[];
  status: string;
  pid?: number;
  uptime?: number;
  processLogs?: { stderr: string; stdout: string } | null;
}

interface LogEntry {
  timestamp: string;
  type: string;
  agentId: string;
  data?: Record<string, unknown>;
}

const LOG_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'agent:start': { label: 'START', color: 'green' },
  'agent:stop': { label: 'STOP', color: 'cool-gray' },
  'agent:error': { label: 'ERROR', color: 'red' },
  'process:stderr': { label: 'STDERR', color: 'red' },
  'process:stdout': { label: 'STDOUT', color: 'cyan' },
  'chat:message': { label: 'CHAT', color: 'purple' },
  'chat:response': { label: 'REPLY', color: 'teal' },
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function Agents() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');

  // Detail modal
  const [detailAgent, setDetailAgent] = useState<AgentDetail | null>(null);
  const [detailLogs, setDetailLogs] = useState<LogEntry[]>([]);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) setAgents(await response.json());
    } catch {
      setError('Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleStart = async (agentId: string, force = false) => {
    setActionLoading(agentId);
    try {
      const res = await fetch(`/api/agents/${agentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const data = await res.json();
        const errMsg: string = data.error || 'Failed to start agent';
        // Auto-retry with force if port conflict detected
        if (!force && errMsg.includes('already in use')) {
          return handleStart(agentId, true);
        }
        setError(errMsg);
      }
      await fetchAgents();
    } catch {
      setError('Failed to start agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
      await fetchAgents();
    } catch {
      setError('Failed to stop agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch(`/api/agents/${agentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to restart agent');
      }
      await fetchAgents();
    } catch {
      setError('Failed to restart agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetail = async (agentId: string) => {
    try {
      const [detailRes, logsRes] = await Promise.all([
        fetch(`/api/agents/${agentId}`),
        fetch(`/api/agents/${agentId}/logs?limit=50`),
      ]);
      if (detailRes.ok) setDetailAgent(await detailRes.json());
      if (logsRes.ok) setDetailLogs(await logsRes.json());
      else setDetailLogs([]);
    } catch {
      setError('Failed to load agent details');
    }
  };

  const handleCreate = async () => {
    if (!formId.trim() || !formName.trim()) return;
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          name: formName,
          systemPrompt: formPrompt || undefined,
        }),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setFormId('');
        setFormName('');
        setFormPrompt('');
        fetchAgents();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create agent');
      }
    } catch {
      setError('Failed to create agent');
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId }),
      });
      if (res.ok) fetchAgents();
    } catch {
      setError('Failed to delete agent');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading agents..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1>Agents</h1>
          <p>Manage your autonomous AI agents</p>
        </div>
        <Button renderIcon={Add} onClick={() => setIsCreateOpen(true)}>Create Agent</Button>
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

      {agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--cds-text-secondary)' }}>
          <UserAvatar size={48} />
          <p style={{ marginTop: '1rem' }}>No agents found. Create one or add an agent folder to <code>agents/</code>.</p>
        </div>
      ) : (
        <Grid narrow>
          {agents.map(agent => (
            <Column key={agent.id} lg={4} md={4} sm={4}>
              <ClickableTile
                onClick={() => handleViewDetail(agent.id)}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <UserAvatar size={32} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0 }}>{agent.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>{agent.id}</span>
                  </div>
                  <Tag type={agent.status === 'running' ? 'green' : 'cool-gray'} size="sm">
                    {agent.status}
                  </Tag>
                </div>

                <div style={{ fontSize: '0.8125rem', color: 'var(--cds-text-secondary)' }}>
                  <div>Model: {agent.model}</div>
                  {agent.port && <div>Port: {agent.port}</div>}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {agent.status === 'stopped' ? (
                    <Button
                      hasIconOnly renderIcon={Play} iconDescription="Start"
                      kind="primary" size="sm"
                      disabled={actionLoading === agent.id}
                      onClick={() => handleStart(agent.id)}
                    />
                  ) : (
                    <>
                      <Button
                        hasIconOnly renderIcon={Stop} iconDescription="Stop"
                        kind="danger--ghost" size="sm"
                        disabled={actionLoading === agent.id}
                        onClick={() => handleStop(agent.id)}
                      />
                      <Button
                        hasIconOnly renderIcon={Restart} iconDescription="Restart"
                        kind="ghost" size="sm"
                        disabled={actionLoading === agent.id}
                        onClick={() => handleRestart(agent.id)}
                      />
                    </>
                  )}
                  <Button
                    hasIconOnly renderIcon={View} iconDescription="Details"
                    kind="ghost" size="sm"
                    onClick={() => handleViewDetail(agent.id)}
                  />
                  <Button
                    hasIconOnly renderIcon={TrashCan} iconDescription="Delete"
                    kind="danger--ghost" size="sm"
                    onClick={() => handleDelete(agent.id)}
                  />
                </div>
              </ClickableTile>
            </Column>
          ))}
        </Grid>
      )}

      {/* Create Agent Modal */}
      <Modal
        open={isCreateOpen}
        modalHeading="Create New Agent"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestClose={() => setIsCreateOpen(false)}
        onRequestSubmit={handleCreate}
        primaryButtonDisabled={!formId.trim() || !formName.trim()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextInput
            id="agent-id"
            labelText="Agent ID"
            placeholder="e.g., my-assistant"
            helperText="Kebab-case, used as folder name"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          />
          <TextInput
            id="agent-name"
            labelText="Display Name"
            placeholder="e.g., My Assistant"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <TextArea
            id="agent-prompt"
            labelText="System Prompt (optional)"
            placeholder="Describe this agent's personality and role..."
            value={formPrompt}
            onChange={(e) => setFormPrompt(e.target.value)}
            rows={4}
          />
        </div>
      </Modal>

      {/* Agent Detail Modal */}
      <Modal
        open={detailAgent !== null}
        modalHeading={detailAgent ? `Agent: ${detailAgent.name}` : ''}
        passiveModal
        onRequestClose={() => { setDetailAgent(null); setDetailLogs([]); }}
        size="lg"
      >
        {detailAgent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Tag type="blue">{detailAgent.model}</Tag>
              <Tag type={detailAgent.status === 'running' ? 'green' : 'cool-gray'}>{detailAgent.status}</Tag>
              {detailAgent.pid && <Tag type="purple">PID {detailAgent.pid}</Tag>}
              {detailAgent.uptime != null && detailAgent.uptime > 0 && (
                <Tag type="teal">Uptime {formatUptime(detailAgent.uptime)}</Tag>
              )}
              {detailAgent.port && <Tag type="cyan">:{detailAgent.port}</Tag>}
            </div>

            <Tabs>
              <TabList aria-label="Agent detail tabs">
                <Tab>Overview</Tab>
                <Tab>Logs ({detailLogs.length})</Tab>
                <Tab>Process Output</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                    <div>
                      <h5 style={{ marginBottom: '0.5rem' }}>System Prompt</h5>
                      <CodeSnippet type="multi" wrapText>
                        {detailAgent.systemPrompt}
                      </CodeSnippet>
                    </div>

                    {detailAgent.tools.length > 0 && (
                      <div>
                        <h5 style={{ marginBottom: '0.5rem' }}>Tools</h5>
                        {detailAgent.tools.map((t: any) => (
                          <div key={t.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <Tag type={t.enabled ? 'green' : 'cool-gray'} size="sm">{t.type}</Tag>
                            <span style={{ fontSize: '0.8125rem' }}>{t.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabPanel>
                <TabPanel>
                  <div style={{ paddingTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {detailLogs.length === 0 ? (
                      <p style={{ color: 'var(--cds-text-secondary)' }}>No logs yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {detailLogs.map((log, idx) => {
                          const meta = LOG_TYPE_LABELS[log.type] || { label: log.type, color: 'cool-gray' };
                          const time = new Date(log.timestamp).toLocaleString([], {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          });
                          return (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8125rem' }}>
                              <code style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', flexShrink: 0 }}>{time}</code>
                              <Tag type={meta.color as any} size="sm" style={{ flexShrink: 0 }}>{meta.label}</Tag>
                              {log.data && (
                                <span style={{ color: 'var(--cds-text-secondary)', wordBreak: 'break-all' }}>
                                  {Object.entries(log.data).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabPanel>
                <TabPanel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                    {detailAgent.processLogs ? (
                      <>
                        <div>
                          <h5 style={{ marginBottom: '0.5rem' }}>stderr</h5>
                          <CodeSnippet type="multi" wrapText>
                            {detailAgent.processLogs.stderr || '(empty)'}
                          </CodeSnippet>
                        </div>
                        <div>
                          <h5 style={{ marginBottom: '0.5rem' }}>stdout</h5>
                          <CodeSnippet type="multi" wrapText>
                            {detailAgent.processLogs.stdout || '(empty)'}
                          </CodeSnippet>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--cds-text-secondary)' }}>
                        No process output captured. Start the agent to see stdout/stderr here.
                      </p>
                    )}
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
}
