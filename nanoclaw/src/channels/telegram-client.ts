import fs from 'fs';
import path from 'path';

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js';

import {
  ASSISTANT_NAME,
  TRIGGER_PATTERN,
} from '../config.js';
import { logger } from '../logger.js';
import { Channel, OnInboundMessage, OnChatMetadata } from '../types.js';
import type { RegisteredGroup } from '../types.js';

export interface TelegramClientChannelOpts {
  apiId: number;
  apiHash: string;
  sessionPath: string; // path to store/load session string
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class TelegramClientChannel implements Channel {
  name = 'telegram-client';
  prefixAssistantName = false;

  private client: TelegramClient | null = null;
  private opts: TelegramClientChannelOpts;

  constructor(opts: TelegramClientChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    const sessionStr = this.loadSession();
    const session = new StringSession(sessionStr);

    this.client = new TelegramClient(session, this.opts.apiId, this.opts.apiHash, {
      connectionRetries: 5,
    });

    await this.client.connect();

    // Persist possibly-refreshed session after connect
    this.saveSession(this.client.session.save() as unknown as string);

    const me = await this.client.getMe();
    const username = (me as Api.User).username || (me as Api.User).phone || 'unknown';
    logger.info({ username }, 'Telegram client connected');
    console.log(`\n  Telegram client: @${username} (userbot)\n`);

    // Listen for all new messages
    this.client.addEventHandler(async (event: NewMessageEvent) => {
      const msg = event.message;
      if (!msg) return;

      const peerId = msg.peerId;
      if (!peerId) return;

      // Build chat JID: tgc:{chatId}
      let numericId: string;
      if ('channelId' in peerId) {
        numericId = String(peerId.channelId);
      } else if ('chatId' in peerId) {
        numericId = String(peerId.chatId);
      } else if ('userId' in peerId) {
        numericId = String(peerId.userId);
      } else {
        return;
      }

      const chatJid = `tgc:${numericId}`;
      const timestamp = new Date(msg.date * 1000).toISOString();
      const isFromMe = msg.out ?? false;

      // Ignore our own messages
      if (isFromMe) return;

      let content = msg.message || '';
      const sender = msg.senderId ? String(msg.senderId) : '';

      // Resolve sender name
      let senderName = sender;
      try {
        const entity = await this.client!.getEntity(sender);
        if ('firstName' in entity) {
          senderName = [(entity as any).firstName, (entity as any).lastName].filter(Boolean).join(' ');
        } else if ('username' in entity && entity.username) {
          senderName = String(entity.username);
        }
      } catch { /* use numeric fallback */ }

      // Resolve chat name
      let chatName = chatJid;
      try {
        const chatEntity = await this.client!.getEntity(numericId);
        if ('title' in chatEntity) {
          chatName = String(chatEntity.title);
        } else if ('firstName' in chatEntity) {
          chatName = [(chatEntity as any).firstName, (chatEntity as any).lastName].filter(Boolean).join(' ');
        } else if ('username' in chatEntity && chatEntity.username) {
          chatName = String(chatEntity.username);
        }
      } catch { /* use jid fallback */ }

      this.opts.onChatMetadata(chatJid, timestamp, chatName);

      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug({ chatJid, chatName }, 'Message from unregistered Telegram client chat');
        return;
      }

      // Trigger pattern: if message mentions assistant name, prepend trigger
      if (content && !TRIGGER_PATTERN.test(content)) {
        const lc = content.toLowerCase();
        if (lc.includes(`@${ASSISTANT_NAME.toLowerCase()}`)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      this.opts.onMessage(chatJid, {
        id: String(msg.id),
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info({ chatJid, chatName, sender: senderName }, 'Telegram client message stored');
    }, new NewMessage({}));
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client) {
      logger.warn('Telegram client not initialized');
      return;
    }

    try {
      const numericId = jid.replace(/^tgc:/, '');
      const entity = await this.client.getEntity(numericId);

      const MAX_LENGTH = 4096;
      if (text.length <= MAX_LENGTH) {
        await this.client.sendMessage(entity, { message: text });
      } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          await this.client.sendMessage(entity, { message: text.slice(i, i + MAX_LENGTH) });
        }
      }
      logger.info({ jid, length: text.length }, 'Telegram client message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram client message');
    }
  }

  async sendAndGetId(jid: string, text: string): Promise<number> {
    if (!this.client) throw new Error('Telegram client not initialized');

    const numericId = jid.replace(/^tgc:/, '');
    const entity = await this.client.getEntity(numericId);
    const MAX_LENGTH = 4096;
    const trimmed = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH - 3) + '...' : text;
    const result = await this.client.sendMessage(entity, { message: trimmed });
    logger.debug({ jid, messageId: result.id }, 'Telegram client streaming message sent');
    return result.id;
  }

  async editMessage(jid: string, messageId: number, text: string): Promise<void> {
    if (!this.client) return;

    try {
      const numericId = jid.replace(/^tgc:/, '');
      const entity = await this.client.getEntity(numericId);
      const MAX_LENGTH = 4096;
      const trimmed = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH - 3) + '...' : text;
      await this.client.editMessage(entity, { message: messageId, text: trimmed });
    } catch (err: any) {
      logger.debug({ jid, messageId, err }, 'Failed to edit Telegram client message');
    }
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tgc:');
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.client || !isTyping) return;
    try {
      const numericId = jid.replace(/^tgc:/, '');
      const entity = await this.client.getEntity(numericId);
      await this.client.invoke(new Api.messages.SetTyping({
        peer: entity,
        action: new Api.SendMessageTypingAction(),
      }));
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram client typing indicator');
    }
  }

  async listDialogs(limit = 100): Promise<Array<{ jid: string; name: string; type: string }>> {
    if (!this.client) return [];
    try {
      const dialogs = await this.client.getDialogs({ limit });
      return dialogs.map((d: any) => {
        const entity = d.entity;
        let name = 'Unknown';
        let type = 'unknown';
        if (entity) {
          if ('title' in entity && entity.title) {
            name = String(entity.title);
            type = entity.className === 'Channel' && entity.broadcast ? 'channel' : 'group';
          } else if ('firstName' in entity) {
            name = [entity.firstName, entity.lastName].filter(Boolean).join(' ');
            type = 'user';
          }
        }
        const numericId = d.id?.toString() ?? '';
        return { jid: `tgc:${numericId}`, name, type };
      });
    } catch (err) {
      logger.error({ err }, 'Failed to list Telegram dialogs');
      return [];
    }
  }

  async fetchMessages(chatId: string, limit = 50): Promise<Array<{ id: number; text: string; senderName: string; senderId: string; date: string }>> {
    if (!this.client) return [];
    try {
      const entity = await this.client.getEntity(chatId);
      const messages = await this.client.getMessages(entity, { limit });
      const result: Array<{ id: number; text: string; senderName: string; senderId: string; date: string }> = [];
      for (const msg of messages) {
        if (!msg.message) continue;
        const senderId = msg.senderId ? String(msg.senderId) : '';
        let senderName = senderId;
        try {
          if (msg.senderId) {
            const sender = await this.client!.getEntity(msg.senderId);
            if ('firstName' in sender) {
              senderName = [(sender as any).firstName, (sender as any).lastName].filter(Boolean).join(' ');
            } else if ('username' in sender && sender.username) {
              senderName = String(sender.username);
            } else if ('title' in sender && sender.title) {
              senderName = String(sender.title);
            }
          }
        } catch { /* use numeric fallback */ }
        result.push({
          id: msg.id,
          text: msg.message,
          senderName,
          senderId,
          date: new Date(msg.date * 1000).toISOString(),
        });
      }
      return result;
    } catch (err) {
      logger.error({ chatId, err }, 'Failed to fetch Telegram messages');
      return [];
    }
  }

  async searchChats(query: string, limit = 20): Promise<Array<{ jid: string; name: string; type: string }>> {
    if (!this.client) return [];
    try {
      const result = await this.client.invoke(
        new Api.contacts.Search({ q: query, limit })
      );
      const results: Array<{ jid: string; name: string; type: string }> = [];
      for (const chat of result.chats) {
        let name = 'Unknown';
        let type = 'group';
        if ('title' in chat && chat.title) {
          name = String(chat.title);
          type = (chat as any).broadcast ? 'channel' : 'group';
        }
        const id = 'id' in chat ? String(chat.id) : '';
        if (id) results.push({ jid: `tgc:${id}`, name, type });
      }
      for (const user of result.users) {
        if ('id' in user) {
          const name = 'firstName' in user
            ? [(user as any).firstName, (user as any).lastName].filter(Boolean).join(' ')
            : 'Unknown';
          results.push({ jid: `tgc:${user.id}`, name, type: 'user' });
        }
      }
      return results;
    } catch (err) {
      logger.error({ query, err }, 'Failed to search Telegram chats');
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      // Save session before disconnecting
      this.saveSession(this.client.session.save() as unknown as string);
      await this.client.disconnect();
      this.client = null;
      logger.info('Telegram client disconnected');
    }
  }

  private loadSession(): string {
    try {
      return fs.readFileSync(this.opts.sessionPath, 'utf-8').trim();
    } catch {
      return '';
    }
  }

  private saveSession(session: string): void {
    try {
      fs.mkdirSync(path.dirname(this.opts.sessionPath), { recursive: true });
      fs.writeFileSync(this.opts.sessionPath, session, 'utf-8');
    } catch (err) {
      logger.warn({ err }, 'Failed to save Telegram client session');
    }
  }
}
