'use client';

import { useState, useEffect } from 'react';
import { Grid, Column, ClickableTile, Stack, Tag } from '@carbon/react';
import {
  Activity, Group, Events,
  Analytics, Location, ShoppingCart, Chat, Download, Globe, Document,
  Star, Map, Time, Connect, DataBase, Renew, SendFilled, Store,
  UserMultiple, Add, Catalog, ChartLineData, Restaurant, Integration,
  Search, Settings, Email, Favorite, Tag as TagIcon, Terminal, Tools, User,
  UserAvatar,
} from '@carbon/icons-react';

const ICON_MAP: Record<string, React.ComponentType<{ size: number }>> = {
  Activity, Analytics, Location, ShoppingCart, Chat, Download, Globe, Document,
  Star, Map, Time, Connect, DataBase, Renew, SendFilled, Store,
  UserMultiple, Add, Catalog, ChartLineData, Restaurant, Integration,
  Search, Settings, Email, Favorite, Tag: TagIcon, Terminal, Tools, User,
  Group, Events,
};

interface DashboardProps {
  onNavigate: (page: string) => void;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string; icon: string; hidden: boolean }>>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(setSkills)
      .catch(() => {});
    fetch('/api/agents')
      .then(r => r.json())
      .then(setAgents)
      .catch(() => {});
  }, []);

  const visibleSkills = skills.filter(s => !s.hidden);

  const getIcon = (iconName: string, size: number) => {
    const IconComponent = ICON_MAP[iconName] || Activity;
    return <IconComponent size={size} />;
  };

  return (
    <div className="dashboard-page">
      <Stack gap={7}>
        <div>
          <h1 className="page-title">Welcome to SMBOS</h1>
          <p className="page-description">
            Your smart digital action interface for business automation.
          </p>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem' }}>Skills</h3>
          <Grid narrow>
            {visibleSkills.map(skill => (
              <Column key={skill.id} lg={4} md={4} sm={4}>
                <ClickableTile onClick={() => onNavigate(skill.id)} style={{ height: '100%' }}>
                  <Stack gap={4}>
                    {getIcon(skill.icon, 32)}
                    <div>
                      <h4 style={{ fontWeight: 600 }}>{skill.name}</h4>
                      <p style={{ marginTop: '8px' }}>{skill.description}</p>
                    </div>
                  </Stack>
                </ClickableTile>
              </Column>
            ))}
          </Grid>
        </div>

        {agents.length > 0 && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Agents</h3>
            <Grid narrow>
              {agents.map(agent => (
                <Column key={agent.id} lg={4} md={4} sm={4}>
                  <ClickableTile onClick={() => onNavigate('agents')} style={{ height: '100%' }}>
                    <Stack gap={3}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <UserAvatar size={24} />
                        <span style={{ fontWeight: 600 }}>{agent.name}</span>
                        <Tag type={agent.status === 'running' ? 'green' : 'cool-gray'} size="sm">
                          {agent.status}
                        </Tag>
                      </div>
                    </Stack>
                  </ClickableTile>
                </Column>
              ))}
            </Grid>
          </div>
        )}

        <div>
          <h3 style={{ marginBottom: '1rem' }}>Management</h3>
          <Grid narrow>
            <Column lg={4} md={4} sm={4}>
              <ClickableTile onClick={() => onNavigate('agents')}>
                <Stack gap={4}>
                  <Group size={32} />
                  <div>
                    <h4 style={{ fontWeight: 600 }}>Manage Agents</h4>
                    <p style={{ marginTop: '8px' }}>Configure and monitor your AI agents.</p>
                  </div>
                </Stack>
              </ClickableTile>
            </Column>
            <Column lg={4} md={4} sm={4}>
              <ClickableTile onClick={() => onNavigate('tasks')}>
                <Stack gap={4}>
                  <Events size={32} />
                  <div>
                    <h4 style={{ fontWeight: 600 }}>Scheduled Tasks</h4>
                    <p style={{ marginTop: '8px' }}>View and manage automated tasks.</p>
                  </div>
                </Stack>
              </ClickableTile>
            </Column>
          </Grid>
        </div>
      </Stack>
    </div>
  );
}
