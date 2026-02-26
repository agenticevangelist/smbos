import fs from 'fs';
import path from 'path';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const STORE_DIR = path.join(
  process.env.TGCLI_STORE || path.join(import.meta.dirname, '..', 'store'),
);
const SESSION_PATH = path.join(STORE_DIR, 'session.txt');

let client: TelegramClient | null = null;

function loadEnv(): { apiId: number; apiHash: string } {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  if (!apiId || !apiHash) {
    throw new Error(
      'TELEGRAM_API_ID and TELEGRAM_API_HASH are required.\n' +
      'Set them in tools/tgcli/.env or as environment variables.',
    );
  }
  return { apiId, apiHash };
}

function loadSession(): string {
  try {
    return fs.readFileSync(SESSION_PATH, 'utf-8').trim();
  } catch {
    return '';
  }
}

function saveSession(session: string): void {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  fs.writeFileSync(SESSION_PATH, session, 'utf-8');
}

export function getSessionPath(): string {
  return SESSION_PATH;
}

export function hasSession(): boolean {
  try {
    return fs.readFileSync(SESSION_PATH, 'utf-8').trim().length > 0;
  } catch {
    return false;
  }
}

export async function connect(): Promise<TelegramClient> {
  if (client?.connected) return client;

  const { apiId, apiHash } = loadEnv();
  const sessionStr = loadSession();

  if (!sessionStr) {
    throw new Error('No session found. Run `tgcli auth` first.');
  }

  const session = new StringSession(sessionStr);
  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();
  saveSession(client.session.save() as unknown as string);

  return client;
}

export async function disconnect(): Promise<void> {
  if (client) {
    saveSession(client.session.save() as unknown as string);
    await client.disconnect();
    client = null;
  }
}

export async function getMe(): Promise<{ id: string; username: string; phone: string }> {
  const c = await connect();
  const me = await c.getMe() as Api.User;
  return {
    id: String(me.id),
    username: me.username || '',
    phone: me.phone || '',
  };
}

export async function listChats(
  limit = 100,
  query?: string,
): Promise<Array<{ id: string; name: string; type: string; unreadCount: number }>> {
  const c = await connect();
  const dialogs = await c.getDialogs({ limit });

  const results: Array<{ id: string; name: string; type: string; unreadCount: number }> = [];
  for (const d of dialogs) {
    const entity = d.entity;
    if (!entity) continue;

    let name = 'Unknown';
    let type = 'unknown';

    if ('title' in entity && entity.title) {
      name = String(entity.title);
      type = (entity as any).broadcast ? 'channel' : 'group';
    } else if ('firstName' in entity) {
      name = [(entity as any).firstName, (entity as any).lastName].filter(Boolean).join(' ');
      type = 'user';
    }

    if (query) {
      const q = query.toLowerCase();
      if (!name.toLowerCase().includes(q)) continue;
    }

    results.push({
      id: String(d.id ?? ''),
      name,
      type,
      unreadCount: d.unreadCount ?? 0,
    });
  }

  return results;
}

export async function getMessages(
  chatId: string,
  limit = 50,
): Promise<Array<{ id: number; text: string; senderName: string; senderId: string; date: string; out: boolean }>> {
  const c = await connect();
  const entity = await c.getEntity(chatId);
  const messages = await c.getMessages(entity, { limit });

  const results: Array<{ id: number; text: string; senderName: string; senderId: string; date: string; out: boolean }> = [];

  for (const msg of messages) {
    if (!msg.message) continue;

    const senderId = msg.senderId ? String(msg.senderId) : '';
    let senderName = senderId;

    try {
      if (msg.senderId) {
        const sender = await c.getEntity(msg.senderId);
        if ('firstName' in sender) {
          senderName = [(sender as any).firstName, (sender as any).lastName].filter(Boolean).join(' ');
        } else if ('username' in sender && sender.username) {
          senderName = String(sender.username);
        } else if ('title' in sender && sender.title) {
          senderName = String(sender.title);
        }
      }
    } catch { /* numeric fallback */ }

    results.push({
      id: msg.id,
      text: msg.message,
      senderName,
      senderId,
      date: new Date(msg.date * 1000).toISOString(),
      out: msg.out ?? false,
    });
  }

  return results;
}

export async function searchChats(
  query: string,
  limit = 20,
): Promise<Array<{ id: string; name: string; type: string }>> {
  const c = await connect();
  const result = await c.invoke(
    new Api.contacts.Search({ q: query, limit }),
  );

  const results: Array<{ id: string; name: string; type: string }> = [];

  for (const chat of result.chats) {
    let name = 'Unknown';
    let type = 'group';
    if ('title' in chat && chat.title) {
      name = String(chat.title);
      type = (chat as any).broadcast ? 'channel' : 'group';
    }
    const id = 'id' in chat ? String(chat.id) : '';
    if (id) results.push({ id, name, type });
  }

  for (const user of result.users) {
    if ('id' in user) {
      const name = 'firstName' in user
        ? [(user as any).firstName, (user as any).lastName].filter(Boolean).join(' ')
        : 'Unknown';
      results.push({ id: String(user.id), name, type: 'user' });
    }
  }

  return results;
}

export async function sendMessage(chatId: string, text: string): Promise<{ messageId: number }> {
  const c = await connect();
  const entity = await c.getEntity(chatId);

  const MAX_LENGTH = 4096;
  if (text.length <= MAX_LENGTH) {
    const result = await c.sendMessage(entity, { message: text });
    return { messageId: result.id };
  }

  let lastId = 0;
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    const result = await c.sendMessage(entity, { message: text.slice(i, i + MAX_LENGTH) });
    lastId = result.id;
  }
  return { messageId: lastId };
}
