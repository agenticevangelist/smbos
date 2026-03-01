import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const phone = process.argv[2];
if (!phone) { console.error('Usage: node auth2_step1.mjs +XXXXXXXXXXX'); process.exit(1); }

const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';

const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, { connectionRetries: 3 });
await client.connect();

const result = await client.invoke(new Api.auth.SendCode({
  phoneNumber: phone,
  apiId: API_ID,
  apiHash: API_HASH,
  settings: new Api.CodeSettings({})
}));

fs.writeFileSync('/tmp/auth2_state.json', JSON.stringify({
  phone,
  phoneCodeHash: result.phoneCodeHash,
  session: client.session.save()
}));

console.log('✅ Код отправлен на', phone);
console.log('Пришли код: node auth2_step2.mjs 12345');
await client.disconnect();
