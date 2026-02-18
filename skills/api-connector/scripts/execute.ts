export async function execute(params: any) {
  const { url, method = 'GET', headers: headersStr, body: bodyStr, timeout = 10000 } = params;

  if (!url) throw new Error('URL is required');

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Parse headers
  let headers: Record<string, string> = {};
  if (headersStr) {
    try {
      headers = typeof headersStr === 'string' ? JSON.parse(headersStr) : headersStr;
    } catch {
      throw new Error('Invalid headers JSON');
    }
  }

  // Parse body
  let body: string | undefined;
  if (bodyStr && method !== 'GET') {
    if (typeof bodyStr === 'string') {
      body = bodyStr;
      if (!headers['Content-Type'] && !headers['content-type']) {
        try {
          JSON.parse(bodyStr);
          headers['Content-Type'] = 'application/json';
        } catch {
          // Not JSON, leave as-is
        }
      }
    } else {
      body = JSON.stringify(bodyStr);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const timing = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      timing: `${timing}ms`,
      url: response.url,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw new Error(`Request failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
