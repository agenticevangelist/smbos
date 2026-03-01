import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const session = new StringSession(fs.readFileSync(path.join(__dirname,'store/session2.txt'),'utf8').trim());
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 3,
  baseLogger: { warn:()=>{}, info:()=>{}, debug:()=>{}, error:()=>{} }
});
await client.connect();

const queries = [
  'YC founders',
  'Y Combinator',
  'startup founders',
  'стартап основатели',
  'YC русские',
  'tech startup jobs',
  'startup hiring',
  'инди хакеры',
  'indie hackers',
  'SaaS founders',
  'стартап вакансии',
  'startup jobs russia',
  'vc founders',
  'product hunt',
  'tech founders community',
  'AI startup founders',
  'стартапы найм',
  'YC batch',
  'AngelList founders',
];

const found = {};

for (const q of queries) {
  try {
    const res = await client.invoke(new Api.contacts.Search({ q, limit: 10 }));
    for (const chat of [...(res.chats||[]), ...(res.users||[])]) {
      const title = chat.title || chat.username || '';
      const username = chat.username || '';
      const id = chat.id?.toString();
      if (!id || found[id]) continue;
      const memberCount = chat.participantsCount || chat.membersCount || '?';
      found[id] = { title, username, memberCount, query: q };
    }
    await new Promise(r => setTimeout(r, 1500));
  } catch(e) {
    if (e.message?.includes('FLOOD')) {
      console.log(`FloodWait на "${q}", пауза 30с...`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

const results = Object.values(found)
  .sort((a,b) => (b.memberCount||0) - (a.memberCount||0));

console.log(`\nНайдено: ${results.length} каналов/групп\n`);
results.forEach(r => {
  console.log(`[${r.memberCount}] @${r.username || 'private'} — ${r.title}`);
  console.log(`  (запрос: "${r.query}")`);
});

fs.writeFileSync('/tmp/yc_groups.json', JSON.stringify(results, null, 2));
await client.disconnect();
