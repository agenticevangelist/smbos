'use client';

import { useState, useEffect } from 'react';
import {
  ClickableTile,
  Grid,
  Column,
  Button,
  Tag,
  Modal,
  TextInput,
  TextArea,
  MultiSelect
} from '@carbon/react';
import { Add, UserAvatar, Edit, TrashCan } from '@carbon/icons-react';

export function Agents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Failed to fetch agents', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1>Smart Agents</h1>
          <p>Configure specialized agents to handle your tasks and tools</p>
        </div>
        <Button renderIcon={Add} onClick={() => setIsModalOpen(true)}>Create Agent</Button>
      </div>

      <Grid narrow>
        {agents.map(agent => (
          <Column key={agent.id} lg={4} md={4} sm={4}>
            <ClickableTile style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <UserAvatar size={32} />
                <h3 style={{ margin: 0 }}>{agent.name}</h3>
              </div>
              <p style={{ flex: 1 }}>{agent.role}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {agent.skills.map((s: string) => <Tag key={s} type="blue">{s}</Tag>)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button hasIconOnly renderIcon={Edit} iconDescription="Edit" kind="ghost" size="sm" />
                <Button hasIconOnly renderIcon={TrashCan} iconDescription="Delete" kind="danger--ghost" size="sm" />
              </div>
            </ClickableTile>
          </Column>
        ))}
      </Grid>

      <Modal
        open={isModalOpen}
        modalHeading="Create New Agent"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextInput id="agent-name" labelText="Agent Name" placeholder="e.g., SEO Assistant" />
            <TextArea id="agent-role" labelText="Role / Instructions" placeholder="Describe what this agent should do..." />
            <MultiSelect
                id="agent-skills"
                label="Assign Skills"
                titleText="Skills"
                items={[
                    { id: 'google-maps-leads', label: 'Google Maps Leads' },
                    { id: 'web-search', label: 'Web Search' }
                ]}
                itemToString={(item: any) => (item ? item.label : '')}
            />
        </div>
      </Modal>
    </div>
  );
}
