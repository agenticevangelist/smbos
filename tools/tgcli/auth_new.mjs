import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import fs from 'fs';
import readline from 'readline';

const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';
const PHONE = process.argv[2];
const SESSION_OUT = process.argv[3] || 'store/session2.txt';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, { connectionRetries: 3 });
await client.connect();

console.log(`📱 Отправляю код на ${PHONE}...`);
const result = await client.sendCode({ apiId: API_ID, apiHash: API_HASH }, PHONE);
console.log(`✅ Код отправлен. phoneCodeHash: ${result.phoneCodeHash}`);

const code = await ask('Введи код из SMS: ');
try {
  const signIn = await client.invoke(new Api.auth.SignIn({
    phoneNumber: PHONE,
    phoneCodeHash: result.phoneCodeHash,
    phoneCode: code.trim()
  }));
  console.log('✅ Авторизован!', signIn.user?.username || signIn.user?.firstName);
} catch(e) {
  if (e.message?.includes('SESSION_PASSWORD_NEEDED')) {
    const pass = await ask('Введи 2FA пароль: ');
    const { computeCheck } = await import('telegram/Password.js');
    const pwd = await client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(pwd, pass.trim());
    await client.invoke(new Api.auth.CheckPassword({ password: check }));
    console.log('✅ Авторизован через 2FA!');
  } else throw e;
}

const sessionStr = client.session.save();
fs.writeFileSync(SESSION_OUT, sessionStr);
console.log(`💾 Сессия сохранена → ${SESSION_OUT}`);
rl.close();
await client.disconnect();
