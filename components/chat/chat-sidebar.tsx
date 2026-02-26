'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { InlineLoading } from '@carbon/react';
import { Chat, Pause, Play } from '@carbon/icons-react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import type { GatewayStatus, ChatMessage as ChatMessageType } from '@/lib/useOpenClaw';

interface ChatSidebarProps {
  agents: any[];
  agentId: string;
  setAgentId: (id: string) => void;
  messages: ChatMessageType[];
  isStreaming: boolean;
  ocStatus: GatewayStatus;
  gatewayRunning: boolean | null;
  gatewayLoading: boolean;
  onToggleGateway: () => void;
  onSend: (text: string) => void;
  onAbort: () => void;
}

export function ChatSidebar({
  agents,
  agentId,
  setAgentId,
  messages,
  isStreaming,
  ocStatus,
  gatewayRunning,
  gatewayLoading,
  onToggleGateway,
  onSend,
  onAbort,
}: ChatSidebarProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  }, [input, onSend]);

  return (
    <div className="panel-container">
      <div className="chat-header">
        <select
          className="chat-agent-select"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={ocStatus !== 'connected'}
        >
          {agents.length === 0 && <option value="main">Main</option>}
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.identity?.name || agent.name || agent.id}
            </option>
          ))}
        </select>
        <button
          className="app-header__btn"
          onClick={onToggleGateway}
          disabled={gatewayLoading || gatewayRunning === null}
          title={gatewayRunning ? 'Stop gateway' : 'Start gateway'}
        >
          {gatewayRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      <div className="sidebar-content">
        <div className="chat-messages">
          {messages.length === 0 && !isStreaming ? (
            <div className="chat-empty">
              <Chat size={48} />
              {ocStatus === 'connected'
                ? <p>How can I help you today?</p>
                : ocStatus === 'connecting'
                ? <p>Connecting to OpenClaw…</p>
                : <p>OpenClaw is {gatewayRunning ? 'unreachable' : 'stopped'}. {!gatewayRunning && 'Press ▶ to start.'}</p>
              }
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="loading-indicator">
                  <InlineLoading description="Thinking…" />
                </div>
              )}
            </>
          )}
          <div ref={chatBottomRef} />
        </div>
      </div>

      <div className="sidebar-footer" style={{ padding: 0, border: 'none' }}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onAbort={onAbort}
          isStreaming={isStreaming}
          disabled={ocStatus !== 'connected'}
          placeholder={ocStatus === 'connected' ? 'Ask OpenClaw…' : 'Gateway not connected'}
        />
      </div>
    </div>
  );
}
