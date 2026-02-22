import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  ASSISTANT_NAME,
  DATA_DIR,
  MAIN_GROUP_FOLDER,
  POLL_INTERVAL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_CLIENT,
  TRIGGER_PATTERN,
  WEB_CHAT_JID,
  WEB_CHAT_FOLDER,
} from './config.js';
import { TelegramChannel } from './channels/telegram.js';
import { TelegramClientChannel } from './channels/telegram-client.js';
import {
  ContainerOutput,
  runContainerAgent,
  writeGroupsSnapshot,
  writeTasksSnapshot,
} from './container-runner.js';
import {
  getAllRegisteredGroups,
  getAllSessions,
  getAllTasks,
  getNewMessages,
  getRouterState,
  initDatabase,
  setRegisteredGroup,
  setRouterState,
  setSession,
  storeChatMetadata,
  storeMessage,
  storeMessageDirect,
} from './db.js';
import { GroupQueue } from './group-queue.js';
import { escapeXml, findChannel, formatMessages, formatOutbound, stripInternalTags } from './router.js';
import { Channel, RegisteredGroup } from './types.js';
import { startHttpServer, stopHttpServer } from './http-server.js';
import { startIpcWatcher } from './ipc.js';
import { logger } from './logger.js';

// Re-export for backwards compatibility during refactor
export { escapeXml, formatMessages } from './router.js';

let sessions: Record<string, string> = {};
let registeredGroups: Record<string, RegisteredGroup> = {};
const channels: Channel[] = [];

const queue = new GroupQueue();

function loadState(): void {
  sessions = getAllSessions();
  registeredGroups = getAllRegisteredGroups();

  // Restore last processed timestamps from router state
  const raw = getRouterState('last_agent_timestamp');
  if (raw) {
    try {
      lastTimestamps = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  logger.info(
    { groupCount: Object.keys(registeredGroups).length },
    'State loaded',
  );
}

function registerGroup(jid: string, group: RegisteredGroup): void {
  registeredGroups[jid] = group;
  setRegisteredGroup(jid, group);

  // Create group folder
  const groupDir = path.join(DATA_DIR, '..', 'groups', group.folder);
  fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

  logger.info(
    { jid, name: group.name, folder: group.folder },
    'Group registered',
  );
}

/**
 * Get available groups list for the agent.
 */
export function getAvailableGroups(): import('./container-runner.js').AvailableGroup[] {
  return [];
}

/** @internal - exported for testing */
export function _setRegisteredGroups(groups: Record<string, RegisteredGroup>): void {
  registeredGroups = groups;
}

async function runAgent(
  group: RegisteredGroup,
  prompt: string,
  chatJid: string,
  onOutput?: (output: ContainerOutput) => Promise<void>,
  onStreamText?: (text: string) => Promise<void>,
): Promise<'success' | 'error'> {
  const isMain = group.folder === MAIN_GROUP_FOLDER;
  const sessionId = sessions[group.folder];

  // Update tasks snapshot for container to read (filtered by group)
  const tasks = getAllTasks();
  writeTasksSnapshot(
    group.folder,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  // Update available groups snapshot
  const availableGroups = getAvailableGroups();
  writeGroupsSnapshot(
    group.folder,
    isMain,
    availableGroups,
    new Set(Object.keys(registeredGroups)),
  );

  // Wrap onOutput to track session ID from streamed results
  const wrappedOnOutput = onOutput
    ? async (output: ContainerOutput) => {
        if (output.newSessionId) {
          sessions[group.folder] = output.newSessionId;
          setSession(group.folder, output.newSessionId);
        }
        await onOutput(output);
      }
    : undefined;

  try {
    const output = await runContainerAgent(
      group,
      {
        prompt,
        sessionId,
        groupFolder: group.folder,
        chatJid,
        isMain,
      },
      (proc, containerName) => queue.registerProcess(chatJid, proc, containerName, group.folder),
      wrappedOnOutput,
      onStreamText,
    );

    if (output.newSessionId) {
      sessions[group.folder] = output.newSessionId;
      setSession(group.folder, output.newSessionId);
    }

    if (output.status === 'error') {
      logger.error(
        { group: group.name, error: output.error },
        'Container agent error',
      );
      return 'error';
    }

    return 'success';
  } catch (err) {
    logger.error({ group: group.name, err }, 'Agent error');
    return 'error';
  }
}

function ensureContainerSystemRunning(): void {
  try {
    execSync('container system status', { stdio: 'pipe' });
    logger.debug('Apple Container system already running');
  } catch {
    logger.info('Starting Apple Container system...');
    try {
      execSync('container system start', { stdio: 'pipe', timeout: 30000 });
      logger.info('Apple Container system started');
    } catch (err) {
      logger.error({ err }, 'Failed to start Apple Container system');
      console.error('\n╔════════════════════════════════════════════════════════════════╗');
      console.error('║  FATAL: Apple Container system failed to start                 ║');
      console.error('║                                                                ║');
      console.error('║  Agents cannot run without Apple Container. To fix:           ║');
      console.error('║  1. Install from: https://github.com/apple/container/releases ║');
      console.error('║  2. Run: container system start                               ║');
      console.error('║  3. Restart NanoClaw                                          ║');
      console.error('╚════════════════════════════════════════════════════════════════╝\n');
      throw new Error('Apple Container system is required but failed to start');
    }
  }

  // Kill and clean up orphaned NanoClaw containers from previous runs
  try {
    const output = execSync('container ls --format json', {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    const containers: { status: string; configuration: { id: string } }[] = JSON.parse(output || '[]');
    const orphans = containers
      .filter((c) => c.status === 'running' && c.configuration.id.startsWith('nanoclaw-'))
      .map((c) => c.configuration.id);
    for (const name of orphans) {
      try {
        execSync(`container stop ${name}`, { stdio: 'pipe' });
      } catch { /* already stopped */ }
    }
    if (orphans.length > 0) {
      logger.info({ count: orphans.length, names: orphans }, 'Stopped orphaned containers');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to clean up orphaned containers');
  }
}

// --- Message processing for channel-based chats (Telegram, etc.) ---

let lastTimestamps: Record<string, string> = {};

async function processGroupMessages(chatJid: string): Promise<boolean> {
  const group = registeredGroups[chatJid];
  if (!group) return true;

  const lastTs = lastTimestamps[chatJid] || '1970-01-01T00:00:00.000Z';
  const { messages, newTimestamp } = getNewMessages([chatJid], lastTs, ASSISTANT_NAME);

  if (messages.length === 0) return true;

  // Check trigger pattern
  if (group.requiresTrigger !== false) {
    const triggered = messages.some((m) => TRIGGER_PATTERN.test(m.content));
    if (!triggered) {
      lastTimestamps[chatJid] = newTimestamp;
      setRouterState('last_agent_timestamp', JSON.stringify(lastTimestamps));
      return true;
    }
  }

  const channel = findChannel(channels, chatJid);
  if (!channel) {
    logger.warn({ chatJid }, 'No channel found for JID');
    return true;
  }

  await channel.setTyping?.(chatJid, true);

  const prompt = formatMessages(messages);

  // Streaming state for channels that support editMessage (e.g. Telegram)
  const canStream = !!(channel.sendAndGetId && channel.editMessage);
  let streamMsgId: number | null = null;
  let streamAccum = '';
  let lastEditMs = 0;
  let hadStreamText = false;
  const STREAM_THROTTLE_MS = 2000;

  const result = await runAgent(group, prompt, chatJid,
    // onOutput — handles isStreamChunk (fallback) and final result
    async (output) => {
      // isStreamChunk = full assistant turn text. Skip if token-level streaming
      // (streamText via preload) is active — it already sent progressive updates.
      if (output.isStreamChunk) {
        if (hadStreamText) return; // preload handled it
        // Fallback: if preload didn't fire, use turn-level streaming
        if (output.result && canStream) {
          const raw = typeof output.result === 'string' ? output.result : JSON.stringify(output.result);
          const text = formatOutbound(raw);
          if (!text) return;
          if (!streamMsgId) {
            streamMsgId = await channel.sendAndGetId!(chatJid, text);
            lastEditMs = Date.now();
          } else {
            await channel.editMessage!(chatJid, streamMsgId, text);
            lastEditMs = Date.now();
          }
        }
        return;
      }

      // Final result
      if (output.result) {
        const raw = typeof output.result === 'string' ? output.result : JSON.stringify(output.result);
        const text = formatOutbound(raw);
        if (text) {
          if (streamMsgId && channel.editMessage) {
            // Edit the streaming message with clean final text
            await channel.editMessage(chatJid, streamMsgId, text);
          } else {
            await channel.sendMessage(chatJid, text);
          }
          // Store bot response in DB
          storeMessageDirect({
            id: `bot-${Date.now()}`,
            chat_jid: chatJid,
            sender: 'bot',
            sender_name: ASSISTANT_NAME,
            content: text,
            timestamp: new Date().toISOString(),
            is_from_me: true,
            is_bot_message: true,
          });
        }
      }
      if (output.status === 'error' && output.error) {
        logger.error({ chatJid, error: output.error }, 'Agent error during message processing');
      }

      // Reset streaming state so the next response creates a fresh message
      streamMsgId = null;
      streamAccum = '';
      hadStreamText = false;
    },
    // onStreamText — token-level streaming from preload fetch interceptor
    canStream
      ? async (text) => {
          hadStreamText = true;
          streamAccum += text;
          const cleaned = stripInternalTags(streamAccum);
          if (!cleaned) return;
          const now = Date.now();
          if (!streamMsgId) {
            streamMsgId = await channel.sendAndGetId!(chatJid, cleaned);
            lastEditMs = now;
          } else if (now - lastEditMs >= STREAM_THROTTLE_MS) {
            await channel.editMessage!(chatJid, streamMsgId, cleaned);
            lastEditMs = now;
          }
        }
      : undefined,
  );

  await channel.setTyping?.(chatJid, false);

  lastTimestamps[chatJid] = newTimestamp;
  setRouterState('last_agent_timestamp', JSON.stringify(lastTimestamps));

  return result === 'success';
}

let messageLoopTimer: ReturnType<typeof setInterval> | null = null;

function startMessageLoop(): void {
  queue.setProcessMessagesFn(processGroupMessages);

  messageLoopTimer = setInterval(() => {
    for (const jid of Object.keys(registeredGroups)) {
      // Skip web-chat — handled by HTTP SSE
      if (jid === WEB_CHAT_JID) continue;
      queue.enqueueMessageCheck(jid);
    }
  }, POLL_INTERVAL);

  logger.info({ intervalMs: POLL_INTERVAL }, 'Message loop started');
}

async function main(): Promise<void> {
  ensureContainerSystemRunning();
  initDatabase();
  logger.info('Database initialized');
  loadState();

  // Global additional mounts — applied to all groups
  const globalMounts = {
    additionalMounts: [
      {
        hostPath: '~/Desktop/retree/combined-vault',
        containerPath: 'combined-vault',
        readonly: false,
      },
    ],
  };

  // Auto-register web-chat group for HTTP sidebar
  if (!registeredGroups[WEB_CHAT_JID]) {
    registerGroup(WEB_CHAT_JID, {
      name: 'Web Chat',
      folder: WEB_CHAT_FOLDER,
      trigger: '',
      added_at: new Date().toISOString(),
      requiresTrigger: false,
      containerConfig: globalMounts,
    });
  }

  // Ensure all registered groups have the global mounts
  for (const [jid, group] of Object.entries(registeredGroups)) {
    if (!group.containerConfig?.additionalMounts?.length) {
      group.containerConfig = globalMounts;
      setRegisteredGroup(jid, group);
    }
  }

  // Start HTTP server for web chat
  startHttpServer(async (message, sse) => {
    const group = registeredGroups[WEB_CHAT_JID];
    if (!group) {
      sse.sendEvent('error', { text: 'Web chat group not registered' });
      return;
    }

    const timestamp = new Date().toISOString();

    // Store user message
    storeMessageDirect({
      id: `web-${Date.now()}`,
      chat_jid: WEB_CHAT_JID,
      sender: 'User',
      sender_name: 'User',
      content: message,
      timestamp,
      is_from_me: false,
      is_bot_message: false,
    });

    const prompt = `<messages>\n<message sender="User" time="${timestamp}">${escapeXml(message)}</message>\n</messages>`;

    const result = await runAgent(group, prompt, WEB_CHAT_JID, async (output) => {
      // Skip stream chunks for web-chat — SSE sends final result only
      if (output.isStreamChunk) return;

      if (output.result) {
        const raw = typeof output.result === 'string' ? output.result : JSON.stringify(output.result);
        const text = raw.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
        if (text) {
          sse.sendEvent('message', { text });
          // Store bot response
          storeMessageDirect({
            id: `bot-${Date.now()}`,
            chat_jid: WEB_CHAT_JID,
            sender: 'bot',
            sender_name: ASSISTANT_NAME,
            content: text,
            timestamp: new Date().toISOString(),
            is_from_me: true,
            is_bot_message: true,
          });
        }
      }
      if (output.status === 'error') {
        sse.sendEvent('error', { text: output.error || 'Agent error' });
      }
    });

    if (result === 'error') {
      sse.sendEvent('error', { text: 'Agent failed to process message' });
    }
  });

  // Connect Telegram channel if token is configured
  if (TELEGRAM_BOT_TOKEN) {
    const telegram = new TelegramChannel(TELEGRAM_BOT_TOKEN, {
      dataDir: DATA_DIR,
      onMessage: (chatJid, msg) => {
        storeMessage(msg);
        // If this chat already has an active container session, forward
        // follow-up user text directly via IPC instead of waiting for idle timeout.
        const forwarded = queue.sendMessage(chatJid, formatMessages([msg]));
        if (forwarded) {
          const prevTs = lastTimestamps[chatJid];
          if (!prevTs || msg.timestamp > prevTs) {
            lastTimestamps[chatJid] = msg.timestamp;
            setRouterState('last_agent_timestamp', JSON.stringify(lastTimestamps));
          }
          return;
        }
        queue.enqueueMessageCheck(chatJid);
      },
      onChatMetadata: storeChatMetadata,
      registeredGroups: () => registeredGroups,
    });
    channels.push(telegram);
    await telegram.connect();
    logger.info('Telegram channel connected');
  }

  // Connect Telegram client (userbot) if configured
  let telegramClientRef: import('./channels/telegram-client.js').TelegramClientChannel | null = null;
  if (TELEGRAM_CLIENT && TELEGRAM_API_ID && TELEGRAM_API_HASH) {
    const sessionPath = path.join(DATA_DIR, '..', 'store', 'telegram-client-session.txt');
    const telegramClient = new TelegramClientChannel({
      apiId: TELEGRAM_API_ID,
      apiHash: TELEGRAM_API_HASH,
      sessionPath,
      onMessage: (chatJid, msg) => {
        storeMessage(msg);
        const forwarded = queue.sendMessage(chatJid, formatMessages([msg]));
        if (forwarded) {
          const prevTs = lastTimestamps[chatJid];
          if (!prevTs || msg.timestamp > prevTs) {
            lastTimestamps[chatJid] = msg.timestamp;
            setRouterState('last_agent_timestamp', JSON.stringify(lastTimestamps));
          }
          return;
        }
        queue.enqueueMessageCheck(chatJid);
      },
      onChatMetadata: storeChatMetadata,
      registeredGroups: () => registeredGroups,
    });
    channels.push(telegramClient);
    await telegramClient.connect();
    telegramClientRef = telegramClient;
    logger.info('Telegram client channel connected');
  }

  // Start IPC watcher (processes send_message, task commands, and Telegram queries from containers)
  startIpcWatcher({
    sendMessage: async (jid: string, text: string) => {
      const channel = findChannel(channels, jid);
      if (channel) {
        await channel.sendMessage(jid, text);
      } else {
        logger.warn({ jid }, 'IPC send_message: no channel found for JID');
      }
    },
    registeredGroups: () => registeredGroups,
    registerGroup,
    syncGroupMetadata: async () => {},
    getAvailableGroups,
    writeGroupsSnapshot,
    telegramListChats: telegramClientRef
      ? (limit) => telegramClientRef!.listDialogs(limit)
      : undefined,
    telegramGetMessages: telegramClientRef
      ? (chatId, limit) => telegramClientRef!.fetchMessages(chatId, limit)
      : undefined,
    telegramSearchChats: telegramClientRef
      ? (query, limit) => telegramClientRef!.searchChats(query, limit)
      : undefined,
  });

  // Start message processing loop for channel-based chats
  if (channels.length > 0) {
    startMessageLoop();
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    if (messageLoopTimer) clearInterval(messageLoopTimer);
    for (const ch of channels) await ch.disconnect();
    await stopHttpServer();
    await queue.shutdown(10000);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Guard: only run when executed directly, not when imported by tests
const isDirectRun =
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  main().catch((err) => {
    logger.error({ err }, 'Failed to start NanoClaw');
    process.exit(1);
  });
}
