'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { InlineLoading, Button } from '@carbon/react';
import { Renew, ArrowLeft, ArrowRight } from '@carbon/icons-react';
import ReactMarkdown from 'react-markdown';
import type { AgentPageProps } from './types';

interface MemoryFile {
  name: string;
  date: Date | null;
  label: string;
}

function parseMemoryDate(name: string): Date | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AgentMemory({ agentId }: AgentPageProps) {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'list', agentId }),
      });
      const data = await res.json();
      const rawFiles: string[] = data.ok ? (data.files || []) : [];
      const memoryFiles = rawFiles
        .filter(f => f.startsWith('memory/') && f.endsWith('.md'))
        .map(f => {
          const name = f.replace('memory/', '');
          const date = parseMemoryDate(name);
          return {
            name: f,
            date,
            label: date ? formatDate(date) : name.replace('.md', ''),
          };
        })
        .sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return a.date.getTime() - b.date.getTime();
        });
      setFiles(memoryFiles);
      if (memoryFiles.length > 0) {
        setSelectedIndex(memoryFiles.length - 1); // Default to latest
      }
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const loadContent = useCallback(async (file: MemoryFile) => {
    setContentLoading(true);
    setContent(null);
    try {
      const res = await fetch('/api/openclaw/workspace', {
        method: 'POST',
        body: JSON.stringify({ action: 'read', agentId, filePath: file.name }),
      });
      const data = await res.json();
      setContent(data.ok ? data.content : '');
    } finally {
      setContentLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (selectedIndex !== null && files[selectedIndex]) {
      loadContent(files[selectedIndex]);
    }
  }, [selectedIndex, files, loadContent]);

  // Scroll selected item into view in the timeline
  useEffect(() => {
    if (selectedIndex !== null && timelineRef.current) {
      const el = timelineRef.current.children[selectedIndex] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIndex]);

  const goBack = () => setSelectedIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
  const goNext = () => setSelectedIndex(prev => prev !== null && prev < files.length - 1 ? prev + 1 : prev);

  const selectedFile = selectedIndex !== null ? files[selectedIndex] : null;

  if (loading) return <InlineLoading description="Loading memory..." />;

  if (files.length === 0) {
    return (
      <div style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Memory</h3>
            <p style={{ fontSize: '13px', color: 'var(--cds-text-secondary)', marginTop: '4px' }}>
              Agent&apos;s persistent memory timeline.
            </p>
          </div>
          <Button kind="ghost" size="sm" hasIconOnly renderIcon={Renew} iconDescription="Refresh" onClick={loadFiles} />
        </div>
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          border: '1px dashed var(--cds-border-subtle)',
          color: 'var(--cds-text-secondary)',
        }}>
          <p style={{ margin: 0, fontSize: '13px' }}>No memory files yet. The agent will create them as it works.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Memory</h3>
          <p style={{ fontSize: '13px', color: 'var(--cds-text-secondary)', marginTop: '4px' }}>
            {files.length} memory {files.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Renew} iconDescription="Refresh" onClick={loadFiles} />
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Line */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: 0,
          right: 0,
          height: '1px',
          background: 'var(--cds-border-subtle)',
        }} />

        {/* Nav arrows + scroll container */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <button
            onClick={goBack}
            disabled={selectedIndex === 0}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              cursor: selectedIndex === 0 ? 'default' : 'pointer',
              color: selectedIndex === 0 ? 'var(--cds-text-disabled)' : 'var(--cds-text-secondary)',
              padding: '2px',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={14} />
          </button>

          <div
            ref={timelineRef}
            style={{
              display: 'flex',
              gap: '0',
              overflowX: 'auto',
              flex: 1,
              paddingBottom: '8px',
              scrollbarWidth: 'none',
            }}
          >
            {files.map((file, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 12px',
                    minWidth: '80px',
                    flexShrink: 0,
                  }}
                >
                  {/* Dot */}
                  <div style={{
                    width: isSelected ? 12 : 8,
                    height: isSelected ? 12 : 8,
                    borderRadius: '50%',
                    background: isSelected ? 'var(--cds-interactive-01)' : 'var(--cds-border-strong)',
                    border: isSelected ? '2px solid var(--cds-interactive-01)' : '2px solid var(--cds-border-strong)',
                    boxShadow: isSelected ? '0 0 8px var(--cds-interactive-01)' : 'none',
                    transition: 'all 0.15s ease',
                    marginTop: isSelected ? '2px' : '4px',
                  }} />
                  {/* Label */}
                  <span style={{
                    fontSize: '10px',
                    color: isSelected ? 'var(--cds-text-primary)' : 'var(--cds-text-secondary)',
                    fontWeight: isSelected ? 600 : 400,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.3px',
                    transition: 'color 0.15s ease',
                  }}>
                    {file.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={goNext}
            disabled={selectedIndex === files.length - 1}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              cursor: selectedIndex === files.length - 1 ? 'default' : 'pointer',
              color: selectedIndex === files.length - 1 ? 'var(--cds-text-disabled)' : 'var(--cds-text-secondary)',
              padding: '2px',
              flexShrink: 0,
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {selectedFile && (
        <div style={{
          border: '1px solid var(--cds-border-subtle)',
          padding: '1.5rem',
          minHeight: '200px',
        }}>
          {contentLoading ? (
            <InlineLoading description="Loading memory..." />
          ) : content ? (
            <div className="memory-content">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ color: 'var(--cds-text-secondary)', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
              Empty memory file.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
