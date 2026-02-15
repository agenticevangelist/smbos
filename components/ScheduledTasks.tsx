'use client';

import { useState, useEffect } from 'react';
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
  TextInput,
  Select,
  SelectItem
} from '@carbon/react';
import { Add, Play, Pause, TrashCan } from '@carbon/icons-react';

export function ScheduledTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/scheduled-tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const headers = [
    { key: 'agentId', header: 'Agent' },
    { key: 'skillId', header: 'Skill' },
    { key: 'cron', header: 'Schedule' },
    { key: 'status', header: 'Status' },
    { key: 'nextRun', header: 'Next Run' },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1>Scheduled Tasks</h1>
          <p>Automate your workflows with recurring tool executions</p>
        </div>
        <Button renderIcon={Add} onClick={() => setIsModalOpen(true)}>Create Task</Button>
      </div>

      <DataTable rows={tasks} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
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
                {rows.map((row) => {
                   const { key, ...rowProps } = getRowProps({ row });
                   return (
                    <TableRow key={key} {...rowProps}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.info.header === 'status' ? (
                            <Tag type={cell.value === 'active' ? 'green' : 'gray'}>{cell.value}</Tag>
                          ) : cell.value}
                        </TableCell>
                      ))}
                      <TableCell>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button hasIconOnly renderIcon={Play} iconDescription="Run Now" kind="ghost" size="sm" />
                              <Button hasIconOnly renderIcon={Pause} iconDescription="Pause" kind="ghost" size="sm" />
                              <Button hasIconOnly renderIcon={TrashCan} iconDescription="Delete" kind="danger--ghost" size="sm" />
                          </div>
                      </TableCell>
                    </TableRow>
                   );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Modal
        open={isModalOpen}
        modalHeading="Schedule New Task"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select id="agent-select" labelText="Select Agent">
                <SelectItem value="lead-gen" text="Lead Generation Expert" />
                <SelectItem value="researcher" text="Market Researcher" />
            </Select>
            <Select id="skill-select" labelText="Select Skill">
                <SelectItem value="google-maps" text="Google Maps Leads" />
                <SelectItem value="web-search" text="Web Search" />
            </Select>
            <TextInput id="cron-input" labelText="Schedule (Cron or Preset)" placeholder="e.g., Every weekday at 9am" />
            <TextInput id="params-input" labelText="Parameters (JSON)" placeholder='{"query": "clothing", "location": "Yerevan"}' />
        </div>
      </Modal>
    </div>
  );
}
