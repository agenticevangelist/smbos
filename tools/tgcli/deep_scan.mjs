import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const session = new StringSession(fs.readFileSync(path.join(__dirname,'store/session.txt'),'utf8').trim());
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

const sent = JSON.parse(fs.readFileSync('store/sent.json','utf8').trim()||'{}');
const cache = JSON.parse(fs.readFileSync('/tmp/cs_entity_cache.json','utf8'));

// Лёгкий scoring — ищем реальных клиентов
const SPAM_RE = /предлагаю|мои услуги|портфолио|ищу заказы|делаю сайты|разрабатываю|принимаю заказы|беру проекты|#помогу|техспец|техническийспециалист|геткурс|getcourse|фриланс|фрилансер/i;
const CLIENT_RE = /нужен (разработчик|программист|бот|сайт|лендинг|crm|автоматизация|интегр)|ищу (разработчика|программиста|исполнителя|фрилансера)|кто делает (бот|сайт|приложение)|посоветуйте (разработчика|программиста)|хочу (заказать|сделать|разработать|автоматизировать)|требуется разработ|hire|нужна автоматизация|нужен бот|нужен сайт|ищем разработчика|wolt|bolt|glovo|агрегатор доставки|подключить(ся)? к wolt|подключ.{1,20}агрегат|проблема с wolt|как выйти на wolt/i;

const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3, baseLogger: { warn:()=>{}, info:()=>{}, debug:()=>{}, error:()=>{} } });
await client.connect();

const leads = [];
const skipIds = new Set(['8466294883','7310390783']);

for (const [grpKey, info] of Object.entries(cache)) {
  try {
    const peer = new Api.InputPeerChannel({
      channelId: BigInt(info.id),
      accessHash: BigInt(info.accessHash)
    });
    const res = await client.invoke(new Api.messages.GetHistory({
      peer, limit: 500, offsetId:0, offsetDate:0, addOffset:0, maxId:0, minId:0, hash: BigInt(0)
    }));
    const userMap = {};
    for (const u of (res.users||[])) {
      userMap[u.id.toString()] = u;
    }
    for (const msg of (res.messages||[])) {
      if (!msg.message) continue;
      const uid = msg.fromId?.userId?.toString();
      if (!uid || skipIds.has(uid)) continue;
      const user = userMap[uid];
      if (!user || user.bot) continue;
      const uname = user.username;
      if (sent[uname] || sent[uid]) continue;
      if (SPAM_RE.test(msg.message)) continue;
      if (!CLIENT_RE.test(msg.message)) continue;
      
      leads.push({
        username: uname || null,
        id: uid,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        group: grpKey,
        text: msg.message.slice(0, 200),
        msgId: msg.id
      });
    }
    await new Promise(r => setTimeout(r, 500));
  } catch(e) { /* skip */ }
}

// Дедупликация по юзеру
const seen = new Set();
const unique = leads.filter(l => {
  const k = l.username || l.id;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

fs.writeFileSync('/tmp/deep_scan.json', JSON.stringify(unique, null, 2));
console.log(`Найдено лидов: ${unique.length}`);
unique.forEach(l => {
  console.log(`\n[@${l.username||l.id}] (${l.name}) — @${l.group}`);
  console.log(`"${l.text}"`);
});
await client.disconnect();
