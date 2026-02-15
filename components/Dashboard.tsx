'use client';

import { Grid, Column, ClickableTile, Stack } from '@carbon/react';
import { Activity, Group, Events, Favorite } from '@carbon/icons-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="dashboard-page">
      <Stack gap={7}>
        <div>
          <h1 className="page-title">Welcome to SMBOS</h1>
          <p className="page-description">
            Your smart digital action interface for business automation.
          </p>
        </div>

        <Grid narrow>
          <Column lg={4} md={4} sm={4}>
            <ClickableTile onClick={() => onNavigate('google-maps-leads')}>
              <Stack gap={4}>
                <Activity size={32} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>Google Maps Leads</h4>
                  <p style={{ marginTop: '8px' }}>Find and manage business leads from Google Maps.</p>
                </div>
              </Stack>
            </ClickableTile>
          </Column>
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
          <Column lg={4} md={4} sm={4}>
            <ClickableTile onClick={() => {}}>
              <Stack gap={4}>
                <Favorite size={32} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>System Analytics</h4>
                  <p style={{ marginTop: '8px' }}>Track performance and usage across skills.</p>
                </div>
              </Stack>
            </ClickableTile>
          </Column>
        </Grid>
      </Stack>
    </div>
  );
}
