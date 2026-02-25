'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, TextArea, InlineLoading, InlineNotification, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Save } from '@carbon/icons-react';
import type { AgentPageProps } from './types';

const SOUL_FILES = [
  { name: 'SOUL.md', label: 'Soul', description: 'Persona, tone, boundaries, core truths.' },
  { name: 'IDENTITY.md', label: 'Identity', description: 'Agent name, vibe, emoji, avatar.' },
  { name: 'AGENTS.md', label: 'Instructions', description: 'Operating instructions and memory rules.' },
  { name: 'USER.md', label: 'User Profile', description: 'Who the user is, how to address them.' },
  { name: 'HEARTBEAT.md', label: 'Heartbeat', description: 'Proactive check-in checklist.' },
];

export function AgentSoul({ rpc, connected, agentId }: AgentPageProps) {
  const [files, setFiles] = useState<Record<string, { content: string; exists: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results: Record<string, { content: string; exists: boolean }> = {};
    await Promise.all(
      SOUL_FILES.map(async (sf) => {
        try {
          const res = await fetch('/api/openclaw/workspace', {
            method: 'POST',
            body: JSON.stringify({ action: 'read', agentId, filePath: sf.name }),
          });
          const data = await res.json();
          results[sf.name] = { content: data.ok ? data.content : '', exists: data.ok };
        } catch {
          results[sf.name] = { content: '', exists: false };
        }
      })
    );
    setFiles(results);
    setLoading(false);
  }, [agentId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSave = async (fileName: string) => {
    setSaving(fileName);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'write', agentId, filePath: fileName, content: files[fileName]?.content ?? '' }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(fileName);
      setFiles(prev => ({ ...prev, [fileName]: { ...prev[fileName], exists: true } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const updateContent = (fileName: string, content: string) => {
    setFiles(prev => ({ ...prev, [fileName]: { ...prev[fileName], content } }));
  };

  if (loading) return <InlineLoading description="Loading workspace files..." />;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Soul &amp; Identity</h3>
        <p style={{ fontSize: '14px', color: 'var(--cds-text-secondary)', marginTop: '6px' }}>
          Edit the core personality files in this agent&apos;s workspace.
        </p>
      </div>

      {error && <InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} style={{ marginBottom: '1rem' }} />}
      {saved && <InlineNotification kind="success" title="Saved" subtitle={`${saved} saved successfully.`} onClose={() => setSaved(null)} style={{ marginBottom: '1rem' }} lowContrast />}

      <Tabs>
        <TabList aria-label="Soul Files">
          {SOUL_FILES.map(sf => (
            <Tab key={sf.name}>
              {sf.label}
              {!files[sf.name]?.exists && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: '11px' }}>(new)</span>}
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {SOUL_FILES.map(sf => (
            <TabPanel key={sf.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '13px', color: 'var(--cds-text-secondary)' }}>
                  <code>{sf.name}</code> — {sf.description}
                </div>
                <Button
                  renderIcon={Save}
                  size="sm"
                  onClick={() => handleSave(sf.name)}
                  disabled={saving === sf.name}
                >
                  {saving === sf.name ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <TextArea
                labelText=""
                value={files[sf.name]?.content ?? ''}
                onChange={(e) => updateContent(sf.name, e.target.value)}
                rows={22}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
                placeholder={`# ${sf.label}\n\nWrite your ${sf.label.toLowerCase()} content here...`}
              />
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
}
