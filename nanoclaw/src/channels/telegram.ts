import fs from 'fs';
import path from 'path';

import { Bot } from 'grammy';

import {
  ASSISTANT_NAME,
  TRIGGER_PATTERN,
} from '../config.js';
import { logger } from '../logger.js';
import { Channel, OnInboundMessage, OnChatMetadata } from '../types.js';
import type { RegisteredGroup } from '../types.js';

export interface TelegramChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  dataDir?: string; // root data dir for saving media files
}

export class TelegramChannel implements Channel {
  name = 'telegram';
  prefixAssistantName = false;

  private bot: Bot | null = null;
  private opts: TelegramChannelOpts;
  private botToken: string;

  constructor(botToken: string, opts: TelegramChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.bot = new Bot(this.botToken);

    this.bot.command('chatid', (ctx) => {
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const chatName =
        chatType === 'private'
          ? ctx.from?.first_name || 'Private'
          : (ctx.chat as any).title || 'Unknown';

      ctx.reply(
        `Chat ID: \`tg:${chatId}\`\nName: ${chatName}\nType: ${chatType}`,
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.command('ping', (ctx) => {
      ctx.reply(`${ASSISTANT_NAME} is online.`);
    });

    this.bot.command('digest', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        await ctx.reply('This chat is not registered. Use /chatid to get the ID and register it first.');
        return;
      }

      const timestamp = new Date().toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'User';
      const sender = ctx.from?.id.toString() || '';
      const limitArg = ctx.match ? parseInt(ctx.match.trim(), 10) : NaN;
      const limit = !isNaN(limitArg) && limitArg > 0 ? limitArg : 5;

      this.opts.onChatMetadata(chatJid, timestamp);
      this.opts.onMessage(chatJid, {
        id: `digest-${Date.now()}`,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content: `@${ASSISTANT_NAME} /digest limit=${limit}`,
        timestamp,
        is_from_me: false,
      });

      await ctx.reply('Читаю каналы, готовлю дайджест...');
      logger.info({ chatJid, limit }, 'Digest command triggered');
    });

    this.bot.on('message:text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return;

      const chatJid = `tg:${ctx.chat.id}`;
      let content = ctx.message.text;
      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name ||
        ctx.from?.username ||
        ctx.from?.id.toString() ||
        'Unknown';
      const sender = ctx.from?.id.toString() || '';
      const msgId = ctx.message.message_id.toString();

      const chatName =
        ctx.chat.type === 'private'
          ? senderName
          : (ctx.chat as any).title || chatJid;

      // Translate @bot_username mentions into TRIGGER_PATTERN format
      const botUsername = ctx.me?.username?.toLowerCase();
      if (botUsername) {
        const entities = ctx.message.entities || [];
        const isBotMentioned = entities.some((entity) => {
          if (entity.type === 'mention') {
            const mentionText = content
              .substring(entity.offset, entity.offset + entity.length)
              .toLowerCase();
            return mentionText === `@${botUsername}`;
          }
          return false;
        });
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      this.opts.onChatMetadata(chatJid, timestamp, chatName);

      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Telegram chat',
        );
        return;
      }

      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Telegram message stored',
      );
    });

    // Non-text message handlers
    const storeNonText = (ctx: any, placeholder: string) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name || ctx.from?.username || ctx.from?.id?.toString() || 'Unknown';
      const caption = ctx.message.caption ? ` ${ctx.message.caption}` : '';

      this.opts.onChatMetadata(chatJid, timestamp);
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content: `${placeholder}${caption}`,
        timestamp,
        is_from_me: false,
      });
    };

    this.bot.on('message:photo', async (ctx) => {
      const chatJid = `tg:${ctx.chat.id}`;
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) return;

      const timestamp = new Date(ctx.message.date * 1000).toISOString();
      const senderName =
        ctx.from?.first_name || ctx.from?.username || ctx.from?.id?.toString() || 'Unknown';
      const rawCaption = ctx.message.caption ? `\nCaption: ${ctx.message.caption}` : '';

      let content = `[Photo]${rawCaption}`;

      if (this.opts.dataDir) {
        try {
          // Get highest-resolution photo
          const photos = ctx.message.photo;
          const largest = photos[photos.length - 1];
          const file = await ctx.api.getFile(largest.file_id);

          if (file.file_path) {
            const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
            const response = await fetch(fileUrl);
            const buffer = Buffer.from(await response.arrayBuffer());

            const mediaDir = path.join(this.opts.dataDir, 'ipc', group.folder, 'media');
            fs.mkdirSync(mediaDir, { recursive: true });

            const ext = path.extname(file.file_path) || '.jpg';
            const filename = `photo_${ctx.message.message_id}${ext}`;
            fs.writeFileSync(path.join(mediaDir, filename), buffer);

            content = `[Photo: /workspace/ipc/media/${filename}]${rawCaption}`;
            logger.debug({ chatJid, filename }, 'Telegram photo saved');
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to download Telegram photo, using placeholder');
        }
      }

      this.opts.onChatMetadata(chatJid, timestamp);
      this.opts.onMessage(chatJid, {
        id: ctx.message.message_id.toString(),
        chat_jid: chatJid,
        sender: ctx.from?.id?.toString() || '',
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });
    });
    this.bot.on('message:video', (ctx) => storeNonText(ctx, '[Video]'));
    this.bot.on('message:voice', (ctx) => storeNonText(ctx, '[Voice message]'));
    this.bot.on('message:audio', (ctx) => storeNonText(ctx, '[Audio]'));
    this.bot.on('message:document', (ctx) => {
      const name = ctx.message.document?.file_name || 'file';
      storeNonText(ctx, `[Document: ${name}]`);
    });
    this.bot.on('message:sticker', (ctx) => {
      const emoji = ctx.message.sticker?.emoji || '';
      storeNonText(ctx, `[Sticker ${emoji}]`);
    });
    this.bot.on('message:location', (ctx) => storeNonText(ctx, '[Location]'));
    this.bot.on('message:contact', (ctx) => storeNonText(ctx, '[Contact]'));

    this.bot.catch((err) => {
      logger.error({ err: err.message }, 'Telegram bot error');
    });

    return new Promise<void>((resolve) => {
      this.bot!.start({
        onStart: (botInfo) => {
          logger.info(
            { username: botInfo.username, id: botInfo.id },
            'Telegram bot connected',
          );
          console.log(`\n  Telegram bot: @${botInfo.username}`);
          console.log(
            `  Send /chatid to the bot to get a chat's registration ID\n`,
          );
          resolve();
        },
      });
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized');
      return;
    }

    try {
      const numericId = jid.replace(/^tg:/, '');

      const MAX_LENGTH = 4096;
      const chunks = text.length <= MAX_LENGTH
        ? [text]
        : Array.from({ length: Math.ceil(text.length / MAX_LENGTH) }, (_, i) =>
            text.slice(i * MAX_LENGTH, (i + 1) * MAX_LENGTH));

      for (const chunk of chunks) {
        try {
          await this.bot.api.sendMessage(numericId, chunk, { parse_mode: 'Markdown' });
        } catch {
          await this.bot.api.sendMessage(numericId, chunk);
        }
      }
      logger.info({ jid, length: text.length }, 'Telegram message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Telegram message');
    }
  }

  async sendAndGetId(jid: string, text: string): Promise<number> {
    if (!this.bot) throw new Error('Telegram bot not initialized');

    const numericId = jid.replace(/^tg:/, '');
    const MAX_LENGTH = 4096;
    const trimmed = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH - 3) + '...' : text;
    let result;
    try {
      result = await this.bot.api.sendMessage(numericId, trimmed, { parse_mode: 'Markdown' });
    } catch {
      result = await this.bot.api.sendMessage(numericId, trimmed);
    }
    logger.debug({ jid, messageId: result.message_id }, 'Telegram streaming message sent');
    return result.message_id;
  }

  async editMessage(jid: string, messageId: number, text: string): Promise<void> {
    if (!this.bot) return;

    try {
      const numericId = jid.replace(/^tg:/, '');
      const MAX_LENGTH = 4096;
      const trimmed = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH - 3) + '...' : text;
      try {
        await this.bot.api.editMessageText(numericId, messageId, trimmed, { parse_mode: 'Markdown' });
      } catch {
        await this.bot.api.editMessageText(numericId, messageId, trimmed);
      }
    } catch (err: any) {
      // Telegram returns 400 if text is unchanged — ignore silently
      if (err?.description?.includes('message is not modified')) return;
      logger.debug({ jid, messageId, err }, 'Failed to edit Telegram message');
    }
  }

  isConnected(): boolean {
    return this.bot !== null;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('tg:');
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      logger.info('Telegram bot stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.bot || !isTyping) return;
    try {
      const numericId = jid.replace(/^tg:/, '');
      await this.bot.api.sendChatAction(numericId, 'typing');
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Telegram typing indicator');
    }
  }
}
