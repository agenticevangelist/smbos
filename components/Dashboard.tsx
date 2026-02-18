'use client';

import { useState, useEffect } from 'react';
import { Grid, Column, ClickableTile, Stack, Tag } from '@carbon/react';
import { Activity, Group, Events } from '@carbon/icons-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string; icon: string; hidden: boolean }>>([]);

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(setSkills)
      .catch(() => {});
  }, []);

  const visibleSkills = skills.filter(s => !s.hidden);

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
                    <Activity size={32} />
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
