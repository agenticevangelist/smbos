'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TextArea,
  Button,
  InlineLoading,
  Select,
  SelectItem,
} from '@carbon/react';
import { Send, Chat, CircleFilled, TrashCan } from '@carbon/icons-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentOption {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  port?: number;
}

function getChatKey(agentId: string): string {
  return `smbos_chat_${agentId}`;
}

function loadMessages(agentId: string): ChatMessage[] {
  if (!agentId) return [];
  try {
    const raw = localStorage.getItem(getChatKey(agentId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(agentId: string, messages: ChatMessage[]): void {
  if (!agentId) return;
  // Keep last 200 messages to avoid localStorage bloat
  const trimmed = messages.slice(-200);
  localStorage.setItem(getChatKey(agentId), JSON.stringify(trimmed));
}

export function AgentChat() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data: AgentOption[] = await res.json();
        setAgents(data);
        if (!selectedAgentId || !data.find(a => a.id === selectedAgentId)) {
          const running = data.find(a => a.status === 'running');
          if (running) setSelectedAgentId(running.id);
          else if (data.length > 0) setSelectedAgentId(data[0].id);
        }
      }
    } catch { /* silently handle */ }
  }, [selectedAgentId]);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  // Restore messages from localStorage when agent changes
  useEffect(() => {
    if (selectedAgentId) {
      setMessages(loadMessages(selectedAgentId));
    }
  }, [selectedAgentId]);

  // Persist messages to localStorage on change
  useEffect(() => {
    if (selectedAgentId && messages.length > 0) {
      saveMessages(selectedAgentId, messages);
    }
  }, [messages, selectedAgentId]);

  // Health check via NanoClaw's GET /api/health
  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const agentUrl = selectedAgent?.port ? `http://127.0.0.1:${selectedAgent.port}` : null;

  // Load chat history from NanoClaw when agent becomes healthy
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!agentUrl || selectedAgent?.status !== 'running') {
      setIsHealthy(false);
      return;
    }

    let cancelled = false;

    const checkHealth = async () => {
      try {
        const res = await fetch(`${agentUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setIsHealthy(res.ok);
      } catch {
        if (!cancelled) setIsHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [agentUrl, selectedAgent?.status]);

  // Fetch history from NanoClaw when healthy
  useEffect(() => {
    if (!agentUrl || !isHealthy || historyLoaded) return;

    fetch(`${agentUrl}/api/messages?limit=200`, { signal: AbortSignal.timeout(5000) })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages?.length > 0) {
          const mapped: ChatMessage[] = data.messages.map((m: { content: string; timestamp: string; is_bot_message: number }) => ({
            role: (m.is_bot_message ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(mapped);
          if (selectedAgentId) saveMessages(selectedAgentId, mapped);
        }
        setHistoryLoaded(true);
      })
      .catch(() => { setHistoryLoaded(true); });
  }, [agentUrl, isHealthy, historyLoaded, selectedAgentId]);

  // Reset history loaded flag when switching agents
  useEffect(() => {
    setHistoryLoaded(false);
  }, [selectedAgentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const isConnectable = selectedAgent?.status === 'running' && agentUrl && isHealthy;

  const clearChat = () => {
    setMessages([]);
    if (selectedAgentId) {
      localStorage.removeItem(getChatKey(selectedAgentId));
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isThinking || !agentUrl) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', content: messageText, timestamp }]);
    setInput('');
    setIsThinking(true);

    let assistantText = '';

    try {
      const response = await fetch(`${agentUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'message' && data.text) {
                if (!assistantText) {
                  assistantText = data.text;
                  const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setMessages(prev => [...prev, { role: 'assistant', content: data.text, timestamp: replyTimestamp }]);
                } else {
                  assistantText += '\n\n' + data.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantText };
                    return updated;
                  });
                }
                setIsThinking(false);
              } else if (currentEvent === 'error' && data.text) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Error: ${data.text}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
                setIsThinking(false);
              } else if (currentEvent === 'done') {
                setIsThinking(false);
              }
            } catch { /* ignore malformed data */ }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Connection failed'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* Agent selector */}
      <div style={{ padding: '0 1rem', borderBottom: '1px solid var(--cds-border-subtle)' }}>
        <Select
          id="agent-select"
          labelText=""
          size="sm"
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
        >
          {agents.length === 0 && <SelectItem value="" text="No agents found" />}
          {agents.map(a => (
            <SelectItem key={a.id} value={a.id} text={`${a.name} ${a.status === 'running' ? '●' : '○'}`} />
          ))}
        </Select>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0 0.5rem' }}>
          {selectedAgent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CircleFilled size={8} style={{ color: isHealthy ? 'var(--cds-support-success)' : 'var(--cds-text-disabled)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                {isHealthy ? `Connected :${selectedAgent.port}` : selectedAgent.status === 'running' ? 'Connecting...' : 'Not running'}
              </span>
            </div>
          )}
          {messages.length > 0 && (
            <Button
              hasIconOnly
              renderIcon={TrashCan}
              iconDescription="Clear chat"
              kind="ghost"
              size="sm"
              onClick={clearChat}
            />
          )}
        </div>
      </div>

      <div className="sidebar-content">
        <div className="chat-messages">
          {!isConnectable ? (
            <div className="chat-empty">
              <Chat size={48} />
              {selectedAgent ? (
                <>
                  <p>{selectedAgent.name} is {selectedAgent.status === 'running' ? 'connecting' : 'not running'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                    {selectedAgent.status === 'running' ? 'Waiting for health check...' : 'Start the agent from the Agents page to chat'}
                  </p>
                </>
              ) : (
                <>
                  <p>No agents available</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                    Create an agent in the Agents page to get started
                  </p>
                </>
              )}
            </div>
          ) : messages.length === 0 && !isThinking ? (
            <div className="chat-empty">
              <Chat size={48} />
              <p>Chat with {selectedAgent?.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                Ask anything or describe what you need done
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  <div className="message-meta">
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="loading-indicator" style={{ padding: '1rem' }}>
                  <InlineLoading description="Thinking..." />
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="chat-input-area">
          <div className="left-input-container">
            <TextArea
              id="chat-input"
              labelText=""
              placeholder={isConnectable ? 'Ask anything...' : 'Agent not running'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              disabled={!isConnectable}
            />
          </div>
          <div className="right-button-container">
            <Button
              renderIcon={Send}
              iconDescription="Send"
              hasIconOnly
              size="md"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isThinking || !isConnectable}
            />
          </div>
        </div>
      </div>
    </>
  );
}
