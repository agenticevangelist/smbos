// Отправка через access_hash из кеша групп — без ResolveUsername
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', {connectionRetries:3});

const BOT_TOKEN = '8525580677:AAFxYCIP9Fi8Rlp_iy8ByeL_wYhyOSF766c';
const DAVID_ID = '7981171680';
const SENT_FILE = '/tmp/cs_sent.json';

async function tg(text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: DAVID_ID, text, parse_mode:'HTML' })
  });
}

// Целевые лиды: id -> { username, msg }
const TARGETS = {
  '5890356231': { username: 'lowxn',          msg: `Привет! Я как раз делаю Telegram боты для автоматизации заявок и записи на консультации. Покажу примеры если интересно, напишите что нужно?` },
  '1366649367': { username: 'Banti_lll',       msg: `Привет! Увидел вопрос про автоматизацию приёма заявок и CRM. Занимаюсь как раз этим — чат-боты, лёгкие CRM, интеграции под конкретную задачу. Если интересно, могу показать примеры. Какой у вас бизнес?` },
  '6471642053': { username: null,              msg: `Привет! Увидел что нужен программист для одностраничного сайта. Занимаюсь разработкой, могу сделать быстро. Что за проект?` },
  '5127678183': { username: 'lenaveryasova2010', msg: `Привет! Увидел вопрос про сайты на Тильде. Делаю сайты и лендинги. Напишите что нужно — обсудим?` },
  '805831375':  { username: 'Lolii2003',       msg: `Привет! Увидел пост про поиск разработчика на проекты. Занимаюсь full-stack и AI автоматизацией (Python/JS, FastAPI, боты). Формат 1-2 проекта в месяц подходит. Можем пообщаться?` },
};

const cache = JSON.parse(fs.readFileSync('/tmp/cs_entity_cache.json','utf8'));
const sent = JSON.parse(fs.readFileSync(SENT_FILE,'utf8').trim()||'{}');

await client.connect();

// Собираем access_hash пользователей из истории групп
const userCache = {}; // id -> { id, accessHash }

for (const [uname, info] of Object.entries(cache)) {
  try {
    const peer = new Api.InputPeerChannel({
      channelId: BigInt(info.id),
      accessHash: BigInt(info.accessHash)
    });
    const res = await client.invoke(new Api.messages.GetHistory({
      peer, limit: 100, offsetId:0, offsetDate:0, addOffset:0, maxId:0, minId:0, hash: BigInt(0)
    }));
    for (const u of (res.users||[])) {
      const uid = u.id.toString();
      if (TARGETS[uid] && !userCache[uid]) {
        userCache[uid] = { id: u.id, accessHash: u.accessHash };
        console.log(`Нашёл access_hash для ${uid} (@${u.username || 'нет username'})`);
      }
    }
    await new Promise(r=>setTimeout(r,800));
  } catch(e) { /* ignore */ }
}

console.log(`Собрано access_hash: ${Object.keys(userCache).length}/${Object.keys(TARGETS).length}`);

// Отправляем
for (const [id, target] of Object.entries(TARGETS)) {
  const sk = target.username || id;
  if (sent[sk]) { console.log(`skip ${sk}`); continue; }

  const uc = userCache[id];
  if (!uc) { console.log(`нет access_hash для ${sk}`); continue; }

  try {
    const peer = new Api.InputPeerUser({ userId: uc.id, accessHash: uc.accessHash });
    await client.invoke(new Api.messages.SendMessage({
      peer,
      message: target.msg,
      randomId: BigInt(Math.floor(Math.random() * 1e15))
    }));
    sent[sk] = { ts: Date.now(), msg: target.msg.slice(0,80) };
    fs.writeFileSync(SENT_FILE, JSON.stringify(sent,null,2));
    console.log(`✅ Отправлено @${sk}`);
    await tg(`🟢 <b>Написал</b> @${target.username||id}\n<i>${target.msg.slice(0,100)}</i>`);
    await new Promise(r=>setTimeout(r,3000));
  } catch(e) {
    console.error(`❌ @${sk}: ${e.message?.slice(0,100)}`);
    await tg(`⚠️ Не удалось @${target.username||id}: ${e.message?.slice(0,80)}`);
  }
}

await client.disconnect();
console.log('Готово');
