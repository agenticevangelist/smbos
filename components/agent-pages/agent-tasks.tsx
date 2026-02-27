'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Tag,
  InlineNotification,
  Modal,
  InlineLoading,
  TextInput,
  Select,
  SelectItem,
  TextArea,
  Toggle,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  NumberInput,
  RadioButtonGroup,
  RadioButton,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import {
  Add,
  Play,
  Pause,
  TrashCan,
  Renew,
  Time,
  Calendar,
  ChevronDown,
  ChevronRight,
  Flash,
  Webhook,
  Launch,
  Error as ErrorIcon,
  Checkmark,
  Warning,
  OverflowMenuVertical,
  Repeat,
  CalendarHeatMap,
  Timer,
} from '@carbon/icons-react';

type RpcFn = <T = any>(method: string, params?: object) => Promise<T>;

interface AgentTasksProps {
  agentId: string;
  rpc: RpcFn;
  connected: boolean;
}

type ScheduleKind = 'every' | 'cron' | 'at';
type SessionTarget = 'isolated' | 'main';
type DeliveryMode = 'none' | 'announce' | 'webhook';
type WakeMode = 'now' | 'next-heartbeat';

interface CronJob {
  jobId: string;
  name: string;
  description?: string;
  agentId?: string;
  enabled: boolean;
  schedule: {
    kind: ScheduleKind;
    expr?: string;
    tz?: string;
    everyMs?: number;
    at?: string;
    staggerMs?: number;
  };
  sessionTarget: SessionTarget;
  wakeMode: WakeMode;
  payload: {
    kind: 'agentTurn' | 'systemEvent';
    message?: string;
    text?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
  };
  delivery?: {
    mode: DeliveryMode;
    channel?: string;
    to?: string;
    bestEffort?: boolean;
  };
  deleteAfterRun?: boolean;
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    runCount?: number;
    errorCount?: number;
  };
}

interface CronRun {
  runId: string;
  jobId: string;
  startedAt: number;
  endedAt?: number;
  status: 'ok' | 'error' | 'skipped' | 'running';
  durationMs?: number;
  summary?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function msToEveryLabel(ms: number): string {
  const m = ms / 60000;
  if (m < 60) return `every ${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `every ${h % 1 === 0 ? Math.round(h) : h.toFixed(1)}h`;
  return `every ${Math.round(h / 24)}d`;
}

function formatSchedule(job: CronJob): string {
  if (job.schedule.kind === 'cron') return job.schedule.expr || '-';
  if (job.schedule.kind === 'every') return msToEveryLabel(job.schedule.everyMs || 0);
  if (job.schedule.kind === 'at') {
    const ms = job.schedule.at ? new Date(job.schedule.at).getTime() : 0;
    if (!ms) return '-';
    return new Date(ms).toLocaleString();
  }
  return '-';
}

function formatRelative(ms?: number): string {
  if (!ms) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60000) return past ? 'just now' : 'in <1m';
  if (abs < 3600000) return past ? `${Math.round(abs / 60000)}m ago` : `in ${Math.round(abs / 60000)}m`;
  if (abs < 86400000) return past ? `${Math.round(abs / 3600000)}h ago` : `in ${Math.round(abs / 3600000)}h`;
  return new Date(ms).toLocaleString();
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function statusTag(status: string, enabled: boolean) {
  if (!enabled) return <Tag type="gray" size="sm">disabled</Tag>;
  if (status === 'ok') return <Tag type="green" size="sm">ok</Tag>;
  if (status === 'error') return <Tag type="red" size="sm">error</Tag>;
  if (status === 'skipped') return <Tag type="warm-gray" size="sm">skipped</Tag>;
  if (status === 'running') return <Tag type="blue" size="sm">running</Tag>;
  return <Tag type="green" size="sm">active</Tag>;
}

// ── schedule preset quick-pick ─────────────────────────────────────────────────

const EVERY_PRESETS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '2 hours', ms: 2 * 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];

const CRON_PRESETS = [
  { label: 'Every hour', expr: '0 * * * *' },
  { label: 'Daily 7 AM', expr: '0 7 * * *' },
  { label: 'Daily 9 AM', expr: '0 9 * * *' },
  { label: 'Daily noon', expr: '0 12 * * *' },
  { label: 'Daily 6 PM', expr: '0 18 * * *' },
  { label: 'Daily 10 PM', expr: '0 22 * * *' },
  { label: 'Weekdays 9 AM', expr: '0 9 * * 1-5' },
  { label: 'Weekly Mon 8 AM', expr: '0 8 * * 1' },
];

const DELIVERY_CHANNELS = ['telegram', 'whatsapp', 'discord', 'slack', 'signal', 'msteams'];

const MODELS = [
  { id: '', label: 'Default (inherit)' },
  { id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku (fast, cheap)' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet (balanced)' },
  { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus (powerful)' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini (fast)' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
];

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

// ── default form state ─────────────────────────────────────────────────────────

const defaultForm = () => ({
  name: '',
  description: '',
  scheduleKind: 'cron' as ScheduleKind,
  cronExpr: '0 9 * * *',
  cronTz: '',
  everyMs: 60 * 60 * 1000,
  atDatetime: '',
  sessionTarget: 'isolated' as SessionTarget,
  wakeMode: 'now' as WakeMode,
  message: '',
  model: '',
  thinking: '',
  timeoutSeconds: 0,
  deliveryMode: 'none' as DeliveryMode,
  deliveryChannel: 'telegram',
  deliveryTo: '',
  deliveryBestEffort: true,
  deleteAfterRun: false,
  enabled: true,
});

type FormState = ReturnType<typeof defaultForm>;

// ── main component ─────────────────────────────────────────────────────────────

export function AgentTasks({ agentId, rpc, connected }: AgentTasksProps) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<Record<string, CronRun[]>>({});
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningJobIds, setRunningJobIds] = useState<Set<string>>(new Set());

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState(0);

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!connected) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await rpc<any>('cron.list');
      let all: CronJob[] = Array.isArray(res) ? res : (res?.jobs ?? []);
      all = all.filter((j: CronJob) => !j.agentId || j.agentId === agentId);
      setJobs(all);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }, [connected, rpc, agentId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const fetchRuns = useCallback(async (jobId: string) => {
    setLoadingRuns(jobId);
    try {
      const res = await rpc<any>('cron.runs', { jobId, limit: 20 });
      const list: CronRun[] = Array.isArray(res) ? res : (res?.runs ?? []);
      setRuns(r => ({ ...r, [jobId]: list }));
    } catch { /* ignore */ } finally {
      setLoadingRuns(null);
    }
  }, [rpc]);

  const toggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      if (!runs[jobId]) fetchRuns(jobId);
    }
  };

  // ── actions ────────────────────────────────────────────────────────────────

  const handleToggle = async (job: CronJob) => {
    try {
      await rpc('cron.update', { jobId: job.jobId, patch: { enabled: !job.enabled } });
      await fetchJobs();
    } catch (e: any) { setError(e?.message || String(e)); }
  };

  const handleRunNow = async (jobId: string) => {
    setRunningJobIds(s => new Set(s).add(jobId));
    try {
      await rpc('cron.run', { jobId, mode: 'force' });
      setTimeout(() => {
        fetchJobs();
        if (expandedJobId === jobId) fetchRuns(jobId);
      }, 1500);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setTimeout(() => setRunningJobIds(s => { const n = new Set(s); n.delete(jobId); return n; }), 2000); }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this scheduled task?')) return;
    try {
      await rpc('cron.remove', { jobId });
      await fetchJobs();
      if (expandedJobId === jobId) setExpandedJobId(null);
    } catch (e: any) { setError(e?.message || String(e)); }
  };

  // ── open modal ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditJobId(null);
    setForm(defaultForm());
    setModalTab(0);
    setModalOpen(true);
  };

  const openEdit = (job: CronJob) => {
    setEditJobId(job.jobId);
    setForm({
      name: job.name,
      description: job.description || '',
      scheduleKind: job.schedule.kind,
      cronExpr: job.schedule.expr || '0 9 * * *',
      cronTz: job.schedule.tz || '',
      everyMs: job.schedule.everyMs || 60 * 60 * 1000,
      atDatetime: job.schedule.at || '',
      sessionTarget: job.sessionTarget,
      wakeMode: job.wakeMode,
      message: job.payload.message || job.payload.text || '',
      model: job.payload.model || '',
      thinking: job.payload.thinking || '',
      timeoutSeconds: job.payload.timeoutSeconds || 0,
      deliveryMode: job.delivery?.mode || 'none',
      deliveryChannel: job.delivery?.channel || 'telegram',
      deliveryTo: job.delivery?.to || '',
      deliveryBestEffort: job.delivery?.bestEffort !== false,
      deleteAfterRun: job.deleteAfterRun || false,
      enabled: job.enabled,
    });
    setModalTab(0);
    setModalOpen(true);
  };

  // ── save ───────────────────────────────────────────────────────────────────

  const buildParams = (): Record<string, any> => {
    const schedule: any = { kind: form.scheduleKind };
    if (form.scheduleKind === 'cron') {
      schedule.expr = form.cronExpr;
      if (form.cronTz) schedule.tz = form.cronTz;
    } else if (form.scheduleKind === 'every') {
      schedule.everyMs = form.everyMs;
    } else {
      schedule.at = form.atDatetime;
    }

    const payload: any = {
      kind: form.sessionTarget === 'isolated' ? 'agentTurn' : 'systemEvent',
    };
    if (form.sessionTarget === 'isolated') {
      payload.message = form.message;
      if (form.model) payload.model = form.model;
      if (form.thinking) payload.thinking = form.thinking;
      if (form.timeoutSeconds > 0) payload.timeoutSeconds = form.timeoutSeconds;
    } else {
      payload.text = form.message;
    }

    const delivery: any = { mode: form.deliveryMode };
    if (form.deliveryMode === 'announce') {
      delivery.channel = form.deliveryChannel;
      if (form.deliveryTo) delivery.to = form.deliveryTo;
      delivery.bestEffort = form.deliveryBestEffort;
    } else if (form.deliveryMode === 'webhook') {
      delivery.to = form.deliveryTo;
    }

    return {
      name: form.name,
      ...(form.description ? { description: form.description } : {}),
      schedule,
      agentId,
      sessionTarget: form.sessionTarget,
      wakeMode: form.wakeMode,
      payload,
      ...(form.deliveryMode !== 'none' ? { delivery } : {}),
      ...(form.scheduleKind === 'at' ? { deleteAfterRun: form.deleteAfterRun } : {}),
      enabled: form.enabled,
    };
  };

  const handleSave = async () => {
    if (!form.name || !form.message) return;
    setSaving(true);
    setError(null);
    try {
      if (editJobId) {
        const p = buildParams();
        await rpc('cron.update', { jobId: editJobId, patch: p });
      } else {
        await rpc('cron.add', buildParams());
      }
      setModalOpen(false);
      await fetchJobs();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="agent-tasks">
        <InlineNotification kind="warning" title="Disconnected" subtitle="Connect to Gateway to manage tasks." hideCloseButton />
      </div>
    );
  }

  return (
    <div className="agent-tasks">
      {/* Header */}
      <div className="agent-tasks__header">
        <div className="agent-tasks__title-row">
          <h4 className="agent-tasks__title">Scheduled Tasks</h4>
          <Tag type="cool-gray" size="sm">{agentId}</Tag>
          {jobs.length > 0 && (
            <Tag type="blue" size="sm">{jobs.filter(j => j.enabled).length} active</Tag>
          )}
        </div>
        <div className="agent-tasks__actions">
          <Button kind="ghost" hasIconOnly renderIcon={Renew} iconDescription="Refresh" onClick={fetchJobs} size="sm" disabled={isLoading} />
          <Button renderIcon={Add} onClick={openCreate} size="sm">New Task</Button>
        </div>
      </div>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} lowContrast />
      )}

      {/* Job list */}
      <div className="agent-tasks__list">
        {isLoading && jobs.length === 0 && (
          <div style={{ padding: '1rem' }}>
            <InlineLoading description="Loading tasks..." />
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div className="agent-tasks__empty">
            <CalendarHeatMap size={32} />
            <p>No scheduled tasks</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)' }}>
              Create tasks to automate agent runs on a schedule.
            </p>
            <Button renderIcon={Add} size="sm" onClick={openCreate}>Create First Task</Button>
          </div>
        )}

        {jobs.map(job => {
          const isExpanded = expandedJobId === job.jobId;
          const isRunning = runningJobIds.has(job.jobId);
          const lastStatus = job.state?.lastStatus;

          return (
            <div key={job.jobId} className={`agent-tasks__job ${!job.enabled ? 'agent-tasks__job--disabled' : ''}`}>
              {/* Job row */}
              <div className="agent-tasks__job-row">
                <button
                  className="agent-tasks__job-expand"
                  onClick={() => toggleExpand(job.jobId)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className="agent-tasks__job-info">
                  <div className="agent-tasks__job-name">
                    {job.name}
                    {job.sessionTarget === 'isolated'
                      ? <span className="agent-tasks__badge agent-tasks__badge--isolated">isolated</span>
                      : <span className="agent-tasks__badge agent-tasks__badge--main">main</span>}
                    {job.delivery?.mode === 'announce' && (
                      <span className="agent-tasks__badge agent-tasks__badge--deliver">→ {job.delivery.channel}</span>
                    )}
                    {job.delivery?.mode === 'webhook' && (
                      <span className="agent-tasks__badge agent-tasks__badge--webhook"><Webhook size={10} /> webhook</span>
                    )}
                  </div>
                  <div className="agent-tasks__job-meta">
                    <span className="agent-tasks__meta-item">
                      {job.schedule.kind === 'cron' && <Repeat size={12} />}
                      {job.schedule.kind === 'every' && <Timer size={12} />}
                      {job.schedule.kind === 'at' && <Calendar size={12} />}
                      {formatSchedule(job)}
                      {job.schedule.tz && ` (${job.schedule.tz})`}
                    </span>
                    {job.state?.nextRunAtMs && job.enabled && (
                      <span className="agent-tasks__meta-item">
                        <Time size={12} />
                        next: {formatRelative(job.state.nextRunAtMs)}
                      </span>
                    )}
                    {job.state?.runCount !== undefined && (
                      <span className="agent-tasks__meta-item">
                        {job.state.runCount} runs
                        {job.state.errorCount ? `, ${job.state.errorCount} errors` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="agent-tasks__job-status">
                  {statusTag(lastStatus || '', job.enabled)}
                </div>

                <div className="agent-tasks__job-controls">
                  <Button
                    hasIconOnly
                    renderIcon={job.enabled ? Pause : Play}
                    iconDescription={job.enabled ? 'Disable' : 'Enable'}
                    kind="ghost"
                    size="sm"
                    onClick={() => handleToggle(job)}
                  />
                  <Button
                    hasIconOnly
                    renderIcon={isRunning ? InlineLoading : Flash}
                    iconDescription="Run now"
                    kind="ghost"
                    size="sm"
                    onClick={() => handleRunNow(job.jobId)}
                    disabled={isRunning}
                  />
                  <OverflowMenu renderIcon={OverflowMenuVertical} size="sm" flipped>
                    <OverflowMenuItem itemText="Edit" onClick={() => openEdit(job)} />
                    <OverflowMenuItem itemText="View runs" onClick={() => { setExpandedJobId(job.jobId); fetchRuns(job.jobId); }} />
                    <OverflowMenuItem itemText="Delete" isDelete onClick={() => handleDelete(job.jobId)} />
                  </OverflowMenu>
                </div>
              </div>

              {/* Expanded: runs + details */}
              {isExpanded && (
                <div className="agent-tasks__job-detail">
                  <div className="agent-tasks__detail-cols">
                    {/* Prompt preview */}
                    <div className="agent-tasks__detail-section">
                      <div className="agent-tasks__detail-label">Prompt</div>
                      <div className="agent-tasks__prompt-preview">
                        {job.payload.message || job.payload.text || '—'}
                      </div>
                    </div>

                    {/* Config summary */}
                    <div className="agent-tasks__detail-section">
                      <div className="agent-tasks__detail-label">Config</div>
                      <table className="agent-tasks__config-table">
                        <tbody>
                          <tr><td>Session</td><td>{job.sessionTarget}</td></tr>
                          <tr><td>Wake mode</td><td>{job.wakeMode}</td></tr>
                          {job.payload.model && <tr><td>Model</td><td>{job.payload.model}</td></tr>}
                          {job.payload.thinking && <tr><td>Thinking</td><td>{job.payload.thinking}</td></tr>}
                          {job.payload.timeoutSeconds ? <tr><td>Timeout</td><td>{job.payload.timeoutSeconds}s</td></tr> : null}
                          {job.delivery?.mode !== 'none' && job.delivery && (
                            <tr><td>Delivery</td><td>{job.delivery.mode}{job.delivery.channel ? ` → ${job.delivery.channel}` : ''}{job.delivery.to ? ` / ${job.delivery.to}` : ''}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Run history */}
                  <div className="agent-tasks__detail-section agent-tasks__runs">
                    <div className="agent-tasks__runs-header">
                      <div className="agent-tasks__detail-label">Run History</div>
                      <Button kind="ghost" size="sm" renderIcon={Renew} hasIconOnly iconDescription="Refresh runs" onClick={() => fetchRuns(job.jobId)} />
                    </div>

                    {loadingRuns === job.jobId && <InlineLoading description="Loading runs..." />}

                    {!loadingRuns && runs[job.jobId]?.length === 0 && (
                      <p className="agent-tasks__runs-empty">No runs yet.</p>
                    )}

                    {runs[job.jobId]?.map(run => (
                      <div key={run.runId} className={`agent-tasks__run agent-tasks__run--${run.status}`}>
                        <div className="agent-tasks__run-icon">
                          {run.status === 'ok' && <Checkmark size={14} />}
                          {run.status === 'error' && <ErrorIcon size={14} />}
                          {run.status === 'skipped' && <Warning size={14} />}
                          {run.status === 'running' && <InlineLoading />}
                        </div>
                        <div className="agent-tasks__run-info">
                          <div className="agent-tasks__run-time">
                            {new Date(run.startedAt).toLocaleString()}
                            {run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}
                            {(run.inputTokens || run.outputTokens) ? ` · ${(run.inputTokens || 0) + (run.outputTokens || 0)} tokens` : ''}
                          </div>
                          {run.summary && (
                            <div className="agent-tasks__run-summary">{run.summary}</div>
                          )}
                          {run.error && (
                            <div className="agent-tasks__run-error">{run.error}</div>
                          )}
                        </div>
                        <Tag type={run.status === 'ok' ? 'green' : run.status === 'error' ? 'red' : 'warm-gray'} size="sm">
                          {run.status}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        modalHeading={editJobId ? 'Edit Task' : 'New Scheduled Task'}
        primaryButtonText={saving ? 'Saving...' : (editJobId ? 'Save' : 'Create')}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={saving || !form.name || !form.message}
        onRequestClose={() => { setModalOpen(false); setError(null); }}
        onRequestSubmit={handleSave}
        size="md"
      >
        <div className="agent-tasks__modal">
          <Tabs selectedIndex={modalTab} onChange={({ selectedIndex }) => setModalTab(selectedIndex)}>
            <TabList aria-label="Task configuration tabs">
              <Tab>Schedule</Tab>
              <Tab>Payload</Tab>
              <Tab>Delivery</Tab>
              <Tab>Advanced</Tab>
            </TabList>
            <TabPanels>
              {/* ── Tab 1: Schedule ── */}
              <TabPanel>
                <div className="agent-tasks__tab-content">
                  <TextInput
                    id="task-name"
                    labelText="Task Name *"
                    placeholder="Morning briefing"
                    value={form.name}
                    onChange={e => setF({ name: e.target.value })}
                  />

                  {/* Schedule kind */}
                  <div className="agent-tasks__field-group">
                    <div className="agent-tasks__field-label">Schedule Type</div>
                    <div className="agent-tasks__schedule-kind-btns">
                      {(['cron', 'every', 'at'] as ScheduleKind[]).map(k => (
                        <button
                          key={k}
                          className={`agent-tasks__kind-btn ${form.scheduleKind === k ? 'active' : ''}`}
                          onClick={() => setF({ scheduleKind: k })}
                          type="button"
                        >
                          {k === 'cron' && <><Repeat size={14} /> Cron</>}
                          {k === 'every' && <><Timer size={14} /> Interval</>}
                          {k === 'at' && <><Calendar size={14} /> One-shot</>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cron */}
                  {form.scheduleKind === 'cron' && (
                    <>
                      <div className="agent-tasks__field-group">
                        <div className="agent-tasks__field-label">Quick presets</div>
                        <div className="agent-tasks__presets">
                          {CRON_PRESETS.map(p => (
                            <button
                              key={p.expr}
                              className={`agent-tasks__preset-btn ${form.cronExpr === p.expr ? 'active' : ''}`}
                              onClick={() => setF({ cronExpr: p.expr })}
                              type="button"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TextInput
                        id="task-cron-expr"
                        labelText="Cron Expression"
                        placeholder="0 7 * * *"
                        helperText="5-field: minute hour day month weekday. Example: '0 7 * * *' = daily at 7 AM"
                        value={form.cronExpr}
                        onChange={e => setF({ cronExpr: e.target.value })}
                      />
                      <TextInput
                        id="task-cron-tz"
                        labelText="Timezone (optional)"
                        placeholder="America/New_York"
                        helperText="IANA timezone. Leave empty to use gateway host timezone."
                        value={form.cronTz}
                        onChange={e => setF({ cronTz: e.target.value })}
                      />
                    </>
                  )}

                  {/* Every */}
                  {form.scheduleKind === 'every' && (
                    <>
                      <div className="agent-tasks__field-group">
                        <div className="agent-tasks__field-label">Quick presets</div>
                        <div className="agent-tasks__presets">
                          {EVERY_PRESETS.map(p => (
                            <button
                              key={p.ms}
                              className={`agent-tasks__preset-btn ${form.everyMs === p.ms ? 'active' : ''}`}
                              onClick={() => setF({ everyMs: p.ms })}
                              type="button"
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <NumberInput
                        id="task-every-min"
                        label="Interval (minutes)"
                        min={1}
                        value={Math.round(form.everyMs / 60000)}
                        onChange={(_e: any, { value }: any) => setF({ everyMs: (Number(value) || 1) * 60000 })}
                        helperText={`= ${msToEveryLabel(form.everyMs)}`}
                      />
                    </>
                  )}

                  {/* At (one-shot) */}
                  {form.scheduleKind === 'at' && (
                    <>
                      <TextInput
                        id="task-at"
                        labelText="Run at (ISO 8601)"
                        placeholder="2026-03-01T09:00:00Z"
                        helperText="One-shot. ISO 8601 datetime. UTC if no timezone specified."
                        value={form.atDatetime}
                        onChange={e => setF({ atDatetime: e.target.value })}
                      />
                      <Toggle
                        id="task-delete-after"
                        labelText="Delete after run"
                        toggled={form.deleteAfterRun}
                        onToggle={v => setF({ deleteAfterRun: v })}
                      />
                    </>
                  )}

                  <Toggle
                    id="task-enabled"
                    labelText="Enabled"
                    toggled={form.enabled}
                    onToggle={v => setF({ enabled: v })}
                  />
                </div>
              </TabPanel>

              {/* ── Tab 2: Payload ── */}
              <TabPanel>
                <div className="agent-tasks__tab-content">
                  <div className="agent-tasks__field-group">
                    <div className="agent-tasks__field-label">Session Mode</div>
                    <div className="agent-tasks__session-mode">
                      <div
                        className={`agent-tasks__mode-card ${form.sessionTarget === 'isolated' ? 'active' : ''}`}
                        onClick={() => setF({ sessionTarget: 'isolated' })}
                      >
                        <div className="agent-tasks__mode-title">Isolated</div>
                        <div className="agent-tasks__mode-desc">Fresh session per run. No conversation carry-over. Best for background jobs and reports.</div>
                      </div>
                      <div
                        className={`agent-tasks__mode-card ${form.sessionTarget === 'main' ? 'active' : ''}`}
                        onClick={() => setF({ sessionTarget: 'main' })}
                      >
                        <div className="agent-tasks__mode-title">Main</div>
                        <div className="agent-tasks__mode-desc">Runs in the agent's main session. Has access to full conversation context and memory.</div>
                      </div>
                    </div>
                  </div>

                  <TextArea
                    id="task-message"
                    labelText="Prompt / Message *"
                    placeholder={form.sessionTarget === 'isolated'
                      ? 'Summarize overnight updates and send me a morning briefing.'
                      : 'Next heartbeat: check for any urgent emails and follow up.'}
                    helperText={form.sessionTarget === 'isolated'
                      ? 'The full prompt sent to the agent in its isolated session.'
                      : 'System event text injected into the main session heartbeat.'}
                    value={form.message}
                    onChange={e => setF({ message: e.target.value })}
                    rows={4}
                  />

                  {form.sessionTarget === 'isolated' && (
                    <>
                      <Select
                        id="task-model"
                        labelText="Model override (optional)"
                        value={form.model}
                        onChange={e => setF({ model: e.target.value })}
                        helperText="Override the model for this task only. Useful for using a cheaper model for frequent background jobs."
                      >
                        {MODELS.map(m => <SelectItem key={m.id} value={m.id} text={m.label} />)}
                      </Select>

                      <Select
                        id="task-thinking"
                        labelText="Thinking level (optional)"
                        value={form.thinking}
                        onChange={e => setF({ thinking: e.target.value })}
                        helperText="Extended thinking level for this task. Supported models only."
                      >
                        <SelectItem value="" text="Default (inherit)" />
                        {THINKING_LEVELS.map(t => <SelectItem key={t} value={t} text={t} />)}
                      </Select>

                      <NumberInput
                        id="task-timeout"
                        label="Timeout (seconds, 0 = no limit)"
                        min={0}
                        value={form.timeoutSeconds}
                        onChange={(_e: any, { value }: any) => setF({ timeoutSeconds: Number(value) || 0 })}
                      />
                    </>
                  )}

                  <div className="agent-tasks__field-group">
                    <div className="agent-tasks__field-label">Wake Mode</div>
                    <RadioButtonGroup
                      name="wake-mode"
                      valueSelected={form.wakeMode}
                      onChange={(v: string | number) => setF({ wakeMode: String(v) as WakeMode })}
                      legendText=""
                    >
                      <RadioButton id="wake-now" labelText="Now (trigger heartbeat immediately)" value="now" />
                      <RadioButton id="wake-next" labelText="Next heartbeat (queue for next tick)" value="next-heartbeat" />
                    </RadioButtonGroup>
                  </div>
                </div>
              </TabPanel>

              {/* ── Tab 3: Delivery ── */}
              <TabPanel>
                <div className="agent-tasks__tab-content">
                  <div className="agent-tasks__field-group">
                    <div className="agent-tasks__field-label">Delivery Mode</div>
                    <div className="agent-tasks__delivery-cards">
                      <div
                        className={`agent-tasks__delivery-card ${form.deliveryMode === 'none' ? 'active' : ''}`}
                        onClick={() => setF({ deliveryMode: 'none' })}
                      >
                        <div className="agent-tasks__mode-title">None</div>
                        <div className="agent-tasks__mode-desc">Internal only. No channel delivery. Results visible in run history.</div>
                      </div>
                      <div
                        className={`agent-tasks__delivery-card ${form.deliveryMode === 'announce' ? 'active' : ''} ${form.sessionTarget !== 'isolated' ? 'disabled' : ''}`}
                        onClick={() => form.sessionTarget === 'isolated' && setF({ deliveryMode: 'announce' })}
                      >
                        <div className="agent-tasks__mode-title">Announce</div>
                        <div className="agent-tasks__mode-desc">Post results to a messaging channel (Telegram, WhatsApp, Discord…). Isolated session only.</div>
                      </div>
                      <div
                        className={`agent-tasks__delivery-card ${form.deliveryMode === 'webhook' ? 'active' : ''}`}
                        onClick={() => setF({ deliveryMode: 'webhook' })}
                      >
                        <div className="agent-tasks__mode-title">Webhook</div>
                        <div className="agent-tasks__mode-desc">POST result JSON to a URL. Use to integrate with Zapier, n8n, or your own backend.</div>
                      </div>
                    </div>
                  </div>

                  {form.deliveryMode === 'announce' && (
                    <>
                      <Select
                        id="task-channel"
                        labelText="Channel"
                        value={form.deliveryChannel}
                        onChange={e => setF({ deliveryChannel: e.target.value })}
                      >
                        {DELIVERY_CHANNELS.map(c => <SelectItem key={c} value={c} text={c.charAt(0).toUpperCase() + c.slice(1)} />)}
                        <SelectItem value="last" text="Last (auto-detect)" />
                      </Select>
                      <TextInput
                        id="task-delivery-to"
                        labelText="Recipient / Target"
                        placeholder="@channelname, +15551234567, -1001234567890"
                        helperText="Telegram: chat ID or topic (-1001234567890:topic:42). WhatsApp: E.164. Discord: channel:ID."
                        value={form.deliveryTo}
                        onChange={e => setF({ deliveryTo: e.target.value })}
                      />
                      <Toggle
                        id="task-best-effort"
                        labelText="Best effort delivery"
                        toggled={form.deliveryBestEffort}
                        onToggle={v => setF({ deliveryBestEffort: v })}
                      />
                    </>
                  )}

                  {form.deliveryMode === 'webhook' && (
                    <TextInput
                      id="task-webhook-url"
                      labelText="Webhook URL"
                      placeholder="https://your-backend.com/webhook/task-result"
                      helperText="POST receives the cron finished event as JSON. Set cron.webhookToken in gateway config to secure it."
                      value={form.deliveryTo}
                      onChange={e => setF({ deliveryTo: e.target.value })}
                    />
                  )}
                </div>
              </TabPanel>

              {/* ── Tab 4: Advanced ── */}
              <TabPanel>
                <div className="agent-tasks__tab-content">
                  <TextArea
                    id="task-description"
                    labelText="Description (optional)"
                    placeholder="Detailed notes about what this task does..."
                    value={form.description}
                    onChange={e => setF({ description: e.target.value })}
                    rows={3}
                  />
                  <div className="agent-tasks__advanced-info">
                    <div className="agent-tasks__info-row"><span className="agent-tasks__info-label">Agent ID</span><code>{agentId}</code></div>
                    <div className="agent-tasks__info-row"><span className="agent-tasks__info-label">Session key</span><code>cron:&lt;jobId&gt;</code></div>
                    <div className="agent-tasks__info-row"><span className="agent-tasks__info-label">Payload kind</span><code>{form.sessionTarget === 'isolated' ? 'agentTurn' : 'systemEvent'}</code></div>
                  </div>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </Modal>
    </div>
  );
}
