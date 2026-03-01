import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, { connectionRetries: 3 });
await client.start({
  phoneNumber: async () => await ask('Номер телефона (с +): '),
  password: async () => await ask('2FA пароль (если есть): '),
  phoneCode: async () => await ask('Код из Telegram: '),
  onError: (err) => console.error(err),
});

const sessionStr = client.session.save();
fs.writeFileSync(path.join(__dirname, 'store/session2.txt'), sessionStr);
console.log('✅ Второй аккаунт авторизован! Сессия: store/session2.txt');
rl.close();
await client.disconnect();
