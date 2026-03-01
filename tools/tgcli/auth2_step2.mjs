import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = process.argv[2];
if (!code) { console.error('Usage: node auth2_step2.mjs КОД'); process.exit(1); }

const state = JSON.parse(fs.readFileSync('/tmp/auth2_state.json', 'utf8'));
const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';

const client = new TelegramClient(new StringSession(state.session), API_ID, API_HASH, { connectionRetries: 3 });
await client.connect();

try {
  await client.invoke(new Api.auth.SignIn({
    phoneNumber: state.phone,
    phoneCodeHash: state.phoneCodeHash,
    phoneCode: code.toString()
  }));

  const sessionStr = client.session.save();
  fs.writeFileSync(path.join(__dirname, 'store/session2.txt'), sessionStr);
  const me = await client.getMe();
  console.log('✅ Авторизован:', me.firstName, me.lastName || '', '@' + (me.username || 'нет username'));
  console.log('Сессия сохранена: store/session2.txt');
} catch(e) {
  if (e.message?.includes('SESSION_PASSWORD_NEEDED')) {
    console.log('Нужен 2FA пароль — пришли: node auth2_step3.mjs ПАРОЛЬ');
    fs.writeFileSync('/tmp/auth2_state.json', JSON.stringify({...state, needsPassword: true}));
  } else {
    console.error('Ошибка:', e.message);
  }
}
await client.disconnect();
