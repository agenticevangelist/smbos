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
} from '@carbon/react';

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

export function ScheduledTasks() {
  const [isLoading, setIsLoading] = useState(true);
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
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchRuntimeTasks();
  }, [fetchRuntimeTasks]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading tasks..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Scheduled Tasks</h1>
        <p style={{ color: 'var(--cds-text-secondary)' }}>Tasks scheduled by NanoClaw agents at runtime via MCP tools</p>
      </div>

      {runtimeTasks.length === 0 ? (
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          No scheduled tasks. Agents can create tasks using the <code>schedule_task</code> MCP tool.
        </p>
      ) : (
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
                                <span style={{ fontSize: '0.8125rem' }}>{cell.value || '\u2014'}</span>
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
                                <TableCell key={cell.id}>{cell.value ? `${cell.value}ms` : '\u2014'}</TableCell>
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
    </div>
  );
}
