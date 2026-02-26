#!/usr/bin/env node
import { resolve } from 'path';
import { config } from 'dotenv';
import { Command } from 'commander';
// Load .env from tgcli root
config({ path: resolve(import.meta.dirname, '..', '.env') });
import { disconnect, getMe, listChats, getMessages, searchChats, sendMessage, hasSession, getSessionPath, } from './client.js';
const program = new Command();
program
    .name('tgcli')
    .description('Telegram Client CLI (MTProto userbot)')
    .version('1.0.0');
// --- auth ---
program
    .command('auth')
    .description('Authenticate via QR code (scan with Telegram app)')
    .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const readline = await import('readline');
    const qrcode = await import('qrcode-terminal');
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions/index.js');
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    if (!apiId || !apiHash) {
        console.error('TELEGRAM_API_ID and TELEGRAM_API_HASH required in .env');
        process.exit(1);
    }
    const sessionPath = getSessionPath();
    if (hasSession()) {
        console.log(`Session exists at ${sessionPath}`);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((res) => rl.question('Re-authenticate? (y/N): ', (a) => { rl.close(); res(a.trim()); }));
        if (answer.toLowerCase() !== 'y') {
            process.exit(0);
        }
    }
    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });
    await client.connect();
    console.log('\nLogging in via QR code...');
    console.log('1. Open Telegram on your phone');
    console.log('2. Settings > Devices > Link Desktop Device');
    console.log('3. Scan the QR code below:\n');
    await client.signInUserWithQrCode({ apiId, apiHash }, {
        qrCode: async (qr) => {
            const tokenB64 = qr.token.toString('base64url');
            const url = `tg://login?token=${tokenB64}`;
            qrcode.default.generate(url, { small: true });
            console.log('\nWaiting for scan...\n');
        },
        password: async () => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            return new Promise((res) => rl.question('2FA password: ', (a) => { rl.close(); res(a.trim()); }));
        },
        onError: async (err) => {
            console.error('QR error:', err.message);
            return true;
        },
    });
    const savedSession = client.session.save();
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, savedSession, 'utf-8');
    const me = await client.getMe();
    const username = me.username || me.phone || 'unknown';
    await client.disconnect();
    console.log(`\nAuthenticated as @${username}`);
    console.log(`Session saved to ${sessionPath}\n`);
});
// --- status ---
program
    .command('status')
    .description('Check connection and account info')
    .option('--json', 'Output JSON')
    .action(async (opts) => {
    try {
        const me = await getMe();
        if (opts.json) {
            console.log(JSON.stringify({ ok: true, ...me }));
        }
        else {
            console.log(`Connected: @${me.username || me.phone} (id: ${me.id})`);
        }
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: err.message }));
        }
        else {
            console.error('Not connected:', err.message);
        }
        process.exitCode = 1;
    }
    finally {
        await disconnect();
    }
});
// --- chats ---
program
    .command('chats')
    .description('List recent chats/channels/groups')
    .option('--limit <n>', 'Max chats to return', '50')
    .option('--query <q>', 'Filter by name')
    .option('--json', 'Output JSON')
    .action(async (opts) => {
    try {
        const chats = await listChats(parseInt(opts.limit, 10), opts.query);
        if (opts.json) {
            console.log(JSON.stringify(chats));
        }
        else {
            if (chats.length === 0) {
                console.log('No chats found.');
                return;
            }
            for (const c of chats) {
                const unread = c.unreadCount > 0 ? ` (${c.unreadCount} unread)` : '';
                console.log(`[${c.type}] ${c.name} — id:${c.id}${unread}`);
            }
        }
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ error: err.message }));
        }
        else {
            console.error('Error:', err.message);
        }
        process.exitCode = 1;
    }
    finally {
        await disconnect();
    }
});
// --- messages ---
program
    .command('messages <chatId>')
    .description('Get message history from a chat')
    .option('--limit <n>', 'Max messages', '30')
    .option('--json', 'Output JSON')
    .action(async (chatId, opts) => {
    try {
        const msgs = await getMessages(chatId, parseInt(opts.limit, 10));
        if (opts.json) {
            console.log(JSON.stringify(msgs));
        }
        else {
            if (msgs.length === 0) {
                console.log('No messages found.');
                return;
            }
            for (const m of msgs.reverse()) {
                const direction = m.out ? '→' : '←';
                const date = new Date(m.date).toLocaleString();
                console.log(`${direction} [${date}] ${m.senderName}: ${m.text}`);
            }
        }
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ error: err.message }));
        }
        else {
            console.error('Error:', err.message);
        }
        process.exitCode = 1;
    }
    finally {
        await disconnect();
    }
});
// --- search ---
program
    .command('search <query>')
    .description('Search contacts and chats')
    .option('--limit <n>', 'Max results', '20')
    .option('--json', 'Output JSON')
    .action(async (query, opts) => {
    try {
        const results = await searchChats(query, parseInt(opts.limit, 10));
        if (opts.json) {
            console.log(JSON.stringify(results));
        }
        else {
            if (results.length === 0) {
                console.log('No results found.');
                return;
            }
            for (const r of results) {
                console.log(`[${r.type}] ${r.name} — id:${r.id}`);
            }
        }
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ error: err.message }));
        }
        else {
            console.error('Error:', err.message);
        }
        process.exitCode = 1;
    }
    finally {
        await disconnect();
    }
});
// --- send ---
program
    .command('send <chatId> <text>')
    .description('Send a message to a chat')
    .option('--json', 'Output JSON')
    .action(async (chatId, text, opts) => {
    try {
        const result = await sendMessage(chatId, text);
        if (opts.json) {
            console.log(JSON.stringify({ ok: true, ...result }));
        }
        else {
            console.log(`Message sent (id: ${result.messageId})`);
        }
    }
    catch (err) {
        if (opts.json) {
            console.log(JSON.stringify({ ok: false, error: err.message }));
        }
        else {
            console.error('Error:', err.message);
        }
        process.exitCode = 1;
    }
    finally {
        await disconnect();
    }
});
program.parse();
