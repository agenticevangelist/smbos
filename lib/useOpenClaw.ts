'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { getOpenClawSettings } from '@/components/SettingsPage';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  partial?: boolean;
};

export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type RpcCallback = (res: any) => void;

export function useOpenClaw() {
  const ws = useRef<WebSocket | null>(null);
  const pending = useRef<Map<string, RpcCallback>>(new Map());
  const reqId = useRef(0);
  const activeRunId = useRef<string | null>(null);
  const statusRef = useRef<GatewayStatus>('disconnected');

  const [status, setStatus] = useState<GatewayStatus>('disconnected');
  const [agentId, setAgentId] = useState('main');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Derive session key from agent ID
  const getSessionKey = useCallback((id: string) => {
    return id === 'main' ? 'main' : `agent:${id}:main`;
  }, []);

  const updateStatus = useCallback((s: GatewayStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const nextId = () => String(++reqId.current);

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  const rpc = useCallback(<T = any>(method: string, params: object = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = nextId();
      const timeout = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error(`RPC ${method} timed out`));
      }, 30000);
      pending.current.set(id, (res) => {
        clearTimeout(timeout);
        if (res.ok) resolve(res.payload);
        else reject(new Error(res.error?.message ?? 'RPC error'));
      });
      send({ type: 'req', id, method, params });
    });
  }, [send]);

  // Set the assistant message text (replaces, not appends — chat deltas send full text)
  const setAssistantText = useCallback((text: string, done: boolean) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.partial) {
        return [
          ...prev.slice(0, -1),
          { ...last, content: text, partial: !done },
        ];
      }
      return [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          partial: !done,
        },
      ];
    });

    if (done) {
      activeRunId.current = null;
      setIsStreaming(false);
    }
  }, []);

  // Extract text from message content (array of {type:"text", text:"..."} blocks)
  const extractText = (msg: any): string => {
    if (!msg?.content) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text ?? '')
        .join('');
    }
    return '';
  };

  const handleEvent = useCallback((event: string, payload: any) => {
    // Chat events: state="delta" (streaming) / state="final" (done)
    // payload: { state, message: { role, content: [{type:"text", text:"..."}], timestamp } }
    if (event === 'chat') {
      const text = extractText(payload.message);
      if (payload.state === 'delta') {
        setAssistantText(text, false);
      } else if (payload.state === 'final') {
        setAssistantText(text, true);
      }
    }
  }, [setAssistantText]);

  const loadHistory = useCallback((rpcFn: typeof rpc, sessKey: string) => {
    setMessages([]); // Clear previous messages
    rpcFn('chat.history', { sessionKey: sessKey, limit: 50 })
      .then((payload: any) => {
        const msgs: ChatMessage[] = (payload?.messages ?? [])
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => {
            // content can be a string or an array of content blocks
            let text = '';
            if (typeof m.content === 'string') {
              text = m.content;
            } else if (Array.isArray(m.content)) {
              text = m.content
                .filter((b: any) => b.type === 'text' || typeof b === 'string')
                .map((b: any) => (typeof b === 'string' ? b : b.text ?? ''))
                .join('');
            }
            return {
              id: m.id ?? String(Math.random()),
              role: m.role,
              content: text,
              timestamp: m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '',
            };
          })
          .filter((m: ChatMessage) => m.content.trim() !== '');
        setMessages(msgs);
      })
      .catch(() => {});
  }, []);

  // Reload history when agent changes
  useEffect(() => {
    if (status === 'connected') {
      loadHistory(rpc, getSessionKey(agentId));
    }
  }, [agentId, status, loadHistory, rpc, getSessionKey]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const settings = getOpenClawSettings();
    if (!settings.gatewayUrl) return;

    updateStatus('connecting');
    const socket = new WebSocket(settings.gatewayUrl);
    ws.current = socket;

    socket.onopen = () => {
      // Gateway sends connect.challenge first, we wait for it
    };

    socket.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }

      // Handle connect.challenge — respond with connect request
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        send({
          type: 'req',
          id: nextId(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'cli',
              displayName: 'smbos',
              version: '0.1.0',
              platform: 'node',
              mode: 'cli',
            },
            auth: { token: settings.gatewayToken },
          },
        });
        return;
      }

      // Handle responses
      if (msg.type === 'res') {
        // hello-ok = successful connect
        if (msg.ok && msg.payload?.type === 'hello-ok') {
          updateStatus('connected');
          // History loading is handled by the useEffect on status change
          return;
        }

        // Connect rejection
        if (!msg.ok && statusRef.current === 'connecting') {
          updateStatus('error');
          socket.close();
          return;
        }

        // Route to pending RPC callbacks
        const cb = pending.current.get(msg.id);
        if (cb) {
          pending.current.delete(msg.id);
          cb(msg);
        }
        return;
      }

      // Handle events
      if (msg.type === 'event') {
        handleEvent(msg.event, msg.payload);
      }
    };

    socket.onclose = () => {
      updateStatus('disconnected');
      setIsStreaming(false);
      if (ws.current === socket) {
        ws.current = null;
      }
    };

    socket.onerror = () => {
      updateStatus('error');
      if (ws.current === socket) {
        socket.close();
        ws.current = null;
      }
    };
  }, [send, rpc, handleEvent, updateStatus]); // Removed loadHistory from deps as it's triggered by effect

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || statusRef.current !== 'connected') return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await rpc('chat.send', {
        message: content,
        sessionKey: getSessionKey(agentId),
        idempotencyKey,
      });
      activeRunId.current = res?.runId ?? null;
    } catch (err) {
      // If send fails, show error and stop streaming
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [rpc, agentId, getSessionKey]);

  const abortRun = useCallback(() => {
    rpc('chat.abort', { sessionKey: getSessionKey(agentId) }).catch(() => {});
    activeRunId.current = null;
    setIsStreaming(false);
  }, [rpc, agentId, getSessionKey]);

  // Listen for settings changes — disconnect and reconnect
  useEffect(() => {
    const handler = () => {
      disconnect();
      const settings = getOpenClawSettings();
      if (settings.gatewayUrl && settings.autoConnect) {
        // Small delay to let disconnect settle
        setTimeout(() => connect(), 300);
      }
    };
    window.addEventListener('openclaw-settings-changed', handler);
    return () => window.removeEventListener('openclaw-settings-changed', handler);
  }, [connect, disconnect]);

  return { status, messages, isStreaming, connect, disconnect, sendMessage, abortRun, rpc, agentId, setAgentId };
}
