'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, InlineLoading, TextArea, InlineNotification } from '@carbon/react';
import { Renew, Save, ArrowLeft, Document, Folder } from '@carbon/icons-react';
import type { AgentPageProps } from './types';

export function AgentWorkspace({ rpc, connected, agentId }: AgentPageProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'list', agentId }),
      });
      const data = await res.json();
      setFiles(data.ok ? (data.files || []) : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const openFileHandler = async (fileName: string) => {
    setFileLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'read', agentId, filePath: fileName }),
      });
      const data = await res.json();
      if (data.ok) {
        setFileContent(data.content);
        setOpenFile(fileName);
      } else {
        setError('Could not read file.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFileLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!openFile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'write', agentId, filePath: openFile, content: fileContent }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoading description="Loading workspace..." />;

  // File editor view
  if (openFile) {
    return (
      <div style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={ArrowLeft} iconDescription="Back" onClick={() => { setOpenFile(null); setSaved(false); }} />
            <h3 style={{ margin: 0 }}>{openFile}</h3>
          </div>
          <Button renderIcon={Save} size="sm" onClick={handleSaveFile} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {error && <InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} style={{ marginBottom: '1rem' }} />}
        {saved && <InlineNotification kind="success" title="Saved" onClose={() => setSaved(false)} style={{ marginBottom: '1rem' }} lowContrast />}

        {fileLoading ? <InlineLoading description="Loading file..." /> : (
          <TextArea
            labelText=""
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            rows={25}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
        )}
      </div>
    );
  }

  // File list view
  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Workspace</h3>
          <p style={{ fontSize: '13px', color: 'var(--cds-text-secondary)', marginTop: '4px' }}>
            Browse and edit files in this agent&apos;s workspace directory.
          </p>
        </div>
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Renew} iconDescription="Refresh" onClick={loadFiles} />
      </div>

      {files.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {files.map(file => (
            <button
              key={file}
              onClick={() => openFileHandler(file)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem',
                border: '1px solid var(--cds-border-subtle)',
                background: 'transparent', cursor: 'pointer',
                textAlign: 'left', fontSize: '13px', width: '100%',
              }}
            >
              <Document size={16} />
              {file}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--cds-text-secondary)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
          No files found in workspace.
        </div>
      )}
    </div>
  );
}
