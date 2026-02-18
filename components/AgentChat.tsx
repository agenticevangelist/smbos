'use client';

import { useState, useEffect, useRef } from 'react';
import {
  TextArea,
  Button,
  InlineLoading,
} from '@carbon/react';
import { Send, Chat } from '@carbon/icons-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const NANOCLAW_URL = 'http://127.0.0.1:3100';

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isThinking) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', content: messageText, timestamp }]);
    setInput('');
    setIsThinking(true);

    // Accumulate streamed text into a single assistant message
    let assistantText = '';

    try {
      const response = await fetch(`${NANOCLAW_URL}/api/chat`, {
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

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'message' && data.text) {
                if (!assistantText) {
                  // First chunk — add a new message
                  assistantText = data.text;
                  const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setMessages(prev => [...prev, { role: 'assistant', content: data.text, timestamp: replyTimestamp }]);
                } else {
                  // Subsequent chunks — append to existing message
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
      <div className="sidebar-content">
        <div className="chat-messages">
          {messages.length === 0 && !isThinking ? (
            <div className="chat-empty">
              <Chat size={48} />
              <p>How can I help you today?</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                Ask me anything or describe what you need done
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
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
            />
          </div>
          <div className="right-button-container">
            <Button
              renderIcon={Send}
              iconDescription="Send"
              hasIconOnly
              size="md"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isThinking}
            />
          </div>
        </div>
      </div>
    </>
  );
}
