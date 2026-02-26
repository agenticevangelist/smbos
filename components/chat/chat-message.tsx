'use client';

import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '@/lib/useOpenClaw';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`chat-message ${message.role}`}>
      <div className="message-content">
        {message.partial
          ? (
            <>
              <ReactMarkdown>{message.content}</ReactMarkdown>
              <span className="typing-cursor">▋</span>
            </>
          )
          : <ReactMarkdown>{message.content}</ReactMarkdown>
        }
      </div>
      {message.timestamp && (
        <div className="message-meta">
          <span className="message-time">{message.timestamp}</span>
        </div>
      )}
    </div>
  );
}
