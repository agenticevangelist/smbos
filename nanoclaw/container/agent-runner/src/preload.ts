/**
 * Preload module — patches globalThis.fetch BEFORE any other module loads.
 * Must be loaded via: node --import ./preload.js ./index.js
 *
 * This intercepts Anthropic API streaming (SSE) responses, tees the body,
 * and emits text deltas via stdout markers so the host can progressively
 * update Telegram messages.
 */

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

interface StreamOutput {
  status: 'success';
  result: null;
  streamText: string;
}

function writeStreamOutput(text: string): void {
  const output: StreamOutput = { status: 'success', result: null, streamText: text };
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

const origFetch = globalThis.fetch;

globalThis.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await origFetch.call(globalThis, input, init);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !res.body) {
    return res;
  }

  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : (input as Request).url;
  console.error(`[stream-preload] SSE intercepted: ${url.slice(0, 80)}`);

  try {
    const [forSdk, forCapture] = res.body.tee();

    // Parse forCapture in background for content_block_delta text deltas
    (async () => {
      const reader = forCapture.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let textBuf = '';

      const flush = () => {
        if (textBuf) {
          writeStreamOutput(textBuf);
          textBuf = '';
        }
      };

      const timer = setInterval(flush, 1000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuf += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = sseBuf.indexOf('\n')) !== -1) {
            const line = sseBuf.slice(0, nlIdx);
            sseBuf = sseBuf.slice(nlIdx + 1);

            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const evt = JSON.parse(jsonStr);
              if (
                evt.type === 'content_block_delta' &&
                evt.delta?.type === 'text_delta' &&
                evt.delta?.text
              ) {
                textBuf += evt.delta.text;
              }
            } catch { /* malformed JSON — skip */ }
          }
        }
      } catch (err) {
        console.error(`[stream-preload] capture error: ${err}`);
      } finally {
        clearInterval(timer);
        flush();
      }
    })();

    return new Response(forSdk, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch {
    // tee() failed — return original response untouched
    return res;
  }
};
