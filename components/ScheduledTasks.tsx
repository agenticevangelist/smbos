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
  Stack,
} from '@carbon/react';
import { Add, Play, Pause, TrashCan, Renew } from '@carbon/icons-react';

type RpcFn = <T = any>(method: string, params?: object) => Promise<T>;

interface ScheduledTasksProps {
  agentIds?: string[];
  rpc: RpcFn;
  connected: boolean;
}

export function ScheduledTasks({ agentIds, rpc, connected }: ScheduledTasksProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formCron, setFormCron] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formAgentId, setFormAgentId] = useState(() => agentIds?.length === 1 ? agentIds[0] : '');
  const [formSessionTarget, setFormSessionTarget] = useState<'main' | 'isolated'>('isolated');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formSaving, setFormSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!connected) return;
    try {
      setIsLoading(true);
      const res = await rpc<any>('cron.list');

      // cron.list returns { jobs: [...] } or just an array
      let jobs = Array.isArray(res) ? res : (res?.jobs ?? []);

      if (agentIds && agentIds.length > 0) {
        jobs = jobs.filter((job: any) => agentIds.includes(job.agentId));
      }

      const rows = jobs.map((job: any) => ({
        id: job.jobId || job.id || String(Math.random()),
        agentId: job.agentId || 'default',
        name: job.name || 'Untitled',
        schedule: job.schedule?.kind === 'cron'
          ? job.schedule.expr
          : job.schedule?.kind === 'every'
          ? `every ${job.schedule.interval}`
          : job.schedule?.at || '-',
        status: job.enabled !== false ? 'active' : 'inactive',
        enabled: job.enabled !== false,
        nextRun: job.nextRunAt
          ? new Date(job.nextRunAt).toLocaleString()
          : '-',
      }));

      setTasks(rows);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [connected, rpc, agentIds]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleEnabled = async (jobId: string, currentEnabled: boolean) => {
    try {
      await rpc('cron.update', { jobId, enabled: !currentEnabled });
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRunNow = async (jobId: string) => {
    try {
      await rpc('cron.run', { jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this scheduled task?')) return;
    try {
      await rpc('cron.remove', { jobId });
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreate = async () => {
    if (!formName || !formCron || !formMessage) return;
    setFormSaving(true);
    setError(null);

    try {
      await rpc('cron.add', {
        name: formName,
        schedule: {
          kind: 'cron',
          expr: formCron,
        },
        ...(formAgentId ? { agentId: formAgentId } : {}),
        sessionTarget: formSessionTarget,
        enabled: formEnabled,
        payload: {
          kind: formSessionTarget === 'isolated' ? 'agentTurn' : 'systemEvent',
          ...(formSessionTarget === 'isolated'
            ? { message: formMessage }
            : { text: formMessage }),
        },
      });

      setIsModalOpen(false);
      resetForm();
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormSaving(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCron('');
    setFormMessage('');
    setFormAgentId(agentIds?.length === 1 ? agentIds[0] : '');
    setFormSessionTarget('isolated');
    setFormEnabled(true);
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'agentId', header: 'Agent' },
    { key: 'schedule', header: 'Schedule' },
    { key: 'status', header: 'Status' },
    { key: 'nextRun', header: 'Next Run' },
  ];

  if (!connected) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineNotification kind="warning" title="Disconnected" subtitle="Connect to Gateway to view tasks." hideCloseButton />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h4 style={{ margin: 0 }}>{agentIds ? 'Agent Tasks' : 'Scheduled Tasks'}</h4>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button kind="ghost" hasIconOnly renderIcon={Renew} iconDescription="Refresh" onClick={fetchTasks} size="sm" />
          <Button renderIcon={Add} onClick={() => setIsModalOpen(true)} size="sm">Create Task</Button>
        </div>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onClose={() => setError(null)}
          style={{ marginBottom: '0.5rem' }}
        />
      )}

      {isLoading && <InlineLoading description="Loading tasks..." />}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <DataTable rows={tasks} headers={headers} isSortable>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()} size="sm" isSortable>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => {
                      const { key, ...headerProps } = getHeaderProps({ header });
                      return (
                        <TableHeader key={key} {...headerProps}>
                          {header.header}
                        </TableHeader>
                      );
                    })}
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={headers.length + 1} style={{ textAlign: 'center', color: 'var(--cds-text-secondary)' }}>
                        No scheduled tasks found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const task = tasks.find(t => t.id === row.id);
                      return (
                        <TableRow key={row.id} {...(() => { const { key, ...rp } = getRowProps({ row }); return rp; })()}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'status' ? (
                                <Tag type={cell.value === 'active' ? 'green' : 'gray'} size="sm">{cell.value}</Tag>
                              ) : cell.value}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <Button
                                hasIconOnly
                                renderIcon={task?.enabled ? Pause : Play}
                                iconDescription={task?.enabled ? 'Disable' : 'Enable'}
                                kind="ghost"
                                size="sm"
                                onClick={() => handleToggleEnabled(row.id, task?.enabled ?? true)}
                              />
                              <Button
                                hasIconOnly
                                renderIcon={Play}
                                iconDescription="Run Now"
                                kind="ghost"
                                size="sm"
                                onClick={() => handleRunNow(row.id)}
                              />
                              <Button
                                hasIconOnly
                                renderIcon={TrashCan}
                                iconDescription="Delete"
                                kind="danger--ghost"
                                size="sm"
                                onClick={() => handleDelete(row.id)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </div>

      <Modal
        open={isModalOpen}
        modalHeading="Create Scheduled Task"
        primaryButtonText={formSaving ? 'Creating...' : 'Create'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={formSaving || !formName || !formCron || !formMessage}
        onRequestClose={() => { setIsModalOpen(false); resetForm(); }}
        onRequestSubmit={handleCreate}
      >
        <Stack gap={5}>
          <TextInput
            id="task-name"
            labelText="Task Name"
            placeholder="e.g. Morning briefing"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <TextInput
            id="task-cron"
            labelText="Cron Expression"
            placeholder="0 7 * * *"
            helperText="5-field cron: minute hour day month weekday. Example: '0 7 * * *' = daily at 7 AM."
            value={formCron}
            onChange={(e) => setFormCron(e.target.value)}
          />
          <TextArea
            id="task-message"
            labelText="Message / Prompt"
            placeholder="Summarize overnight updates and send me a briefing."
            helperText="The message or system event text the agent will receive."
            value={formMessage}
            onChange={(e) => setFormMessage(e.target.value)}
            rows={3}
          />
          {agentIds && agentIds.length === 1 ? (
            <TextInput
              id="task-agent"
              labelText="Agent ID"
              value={agentIds[0]}
              disabled
            />
          ) : (
            <TextInput
              id="task-agent"
              labelText="Agent ID"
              placeholder="main"
              helperText="Leave empty for default agent."
              value={formAgentId}
              onChange={(e) => setFormAgentId(e.target.value)}
            />
          )}
          <Select
            id="task-session"
            labelText="Session Target"
            value={formSessionTarget}
            onChange={(e) => setFormSessionTarget(e.target.value as 'main' | 'isolated')}
            helperText="'Isolated' creates a dedicated session. 'Main' uses the agent's main session."
          >
            <SelectItem value="isolated" text="Isolated (dedicated session)" />
            <SelectItem value="main" text="Main (shared session)" />
          </Select>
          <Toggle
            id="task-enabled"
            labelText="Enabled"
            toggled={formEnabled}
            onToggle={(checked) => setFormEnabled(checked)}
          />
        </Stack>
      </Modal>
    </div>
  );
}
