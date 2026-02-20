/**
 * HTTP server for NanoClaw web chat.
 * Accepts messages via POST /api/chat and streams agent responses as SSE.
 */
import http from 'http';

import { HTTP_PORT, WEB_CHAT_JID, WEB_CHAT_FOLDER } from './config.js';
import {
  getAllRegisteredGroups,
  getAllSessions,
  getAllTasks,
  getRecentMessages,
  getRecentRunLogs,
} from './db.js';
import { logger } from './logger.js';

export interface HttpChatHandler {
  (message: string, send: SseWriter): Promise<void>;
}

export interface SseWriter {
  sendEvent(event: string, data?: Record<string, unknown>): void;
  close(): void;
}

let server: http.Server | null = null;

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function startHttpServer(onChat: HttpChatHandler): http.Server {
  server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = corsHeaders(origin);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Tasks endpoint — scheduled tasks + run logs
    if (req.method === 'GET' && req.url === '/api/tasks') {
      try {
        const tasks = getAllTasks();
        const runLogs = getRecentRunLogs(100);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tasks, runLogs }));
      } catch {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tasks: [], runLogs: [] }));
      }
      return;
    }

    // State endpoint — sessions, groups, task stats
    if (req.method === 'GET' && req.url === '/api/state') {
      try {
        const sessions = getAllSessions();
        const groups = getAllRegisteredGroups();
        const tasks = getAllTasks();
        const taskStats = {
          total: tasks.length,
          active: tasks.filter((t) => t.status === 'active').length,
          paused: tasks.filter((t) => t.status === 'paused').length,
          completed: tasks.filter((t) => t.status === 'completed').length,
        };
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            dbExists: true,
            sessions: Object.keys(sessions).length,
            groups: Object.entries(groups).map(([jid, g]) => ({
              jid,
              name: g.name,
              folder: g.folder,
              trigger_pattern: g.trigger,
              added_at: g.added_at,
            })),
            taskStats,
          }),
        );
      } catch {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            dbExists: true,
            sessions: 0,
            groups: [],
            taskStats: { total: 0, active: 0, paused: 0, completed: 0 },
          }),
        );
      }
      return;
    }

    // Messages endpoint — chat history for web-chat
    if (req.method === 'GET' && req.url?.startsWith('/api/messages')) {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);
        const limit = parseInt(url.searchParams.get('limit') || '200', 10);
        const messages = getRecentMessages(WEB_CHAT_JID, limit);
        messages.reverse(); // chronological order
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages }));
      } catch {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: [] }));
      }
      return;
    }

    // Chat endpoint
    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        let message: string;
        try {
          const parsed = JSON.parse(body);
          message = parsed.message;
          if (!message?.trim()) {
            res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'message is required' }));
            return;
          }
        } catch {
          res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        // SSE headers
        res.writeHead(200, {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const writer: SseWriter = {
          sendEvent(event, data) {
            if (res.writableEnded) return;
            const payload = data ? JSON.stringify(data) : '{}';
            res.write(`event: ${event}\ndata: ${payload}\n\n`);
          },
          close() {
            if (!res.writableEnded) res.end();
          },
        };

        // Send typing indicator immediately
        writer.sendEvent('typing');

        try {
          await onChat(message, writer);
        } catch (err) {
          logger.error({ err }, 'HTTP chat handler error');
          writer.sendEvent('error', { text: 'Internal error processing message' });
        }
        writer.sendEvent('done');
        writer.close();
      });
      return;
    }

    // 404
    res.writeHead(404, cors);
    res.end();
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    logger.info({ port: HTTP_PORT }, 'HTTP server listening');
  });

  return server;
}

export function stopHttpServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return; }
    server.close(() => {
      logger.info('HTTP server closed');
      server = null;
      resolve();
    });
  });
}
