export async function execute(params: any) {
  const { url, extractMode = 'links' } = params;

  if (!url) throw new Error('URL is required');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SMBOS-WebScraper/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  switch (extractMode) {
    case 'links':
      return extractLinks(html, parsedUrl);
    case 'headings':
      return extractHeadings(html);
    case 'text':
      return extractText(html);
    case 'images':
      return extractImages(html, parsedUrl);
    case 'meta':
      return extractMeta(html);
    default:
      return extractLinks(html, parsedUrl);
  }
}

function extractLinks(html: string, baseUrl: URL) {
  const linkRegex = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const items: any[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text && !href) continue;

    let fullUrl = href;
    try {
      fullUrl = new URL(href, baseUrl.origin).toString();
    } catch {}

    items.push({
      text: text || '(no text)',
      href: fullUrl,
      external: !fullUrl.startsWith(baseUrl.origin),
    });
  }

  return { items, total: items.length, url: baseUrl.toString() };
}

function extractHeadings(html: string) {
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  const items: any[] = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1].toUpperCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      items.push({ level, text });
    }
  }

  return { items, total: items.length };
}

function extractText(html: string) {
  // Remove script and style tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Split into paragraphs (by sentence groups)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const items = sentences.slice(0, 100).map((s, i) => ({
    index: i + 1,
    content: s.trim(),
  }));

  return { items, total: items.length, fullTextLength: text.length };
}

function extractImages(html: string, baseUrl: URL) {
  const imgRegex = /<img\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const items: any[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    let fullUrl = src;
    try {
      fullUrl = new URL(src, baseUrl.origin).toString();
    } catch {}

    // Try to extract alt text
    const altMatch = match[0].match(/alt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';

    items.push({
      src: fullUrl,
      alt: alt || '(no alt text)',
    });
  }

  return { items, total: items.length };
}

function extractMeta(html: string) {
  const metaRegex = /<meta\s([^>]+)>/gi;
  const items: any[] = [];
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const nameMatch = attrs.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content\s*=\s*["']([^"']+)["']/i);

    if (nameMatch || contentMatch) {
      items.push({
        name: nameMatch ? nameMatch[1] : '(unnamed)',
        content: contentMatch ? contentMatch[1] : '',
      });
    }
  }

  // Also extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    items.unshift({ name: 'title', content: titleMatch[1].trim() });
  }

  return { items, total: items.length };
}
