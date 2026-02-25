'use client';

import { useState, useEffect } from 'react';
import { Grid, Column, ClickableTile, Stack, Tag, InlineLoading } from '@carbon/react';
import { Activity, Group, Events, Chat, ConnectionSignal, Plug } from '@carbon/icons-react';

type RpcFn = <T = any>(method: string, params?: object) => Promise<T>;

interface DashboardProps {
  onNavigate: (page: string) => void;
  rpc?: RpcFn;
  connected?: boolean;
}

export function Dashboard({ onNavigate, rpc, connected }: DashboardProps) {
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [cronCount, setCronCount] = useState<number | null>(null);
  const [channelNames, setChannelNames] = useState<string[]>([]);

  useEffect(() => {
    if (!connected || !rpc) return;

    rpc<any>('config.get', {}).then(res => {
      const parsed = res.parsed ?? (res.raw ? JSON.parse(res.raw) : {});
      const agents = parsed.agents?.list ?? [];
      setAgentCount(agents.length || 1);

      // Count configured channels
      const channelKeys = Object.keys(parsed.channels || {}).filter(
        k => k !== 'defaults' && k !== 'modelByChannel'
      );
      setChannelCount(channelKeys.length);
      setChannelNames(channelKeys);
    }).catch(() => {});

    rpc<any>('cron.list').then(res => {
      const jobs = Array.isArray(res) ? res : (res?.jobs ?? []);
      setCronCount(jobs.length);
    }).catch(() => setCronCount(0));
  }, [connected, rpc]);

  return (
    <div className="dashboard-page">
      <Stack gap={7}>
        <div>
          <h1 className="page-title">Welcome to SMBOS</h1>
          <p className="page-description">
            Your smart digital action interface for business automation.
          </p>
          {connected ? (
            <Tag type="green" size="sm" style={{ marginTop: '0.5rem' }}>Gateway Connected</Tag>
          ) : (
            <Tag type="gray" size="sm" style={{ marginTop: '0.5rem' }}>Gateway Disconnected</Tag>
          )}
        </div>

        <Grid narrow>
          <Column lg={4} md={4} sm={4}>
            <ClickableTile onClick={() => onNavigate('google-maps-leads')}>
              <Stack gap={4}>
                <Activity size={32} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>Google Maps Leads</h4>
                  <p style={{ marginTop: '8px', color: 'var(--cds-text-secondary)', fontSize: '14px' }}>Find and manage business leads from Google Maps.</p>
                </div>
              </Stack>
            </ClickableTile>
          </Column>
          <Column lg={4} md={4} sm={4}>
            <ClickableTile onClick={() => {
              // Navigate to first agent or agents list
              onNavigate('agent-main');
            }}>
              <Stack gap={4}>
                <Group size={32} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>Agents</h4>
                  <p style={{ marginTop: '8px', color: 'var(--cds-text-secondary)', fontSize: '14px' }}>
                    {agentCount !== null
                      ? `${agentCount} agent${agentCount !== 1 ? 's' : ''} configured`
                      : 'Manage your AI agents'}
                  </p>
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
                  <p style={{ marginTop: '8px', color: 'var(--cds-text-secondary)', fontSize: '14px' }}>
                    {cronCount !== null
                      ? `${cronCount} task${cronCount !== 1 ? 's' : ''} scheduled`
                      : 'View and manage automated tasks'}
                  </p>
                </div>
              </Stack>
            </ClickableTile>
          </Column>
          <Column lg={4} md={4} sm={4}>
            <ClickableTile onClick={() => {}}>
              <Stack gap={4}>
                <Plug size={32} />
                <div>
                  <h4 style={{ fontWeight: 600 }}>Channels</h4>
                  <p style={{ marginTop: '8px', color: 'var(--cds-text-secondary)', fontSize: '14px' }}>
                    {channelCount !== null
                      ? `${channelCount} channel${channelCount !== 1 ? 's' : ''}: ${channelNames.join(', ') || 'none'}`
                      : 'View connected messaging channels'}
                  </p>
                </div>
              </Stack>
            </ClickableTile>
          </Column>
        </Grid>
      </Stack>
    </div>
  );
}
