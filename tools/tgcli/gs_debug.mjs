import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import fs from 'fs';

const SESSION_FILE = '/Users/administrator/Desktop/retree/smbos/tools/tgcli/store/session.txt';
const session = new StringSession(fs.readFileSync(SESSION_FILE, 'utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 });

const QUERIES = ['нужен разработчик', 'нужен бот', 'сделайте сайт', 'ищу программиста', 'нужна автоматизация', 'заказать бота'];

await client.connect();

for (const q of QUERIES) {
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now() / 1000) - 14 * 24 * 3600,
      maxDate: 0, offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0, limit: 25
    }));
    const count = (res.messages || []).length;
    console.log(`"${q}" → ${count} сообщений`);
    if (count > 0) {
      const m = res.messages[0];
      console.log(`  Первое: "${m.message?.slice(0, 80)}"`);
    }
  } catch(e) {
    console.log(`"${q}" → ошибка: ${e.message?.slice(0, 60)}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

await client.disconnect();
