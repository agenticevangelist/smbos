import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
const c = new TelegramClient(new StringSession(fs.readFileSync('store/session.txt','utf8').trim()),33887530,'fc51f19b4b6ff9f0b8cbd5c4005e9ee4',{connectionRetries:2});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const SENT = JSON.parse(fs.readFileSync('store/sent.json','utf8'));
const SEEN = JSON.parse(fs.existsSync('/tmp/gs2_seen.json') ? fs.readFileSync('/tmp/gs2_seen.json','utf8') : '{}');
await c.connect();
const queries = [
  'нужен разработчик telegram',
  'ищу разработчика бот',
  'нужен чат бот для бизнеса',
  'нужно мобильное приложение заказать',
  'кто делает telegram bot',
  'нужен программист питон',
  'ищу разработчика AI агент',
  'нужен сайт разработчик',
  'автоматизация бизнеса нужен',
];
const results = [];
for (const q of queries) {
  try {
    const res = await c.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now()/1000) - 14*24*3600,
      maxDate: 0, offsetRate: 0, offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(), limit: 20,
    }));
    for (const msg of res.messages || []) {
      if (!msg.message) continue;
      const uid = msg.fromId?.userId?.toString() || '';
      if (!uid || SENT[uid]) continue;
      const key = uid+'_'+msg.id;
      if (SEEN[key]) continue;
      SEEN[key] = 1;
      let uname = '';
      try { uname = (await c.getEntity(BigInt(uid)))?.username||''; } catch {}
      if (SENT[uname] || uname==='aisceptic0') continue;
      results.push({q, uname, uid, text: msg.message.slice(0,200)});
    }
    await sleep(2500);
  } catch(e) {
    if (e.message?.includes('FLOOD')) { await sleep(15000); }
  }
}
fs.writeFileSync('/tmp/gs2_seen.json', JSON.stringify(SEEN));
console.log('Найдено: '+results.length);
for (const r of results) {
  console.log('@'+(r.uname||r.uid)+' ['+r.q+']');
  console.log(r.text);
  console.log('---');
}
process.exit(0);
