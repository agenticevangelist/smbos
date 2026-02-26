'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@carbon/react';
import { Send, Stop } from '@carbon/icons-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onAbort, isStreaming, disabled, placeholder }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-input-area">
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        placeholder={placeholder ?? 'Ask OpenClaw…'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <div className="chat-input-actions">
        {isStreaming ? (
          <Button
            renderIcon={Stop}
            iconDescription="Stop"
            hasIconOnly
            size="sm"
            kind="danger--ghost"
            onClick={onAbort}
          />
        ) : (
          <Button
            renderIcon={Send}
            iconDescription="Send"
            hasIconOnly
            size="sm"
            onClick={onSend}
            disabled={!value.trim() || disabled}
          />
        )}
      </div>
    </div>
  );
}
