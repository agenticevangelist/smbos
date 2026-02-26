'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Tag,
  InlineLoading,
  Button,
  TextInput,
  Select,
  SelectItem,
  Modal,
} from '@carbon/react';
import { Add, Play, TrashCan, Renew } from '@carbon/icons-react';

interface CronJob {
  id: string;
  name?: string;
  kind: 'at' | 'every' | 'cron';
  schedule: string;
  sessionTarget: 'main' | 'isolated';
  enabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  agentId?: string;
  message?: string;
}

interface CronRun {
  id: string;
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: 'success' | 'error' | 'running';
  error?: string;
}

export function ScheduledTasks() {
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'cron' | 'every' | 'at'>('cron');
  const [newSchedule, setNewSchedule] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newSessionTarget, setNewSessionTarget] = useState<'main' | 'isolated'>('isolated');

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/tasks');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* silently handle */ }
    finally { setIsLoading(false); }
  }, []);

  const fetchRuns = useCallback(async (jobId: string) => {
    try {
      const res = await fetch('/api/openclaw/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'runs', id: jobId, limit: 20 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRuns(prev => [...prev.filter(r => r.jobId !== jobId), ...(data.runs || [])]);
      }
    } catch { /* silently handle */ }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Fetch runs for all jobs once loaded
  useEffect(() => {
    jobs.forEach(j => fetchRuns(j.id));
  }, [jobs, fetchRuns]);

  const handleCreate = async () => {
    if (!newSchedule || !newMessage) return;

    try {
      const res = await fetch('/api/openclaw/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: newName || undefined,
          kind: newKind,
          schedule: newSchedule,
          message: newMessage,
          sessionTarget: newSessionTarget,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewName('');
        setNewSchedule('');
        setNewMessage('');
        await fetchJobs();
      }
    } catch { /* silently handle */ }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await fetch('/api/openclaw/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', id: jobId }),
      });
      await fetchJobs();
    } catch { /* silently handle */ }
  };

  const handleRun = async (jobId: string) => {
    try {
      await fetch('/api/openclaw/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', id: jobId }),
      });
      setTimeout(() => fetchRuns(jobId), 2000);
    } catch { /* silently handle */ }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading tasks..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Scheduled Tasks</h1>
          <p style={{ color: 'var(--cds-text-secondary)' }}>
            Cron jobs managed by OpenClaw gateway
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            kind="ghost"
            renderIcon={Renew}
            size="sm"
            onClick={fetchJobs}
          >
            Refresh
          </Button>
          <Button
            renderIcon={Add}
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            Create Job
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          No scheduled tasks. Create one or let agents use the <code>cron</code> tool.
        </p>
      ) : (
        <DataTable
          rows={jobs.map(j => ({ ...j, id: j.id }))}
          headers={[
            { key: 'name', header: 'Name' },
            { key: 'kind', header: 'Type' },
            { key: 'schedule', header: 'Schedule' },
            { key: 'enabled', header: 'Status' },
            { key: 'sessionTarget', header: 'Session' },
            { key: 'nextRunAt', header: 'Next Run' },
            { key: 'actions', header: '' },
          ]}
        >
          {({ rows: tRows, headers: tHeaders, getHeaderProps, getRowProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {tHeaders.map((header) => {
                      const { key, ...hp } = getHeaderProps({ header });
                      return <TableHeader key={key} {...hp}>{header.header}</TableHeader>;
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tRows.map((row) => {
                    const { key, ...rp } = getRowProps({ row });
                    const job = jobs.find(j => j.id === row.id);
                    return (
                      <TableRow key={key} {...rp}>
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'name') {
                            return (
                              <TableCell key={cell.id}>
                                {cell.value || job?.id?.slice(0, 8)}
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'kind') {
                            return (
                              <TableCell key={cell.id}>
                                <Tag type="cool-gray" size="sm">{cell.value}</Tag>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'schedule') {
                            return (
                              <TableCell key={cell.id}>
                                <code style={{ fontSize: '0.8125rem' }}>{cell.value}</code>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'enabled') {
                            return (
                              <TableCell key={cell.id}>
                                <Tag type={cell.value ? 'green' : 'red'} size="sm">
                                  {cell.value ? 'active' : 'disabled'}
                                </Tag>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'sessionTarget') {
                            return (
                              <TableCell key={cell.id}>
                                <Tag type="blue" size="sm">{cell.value}</Tag>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'nextRunAt') {
                            return (
                              <TableCell key={cell.id}>
                                <span style={{ fontSize: '0.8125rem' }}>
                                  {cell.value ? new Date(cell.value).toLocaleString() : '\u2014'}
                                </span>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'actions') {
                            return (
                              <TableCell key={cell.id}>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <Button
                                    hasIconOnly
                                    renderIcon={Play}
                                    iconDescription="Run now"
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => handleRun(row.id)}
                                  />
                                  <Button
                                    hasIconOnly
                                    renderIcon={TrashCan}
                                    iconDescription="Delete"
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(row.id)}
                                  />
                                </div>
                              </TableCell>
                            );
                          }
                          return <TableCell key={cell.id}>{cell.value}</TableCell>;
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      {/* Recent Run Logs */}
      {runs.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h4>Recent Run Logs</h4>
          </div>

          <DataTable
            rows={runs.slice(0, 20).map((r, i) => ({ ...r, id: r.id || String(i) }))}
            headers={[
              { key: 'jobId', header: 'Job' },
              { key: 'startedAt', header: 'Started' },
              { key: 'durationMs', header: 'Duration' },
              { key: 'status', header: 'Status' },
              { key: 'error', header: 'Error' },
            ]}
          >
            {({ rows: lRows, headers: lHeaders, getHeaderProps, getRowProps, getTableProps }) => (
              <TableContainer>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {lHeaders.map((header) => {
                        const { key, ...hp } = getHeaderProps({ header });
                        return <TableHeader key={key} {...hp}>{header.header}</TableHeader>;
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lRows.map((row) => {
                      const { key, ...rp } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...rp}>
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'status') {
                              const s = cell.value as string;
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={s === 'success' ? 'green' : s === 'error' ? 'red' : 'blue'} size="sm">{s}</Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'durationMs') {
                              return (
                                <TableCell key={cell.id}>{cell.value ? `${cell.value}ms` : '\u2014'}</TableCell>
                              );
                            }
                            if (cell.info.header === 'startedAt') {
                              return (
                                <TableCell key={cell.id}>
                                  {cell.value ? new Date(cell.value).toLocaleString() : '\u2014'}
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'error') {
                              return (
                                <TableCell key={cell.id}>
                                  <span style={{ fontSize: '0.8125rem', color: cell.value ? 'var(--cds-text-error)' : 'var(--cds-text-secondary)' }}>
                                    {cell.value || '\u2014'}
                                  </span>
                                </TableCell>
                              );
                            }
                            return <TableCell key={cell.id}>{cell.value}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </div>
      )}

      {/* Create Job Modal */}
      <Modal
        open={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
        onRequestSubmit={handleCreate}
        modalHeading="Create Cron Job"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!newSchedule || !newMessage}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
          <TextInput
            id="job-name"
            labelText="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Daily briefing"
          />
          <Select
            id="job-kind"
            labelText="Schedule type"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as 'cron' | 'every' | 'at')}
          >
            <SelectItem value="cron" text="Cron expression" />
            <SelectItem value="every" text="Interval (ms)" />
            <SelectItem value="at" text="One-shot (ISO 8601)" />
          </Select>
          <TextInput
            id="job-schedule"
            labelText="Schedule"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            placeholder={newKind === 'cron' ? '0 7 * * *' : newKind === 'every' ? '3600000' : '2026-03-01T09:00:00Z'}
            helperText={
              newKind === 'cron' ? 'Standard 5-field cron expression' :
              newKind === 'every' ? 'Interval in milliseconds' :
              'ISO 8601 timestamp'
            }
          />
          <TextInput
            id="job-message"
            labelText="Message / Prompt"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Give me a morning briefing"
          />
          <Select
            id="job-session"
            labelText="Session target"
            value={newSessionTarget}
            onChange={(e) => setNewSessionTarget(e.target.value as 'main' | 'isolated')}
          >
            <SelectItem value="isolated" text="Isolated (fresh session per run)" />
            <SelectItem value="main" text="Main (shared conversation)" />
          </Select>
        </div>
      </Modal>
    </div>
  );
}
