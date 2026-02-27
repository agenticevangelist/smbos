'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  TextInput,
  Modal,
  Search,
} from '@carbon/react';
import {
  Renew,
  Chat,
  TrashCan,
  Settings,
  User,
  Bot,
  ArrowRight,
  Warning,
  Document,
} from '@carbon/icons-react';

type RpcFn = <T = any>(method: string, params?: object) => Promise<T>;

export interface AgentSessionsProps {
  agentId: string;
  rpc: RpcFn;
  connected: boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionKind = 'main' | 'group' | 'cron' | 'hook' | 'node' | 'other';
type Channel = string;

interface SessionEntry {
  key: string;
  kind: SessionKind;
  channel?: Channel;
  displayName?: string;
  updatedAt?: number;
  sessionId?: string;
  model?: string;
  contextTokens?: number;
  totalTokens?: number;
  thinkingLevel?: string;
  verboseLevel?: string;
  sendPolicy?: 'allow' | 'deny';
  lastChannel?: string;
  abortedLastRun?: boolean;
  transcriptPath?: string;
  origin?: {
    label?: string;
    provider?: string;
    from?: string;
    to?: string;
    accountId?: string;
    threadId?: string;
  };
  subject?: string;
}

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'toolResult' | 'tool';
  content: string | any[];
  aborted?: boolean;
}

interface PatchOverrides {
  thinkingLevel: string;
  verboseLevel: string;
  model: string;
  sendPolicy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ms?: number): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function absTime(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function displayName(s: SessionEntry): string {
  if (s.origin?.label) return s.origin.label;
  if (s.displayName) return s.displayName;
  if (s.subject) return s.subject;
  const parts = s.key.split(':');
  const last = parts[parts.length - 1];
  if (last === 'main') return 'Main Session';
  return last.length > 24 ? last.slice(0, 24) + '…' : last;
}

function subline(s: SessionEntry): string {
  const parts: string[] = [];
  if (s.channel && s.channel !== 'unknown') parts.push(s.channel);
  if (s.origin?.from) parts.push(s.origin.from);
  return parts.join(' · ');
}

function kindColor(kind: SessionKind): 'blue' | 'purple' | 'teal' | 'cyan' | 'magenta' | 'gray' {
  const map: Record<SessionKind, any> = {
    main: 'blue', group: 'teal', cron: 'purple', hook: 'cyan', node: 'magenta', other: 'gray',
  };
  return map[kind] ?? 'gray';
}

function extractText(msg: TranscriptMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      || '[non-text content]';
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentSessions({ agentId, rpc, connected }: AgentSessionsProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<SessionKind | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [showTools] = useState(false);

  const [patchOpen, setPatchOpen] = useState(false);
  const [patchTarget, setPatchTarget] = useState<SessionEntry | null>(null);
  const [patchForm, setPatchForm] = useState<PatchOverrides>({ thinkingLevel: '', verboseLevel: '', model: '', sendPolicy: '' });
  const [patching, setPatching] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch sessions ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 200 };
      if (kindFilter !== 'all') params.kinds = [kindFilter];
      if (activeFilter !== 'all') params.activeMinutes = parseInt(activeFilter);

      const res = await rpc<any>('sessions.list', params);
      const all: SessionEntry[] = Array.isArray(res) ? res : (res.sessions ?? res.items ?? []);

      const prefix = agentId === 'main' ? ['agent:main:', 'main'] : [`agent:${agentId}:`];
      const filtered = all.filter(s => prefix.some(p => s.key === p.slice(0, -1) || s.key.startsWith(p)));
      setSessions(filtered);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [connected, rpc, agentId, kindFilter, activeFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Transcript ──────────────────────────────────────────────────────────────

  const fetchTranscript = useCallback(async (key: string) => {
    setTranscriptLoading(true);
    setTranscriptError(null);
    setTranscript(null);
    try {
      const res = await rpc<any>('chat.history', { sessionKey: key, limit: 100 });
      const msgs: TranscriptMessage[] = Array.isArray(res) ? res : (res.messages ?? res.history ?? []);
      setTranscript(msgs);
    } catch (e: any) {
      setTranscriptError(e?.message ?? 'Failed to load transcript');
    } finally {
      setTranscriptLoading(false);
    }
  }, [rpc, showTools]);

  useEffect(() => { if (selectedKey) fetchTranscript(selectedKey); }, [selectedKey, fetchTranscript]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  // ── Patch ────────────────────────────────────────────────────────────────────

  const openPatch = (s: SessionEntry) => {
    setPatchTarget(s);
    setPatchForm({ thinkingLevel: s.thinkingLevel ?? '', verboseLevel: s.verboseLevel ?? '', model: s.model ?? '', sendPolicy: s.sendPolicy ?? '' });
    setPatchError(null);
    setPatchOpen(true);
  };

  const submitPatch = async () => {
    if (!patchTarget) return;
    setPatching(true);
    setPatchError(null);
    const patch: any = {};
    if (patchForm.thinkingLevel) patch.thinkingLevel = patchForm.thinkingLevel;
    if (patchForm.verboseLevel) patch.verboseLevel = patchForm.verboseLevel;
    if (patchForm.model) patch.model = patchForm.model;
    if (patchForm.sendPolicy) patch.sendPolicy = patchForm.sendPolicy;
    try {
      await rpc('sessions.patch', { sessionKey: patchTarget.key, patch });
      setPatchOpen(false);
      await fetchSessions();
    } catch (e: any) {
      setPatchError(e?.message ?? 'Patch failed');
    } finally {
      setPatching(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rpc('sessions.delete', { sessionKey: deleteTarget.key });
      if (selectedKey === deleteTarget.key) setSelectedKey(null);
      await fetchSessions();
    } catch { /* best effort */ } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────

  const displayed = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.key.toLowerCase().includes(q) || displayName(s).toLowerCase().includes(q) || (s.channel ?? '').toLowerCase().includes(q);
  });

  const selected = sessions.find(s => s.key === selectedKey) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="agent-sessions">
        <InlineNotification kind="warning" title="Not connected" subtitle="Connect to the gateway to view sessions." hideCloseButton />
      </div>
    );
  }

  return (
    <div className="agent-sessions">
      <div className="agent-sessions__header">
        <div className="agent-sessions__title-row">
          <h4 className="agent-sessions__title">Sessions</h4>
          <span className="agent-sessions__count">{displayed.length}</span>
        </div>
        <div className="agent-sessions__actions">
          <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Refresh" hasIconOnly onClick={fetchSessions} disabled={loading} />
        </div>
      </div>

      <div className="agent-sessions__filters">
        <Search size="sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} onClear={() => setSearch('')} labelText="Search" className="agent-sessions__search" />
        <Select id="kind-filter" labelText="" hideLabel size="sm" value={kindFilter} onChange={e => setKindFilter(e.target.value as any)} className="agent-sessions__filter-select">
          <SelectItem value="all" text="All kinds" />
          <SelectItem value="main" text="Main" />
          <SelectItem value="group" text="Group" />
          <SelectItem value="cron" text="Cron" />
          <SelectItem value="hook" text="Hook" />
          <SelectItem value="node" text="Node" />
        </Select>
        <Select id="active-filter" labelText="" hideLabel size="sm" value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className="agent-sessions__filter-select">
          <SelectItem value="all" text="All time" />
          <SelectItem value="60" text="Last 1h" />
          <SelectItem value="1440" text="Last 24h" />
          <SelectItem value="10080" text="Last 7d" />
        </Select>
      </div>

      {error && <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton style={{ marginBottom: '0.75rem' }} />}

      <div className="agent-sessions__body">
        {/* List */}
        <div className="agent-sessions__list">
          {loading && !sessions.length
            ? <div className="agent-sessions__loading"><InlineLoading description="Loading…" /></div>
            : displayed.length === 0
            ? <div className="agent-sessions__empty"><Chat size={24} /><p>No sessions</p></div>
            : displayed.map(s => (
              <button
                key={s.key}
                className={`agent-sessions__session-row ${selectedKey === s.key ? 'active' : ''}`}
                onClick={() => setSelectedKey(s.key === selectedKey ? null : s.key)}
              >
                <div className="agent-sessions__session-main">
                  <span className="agent-sessions__session-name">{displayName(s)}</span>
                  <div className="agent-sessions__session-sub">
                    <Tag type={kindColor(s.kind)} size="sm">{s.kind}</Tag>
                    {subline(s) && <span>{subline(s)}</span>}
                  </div>
                </div>
                <span className="agent-sessions__session-time">{relativeTime(s.updatedAt)}</span>
              </button>
            ))
          }
        </div>

        {/* Detail */}
        {selected && (
          <div className="agent-sessions__detail">
            <div className="agent-sessions__detail-header">
              <div className="agent-sessions__detail-title">
                <span>{displayName(selected)}</span>
                <Tag type={kindColor(selected.kind)} size="sm">{selected.kind}</Tag>
              </div>
              <div className="agent-sessions__detail-actions">
                <Button kind="ghost" size="sm" renderIcon={Settings} iconDescription="Override" hasIconOnly onClick={() => openPatch(selected)} />
                <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Delete" hasIconOnly onClick={() => { setDeleteTarget(selected); setDeleteOpen(true); }} />
                <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Reload" hasIconOnly onClick={() => fetchTranscript(selected.key)} />
              </div>
            </div>

            {/* Metadata */}
            <div className="agent-sessions__meta-table">
              {selected.origin?.label && <MetaRow label="Label" value={selected.origin.label} />}
              <MetaRow label="Key" code>{selected.key}</MetaRow>
              {selected.sessionId && <MetaRow label="Session ID" code>{selected.sessionId}</MetaRow>}
              <MetaRow label="Last active" value={absTime(selected.updatedAt)} />
              {selected.channel && selected.channel !== 'unknown' && <MetaRow label="Channel" value={selected.channel} />}
              {selected.origin?.from && <MetaRow label="From" value={selected.origin.from} />}
              {selected.model && <MetaRow label="Model" value={selected.model} />}
              {selected.thinkingLevel && <MetaRow label="Thinking" value={selected.thinkingLevel} />}
              {selected.contextTokens != null && <MetaRow label="Context" value={`${selected.contextTokens.toLocaleString()} tokens`} />}
              {selected.totalTokens != null && <MetaRow label="Total" value={`${selected.totalTokens.toLocaleString()} tokens`} />}
              {selected.sendPolicy && (
                <div className="agent-sessions__meta-row">
                  <span className="agent-sessions__meta-label">Send policy</span>
                  <span className={`agent-sessions__policy--${selected.sendPolicy}`}>
                    {selected.sendPolicy === 'allow' ? 'allow' : 'deny'}
                  </span>
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="agent-sessions__transcript-header">
              <span className="agent-sessions__transcript-label">Transcript</span>
              <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Reload" hasIconOnly onClick={() => fetchTranscript(selected.key)} />
            </div>

            <div className="agent-sessions__transcript">
              {transcriptLoading ? (
                <div className="agent-sessions__transcript-state"><InlineLoading description="Loading transcript…" /></div>
              ) : transcriptError ? (
                <div className="agent-sessions__transcript-state" style={{ color: 'var(--cds-support-error)' }}>
                  <Warning size={16} /><p>{transcriptError}</p>
                </div>
              ) : !transcript?.length ? (
                <div className="agent-sessions__transcript-state"><Document size={20} /><p>No messages</p></div>
              ) : (
                transcript.map((msg, i) => {
                  const role = msg.role;
                  const text = extractText(msg);
                  const roleLabel = role === 'user' ? 'User' : role === 'assistant' ? 'Assistant' : 'Tool';
                  const Icon = role === 'user' ? User : role === 'assistant' ? Bot : ArrowRight;
                  return (
                    <div key={i} className={`agent-sessions__msg agent-sessions__msg--${role} ${msg.aborted ? 'agent-sessions__msg--aborted' : ''}`}>
                      <div className="agent-sessions__msg-header">
                        <Icon size={12} />
                        <span>{roleLabel}</span>
                        {msg.aborted && <span className="agent-sessions__msg-aborted">· aborted</span>}
                      </div>
                      <div className="agent-sessions__msg-body">
                        {text || <span className="agent-sessions__msg-empty">[empty]</span>}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      {/* Patch Modal */}
      <Modal
        open={patchOpen}
        modalHeading="Override session"
        primaryButtonText={patching ? 'Saving…' : 'Save'}
        secondaryButtonText="Cancel"
        onRequestClose={() => setPatchOpen(false)}
        onRequestSubmit={submitPatch}
        primaryButtonDisabled={patching}
        size="sm"
      >
        {patchError && <InlineNotification kind="error" title="Error" subtitle={patchError} hideCloseButton style={{ marginBottom: '1rem' }} />}
        <div className="agent-sessions__patch-form">
          <Select id="patch-thinking" labelText="Thinking" size="sm" value={patchForm.thinkingLevel} onChange={e => setPatchForm(f => ({ ...f, thinkingLevel: e.target.value }))}>
            <SelectItem value="" text="Inherit" />
            <SelectItem value="none" text="None" />
            <SelectItem value="low" text="Low" />
            <SelectItem value="medium" text="Medium" />
            <SelectItem value="high" text="High" />
            <SelectItem value="max" text="Max" />
          </Select>
          <Select id="patch-verbose" labelText="Verbose" size="sm" value={patchForm.verboseLevel} onChange={e => setPatchForm(f => ({ ...f, verboseLevel: e.target.value }))}>
            <SelectItem value="" text="Inherit" />
            <SelectItem value="0" text="Silent" />
            <SelectItem value="1" text="Normal" />
            <SelectItem value="2" text="Verbose" />
          </Select>
          <TextInput id="patch-model" labelText="Model" size="sm" placeholder="Leave empty to inherit" value={patchForm.model} onChange={e => setPatchForm(f => ({ ...f, model: e.target.value }))} />
          <Select id="patch-send" labelText="Send policy" size="sm" value={patchForm.sendPolicy} onChange={e => setPatchForm(f => ({ ...f, sendPolicy: e.target.value }))}>
            <SelectItem value="" text="Inherit from config" />
            <SelectItem value="allow" text="Allow" />
            <SelectItem value="deny" text="Deny" />
          </Select>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteOpen}
        modalHeading="Delete session?"
        danger
        primaryButtonText={deleting ? 'Deleting…' : 'Delete'}
        secondaryButtonText="Cancel"
        onRequestClose={() => setDeleteOpen(false)}
        onRequestSubmit={confirmDelete}
        primaryButtonDisabled={deleting}
        size="sm"
      >
        <p style={{ marginBottom: '0.75rem' }}>The session entry will be removed. The JSONL transcript is renamed with a <code>.deleted</code> suffix and kept on disk.</p>
        {deleteTarget && <code style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>{deleteTarget.key}</code>}
      </Modal>
    </div>
  );
}

// ─── MetaRow helper ───────────────────────────────────────────────────────────

function MetaRow({ label, value, code, children }: { label: string; value?: string; code?: boolean; children?: React.ReactNode }) {
  return (
    <div className="agent-sessions__meta-row">
      <span className="agent-sessions__meta-label">{label}</span>
      {code
        ? <code className="agent-sessions__meta-code">{children ?? value}</code>
        : <span className="agent-sessions__meta-value">{children ?? value}</span>
      }
    </div>
  );
}
