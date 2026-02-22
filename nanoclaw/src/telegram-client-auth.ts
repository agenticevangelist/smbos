/**
 * Telegram Client Authentication Script
 *
 * Connects to Telegram as a real user account (MTProto/userbot).
 * Uses QR code login — no OTP needed.
 *
 * Prerequisites:
 *   TELEGRAM_API_ID and TELEGRAM_API_HASH in nanoclaw/.env
 *
 * Usage:
 *   npm run auth:telegram
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import qrcode from 'qrcode-terminal';

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

import { readEnvFile } from './env.js';

const SESSION_PATH = './store/telegram-client-session.txt';

const env = readEnvFile(['TELEGRAM_API_ID', 'TELEGRAM_API_HASH']);
const API_ID = parseInt(process.env.TELEGRAM_API_ID || env.TELEGRAM_API_ID || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || env.TELEGRAM_API_HASH || '';

if (!API_ID || !API_HASH) {
  console.error('\n✗ TELEGRAM_API_ID and TELEGRAM_API_HASH are required in nanoclaw/.env\n');
  process.exit(1);
}

function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function authenticate(): Promise<void> {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });

  if (fs.existsSync(SESSION_PATH)) {
    const existing = fs.readFileSync(SESSION_PATH, 'utf-8').trim();
    if (existing) {
      console.log('\n✓ Session file already exists at', SESSION_PATH);
      const reauth = await ask('  Re-authenticate? (y/N): ');
      if (reauth.toLowerCase() !== 'y') {
        console.log('  Restart NanoClaw to apply.\n');
        process.exit(0);
      }
    }
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();

  console.log('\n  Logging in via QR code...');
  console.log('  1. Open Telegram on your phone');
  console.log('  2. Settings → Devices → Link Desktop Device');
  console.log('  3. Scan the QR code below:\n');

  await (client as any).signInUserWithQrCode(
    { apiId: API_ID, apiHash: API_HASH },
    {
      qrCode: async (qr: { token: Buffer; expires: number }) => {
        const tokenB64 = qr.token.toString('base64url');
        const url = `tg://login?token=${tokenB64}`;
        qrcode.generate(url, { small: true });
        console.log('\n  Waiting for scan...\n');
      },
      password: async () => {
        return ask('  2FA password: ');
      },
      onError: async (err: Error) => {
        console.error('  QR error:', err.message);
        return true;
      },
    },
  );

  const savedSession = client.session.save() as unknown as string;
  fs.writeFileSync(SESSION_PATH, savedSession, 'utf-8');

  const me = await client.getMe();
  const username = (me as any).username || (me as any).phone || 'unknown';

  await client.disconnect();

  console.log(`\n✓ Authenticated as @${username}`);
  console.log(`  Session saved to ${SESSION_PATH}`);
  console.log('\n  Add to nanoclaw/.env:');
  console.log('    TELEGRAM_CLIENT=true\n');
  console.log('  Then restart NanoClaw.\n');
}

authenticate().catch((err) => {
  console.error('\nAuthentication failed:', err.message);
  process.exit(1);
});
