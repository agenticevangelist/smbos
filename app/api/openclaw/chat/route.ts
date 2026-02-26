import { NextRequest } from 'next/server';
import { getOpenClawClient } from '@/lib/agents/openclaw-client';
import { getGatewayStatus } from '@/lib/agents/lifecycle';

export async function POST(request: NextRequest) {
  const gateway = await getGatewayStatus();

  if (!gateway.running) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ text: 'Gateway offline' })}\n\n`,
      {
        status: 503,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
    );
  }

  const body = await request.json();
  const { message, agentId } = body;

  if (!message) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ text: 'message required' })}\n\n`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );
  }

  const sessionKey = `agent:${agentId || 'main'}:main`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendSSE = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      (async () => {
        try {
          const client = getOpenClawClient({ port: gateway.port });

          if (!client.isConnected) {
            await client.connect();
          }

          // Set up event listener for streaming response
          let responseText = '';
          const onEvent = (payload: unknown) => {
            const p = payload as { event?: string; payload?: { text?: string; delta?: string; content?: string; done?: boolean } };
            const event = p.event;
            const data = p.payload || p as Record<string, unknown>;

            if (event === 'text.delta' || event === 'message.delta') {
              const delta = (data as { delta?: string; text?: string }).delta || (data as { text?: string }).text || '';
              if (delta) {
                responseText += delta;
                sendSSE('message', { text: responseText });
              }
            } else if (event === 'message.complete' || event === 'turn.complete') {
              const text = (data as { content?: string; text?: string }).content || (data as { text?: string }).text || responseText;
              if (text && text !== responseText) {
                sendSSE('message', { text });
              }
              sendSSE('done', {});
              client.off('*', onEvent);
              controller.close();
            } else if (event === 'error') {
              sendSSE('error', { text: (data as { text?: string; message?: string }).text || (data as { message?: string }).message || 'Agent error' });
              client.off('*', onEvent);
              controller.close();
            }
          };

          client.on('*', onEvent);

          // Send the message via sessions.send
          await client.sendSessionMessage(sessionKey, message);

          // Timeout: close stream after 5 minutes if no complete event
          setTimeout(() => {
            client.off('*', onEvent);
            if (responseText) {
              sendSSE('done', {});
            } else {
              sendSSE('error', { text: 'Response timeout' });
            }
            try { controller.close(); } catch { /* already closed */ }
          }, 300000);
        } catch (err) {
          sendSSE('error', { text: err instanceof Error ? err.message : 'Connection failed' });
          try { controller.close(); } catch { /* already closed */ }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
