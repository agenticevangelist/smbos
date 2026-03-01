import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const client = new TelegramClient(
  new StringSession(fs.readFileSync('/Users/administrator/Desktop/retree/smbos/tools/tgcli/store/session.txt','utf8').trim()),
  33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4',
  { connectionRetries: 3 }
);

const NEED_LEAD = [
  /нужен.*бот/i, /заказать.*бот/i, /нужен.*разработчик/i, /ищу.*разработчик/i,
  /нужно.*сделать.*сайт/i, /нужен.*лендинг/i, /кто делает/i, /порекомендуйте.*разработ/i,
  /нужна.*crm/i, /нужна.*автоматизация/i, /нужен.*парсер/i, /нужно.*приложение/i,
  /ищем.*разработчик/i, /хочу.*заказать/i, /нужно.*интегрир/i,
  /telegram.*(бот|bot)/i, /чат.*(бот|bot)/i, /mini.?app/i,
  /ищу.*подряд/i, /фрилансер.*(нужен|ищу)/i, /кто может (сделать|разработать)/i,
];

const SENT = JSON.parse(fs.existsSync('store/sent.json') ? fs.readFileSync('store/sent.json','utf8') : '{}');
const SEEN = JSON.parse(fs.existsSync('/tmp/scan_seen.json') ? fs.readFileSync('/tmp/scan_seen.json','utf8') : '{}');

await client.connect();
const dialogs = await client.getDialogs({ limit: 200 });
const groups = dialogs.filter(d => (d.isGroup || d.isChannel) && d.entity?.megagroup !== false);

console.log(`Всего диалогов-групп: ${groups.length}`);

const leads = [];
const since = Math.floor(Date.now()/1000) - 86400; // 24 часа

for (const g of groups.slice(0, 80)) {
  const title = g.title || g.name || '';
  try {
    const msgs = await client.getMessages(g.entity, { limit: 30 });
    for (const m of msgs) {
      if (!m.message || m.date < since) continue;
      if (!NEED_LEAD.some(r => r.test(m.message))) continue;
      
      const sender = m.fromId?.userId?.toString() || m.senderId?.toString() || '';
      const key = `${sender}_${m.id}`;
      if (SEEN[key]) continue;
      SEEN[key] = 1;
      
      leads.push({
        group: title,
        msg: m.message.slice(0, 200),
        sender,
        msgId: m.id,
        date: new Date(m.date * 1000).toISOString()
      });
    }
    await new Promise(r => setTimeout(r, 500));
  } catch(e) {
    // skip
  }
}

fs.writeFileSync('/tmp/scan_seen.json', JSON.stringify(SEEN));
fs.writeFileSync('/tmp/scan_results.json', JSON.stringify(leads, null, 2));
console.log(`Найдено лидов: ${leads.length}`);
for (const l of leads) {
  console.log(`\n[${l.group}] ${l.date}`);
  console.log(l.msg);
  console.log(`sender_id: ${l.sender}`);
}
process.exit(0);
