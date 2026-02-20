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
  Toggle,
  Button,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { Play } from '@carbon/icons-react';

interface NanoClawTask {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  next_run: string | null;
  last_run: string | null;
  last_result: string | null;
  status: string;
  created_at: string;
}

interface TaskRunLog {
  id: number;
  task_id: string;
  run_at: string;
  duration_ms: number;
  status: string;
  result: string | null;
  error: string | null;
}

interface AgentScheduleRow {
  id: string;
  agentId: string;
  agentName: string;
  agentStatus: string;
  scheduleId: string;
  cron: string;
  action: string;
  enabled: boolean;
}

export function ScheduledTasks() {
  const [rows, setRows] = useState<AgentScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeTasks, setRuntimeTasks] = useState<NanoClawTask[]>([]);
  const [runLogs, setRunLogs] = useState<TaskRunLog[]>([]);

  const fetchRuntimeTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/nanoclaw/tasks');
      if (res.ok) {
        const data = await res.json();
        setRuntimeTasks(data.tasks || []);
        setRunLogs(data.runLogs || []);
      }
    } catch { /* silently handle */ }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const agents: Array<{ id: string; name: string; status: string }> = await res.json();

      const allRows: AgentScheduleRow[] = [];

      await Promise.all(agents.map(async (agent) => {
        try {
          const detailRes = await fetch(`/api/agents/${agent.id}`);
          if (!detailRes.ok) return;
          const detail = await detailRes.json();

          for (const schedule of detail.schedules || []) {
            allRows.push({
              id: `${agent.id}-${schedule.id}`,
              agentId: agent.id,
              agentName: detail.name || agent.id,
              agentStatus: detail.status,
              scheduleId: schedule.id,
              cron: schedule.cron,
              action: schedule.action,
              enabled: schedule.enabled,
            });
          }
        } catch { /* skip agent on error */ }
      }));

      setRows(allRows);
    } catch { /* silently handle */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchRuntimeTasks();
  }, [fetchSchedules, fetchRuntimeTasks]);

  const handleToggle = async (agentId: string, scheduleId: string, newEnabled: boolean) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, enabled: newEnabled }),
      });
      if (res.ok) {
        setRows(prev => prev.map(r =>
          r.agentId === agentId && r.scheduleId === scheduleId
            ? { ...r, enabled: newEnabled }
            : r
        ));
      }
    } catch {
      setError('Failed to update schedule');
    }
  };

  const handleManualTrigger = async (agentId: string, scheduleId: string, action: string) => {
    const rowId = `${agentId}-${scheduleId}`;
    setTriggerLoading(rowId);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to trigger');
      }
    } catch {
      setError('Failed to trigger schedule');
    } finally {
      setTriggerLoading(null);
    }
  };

  const headers = [
    { key: 'agentName', header: 'Agent' },
    { key: 'scheduleId', header: 'Schedule' },
    { key: 'cron', header: 'Cron' },
    { key: 'action', header: 'Action' },
    { key: 'enabled', header: 'Status' },
    { key: 'actions', header: '' },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading schedules..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Scheduled Tasks</h1>
        <p>Cron schedules defined in each agent&apos;s <code>config.yaml</code></p>
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

      {rows.length === 0 ? (
        <p style={{ color: 'var(--cds-text-secondary)' }}>No schedules found. Add schedules to an agent&apos;s <code>config.yaml</code> to see them here.</p>
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {tableHeaders.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });
                      return (
                        <TableHeader key={key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => {
                    const { key, ...rowProps } = getRowProps({ row });
                    const rowData = rows.find(r => r.id === row.id)!;
                    return (
                      <TableRow key={key} {...rowProps}>
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'enabled') {
                            return (
                              <TableCell key={cell.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Toggle
                                    id={`toggle-${row.id}`}
                                    size="sm"
                                    toggled={rowData.enabled}
                                    onToggle={() => handleToggle(rowData.agentId, rowData.scheduleId, !rowData.enabled)}
                                    labelA="Off"
                                    labelB="On"
                                    hideLabel
                                  />
                                  <Tag type={rowData.enabled ? 'green' : 'cool-gray'} size="sm">
                                    {rowData.enabled ? 'enabled' : 'disabled'}
                                  </Tag>
                                </div>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'cron') {
                            return (
                              <TableCell key={cell.id}>
                                <code style={{ fontSize: '0.8125rem' }}>{cell.value}</code>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'actions') {
                            return (
                              <TableCell key={cell.id}>
                                <Button
                                  hasIconOnly
                                  renderIcon={Play}
                                  iconDescription="Run now"
                                  kind="ghost"
                                  size="sm"
                                  disabled={rowData.agentStatus !== 'running' || triggerLoading === row.id}
                                  onClick={() => handleManualTrigger(rowData.agentId, rowData.scheduleId, rowData.action)}
                                />
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          );
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

      {/* NanoClaw Runtime Tasks */}
      {runtimeTasks.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3>NanoClaw Runtime Tasks</h3>
            <p style={{ color: 'var(--cds-text-secondary)' }}>Tasks scheduled via NanoClaw agents at runtime</p>
          </div>

          <DataTable
            rows={runtimeTasks.map(t => ({ ...t, id: t.id }))}
            headers={[
              { key: 'id', header: 'Task ID' },
              { key: 'group_folder', header: 'Group' },
              { key: 'schedule_type', header: 'Type' },
              { key: 'schedule_value', header: 'Schedule' },
              { key: 'status', header: 'Status' },
              { key: 'next_run', header: 'Next Run' },
              { key: 'last_result', header: 'Last Result' },
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
                      const taskData = runtimeTasks.find(t => t.id === row.id);
                      return (
                        <TableRow key={key} {...rp}>
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'status') {
                              const s = cell.value as string;
                              return (
                                <TableCell key={cell.id}>
                                  <Tag type={s === 'active' ? 'green' : s === 'paused' ? 'cool-gray' : 'blue'} size="sm">{s}</Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'next_run' || cell.info.header === 'last_result') {
                              return (
                                <TableCell key={cell.id}>
                                  <span style={{ fontSize: '0.8125rem' }}>{cell.value || '—'}</span>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'schedule_value') {
                              return (
                                <TableCell key={cell.id}>
                                  <code style={{ fontSize: '0.8125rem' }}>{cell.value}</code>
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

      {/* Recent Run Logs */}
      {runLogs.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h4>Recent Run Logs</h4>
          </div>

          <DataTable
            rows={runLogs.map(l => ({ ...l, id: String(l.id) }))}
            headers={[
              { key: 'task_id', header: 'Task' },
              { key: 'run_at', header: 'Run At' },
              { key: 'duration_ms', header: 'Duration' },
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
                                  <Tag type={s === 'success' ? 'green' : s === 'error' ? 'red' : 'cool-gray'} size="sm">{s}</Tag>
                                </TableCell>
                              );
                            }
                            if (cell.info.header === 'duration_ms') {
                              return (
                                <TableCell key={cell.id}>{cell.value ? `${cell.value}ms` : '—'}</TableCell>
                              );
                            }
                            if (cell.info.header === 'error') {
                              return (
                                <TableCell key={cell.id}>
                                  <span style={{ fontSize: '0.8125rem', color: cell.value ? 'var(--cds-text-error)' : 'var(--cds-text-secondary)' }}>
                                    {cell.value || '—'}
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
    </div>
  );
}
