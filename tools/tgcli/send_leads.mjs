import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', {connectionRetries:3});

const BOT_TOKEN = '8525580677:AAFxYCIP9Fi8Rlp_iy8ByeL_wYhyOSF766c';
const DAVID_ID = '7981171680';

async function tg(text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: DAVID_ID, text, parse_mode:'HTML' })
  });
}

const leads = [
  {
    id: '5890356231',
    username: 'lowxn',
    msg: `Привет! Я как раз делаю Telegram боты для автоматизации заявок и записи на консультации. Покажу примеры если интересно, напишите что нужно?`
  },
  {
    id: '1366649367',
    username: 'Banti_lll',
    msg: `Привет! Увидел вопрос про автоматизацию приёма заявок и CRM. Занимаюсь как раз этим — чат-боты, лёгкие CRM, интеграции под конкретную задачу. Если интересно, могу показать примеры. Какой у вас бизнес?`
  },
  {
    id: '6471642053',
    username: null,
    msg: `Привет! Увидел что нужен программист для одностраничного сайта. Занимаюсь разработкой, могу сделать быстро и под ваши задачи. Что за проект?`
  },
  {
    id: '5127678183',
    username: 'lenaveryasova2010',
    msg: `Привет! Увидел вопрос про сайты на Тильде. Делаю сайты, лендинги, могу и на Тильде и на кастомных решениях. Напишите что нужно — обсудим?`
  },
  {
    id: '805831375',
    username: 'Lolii2003',
    msg: `Привет! Увидел пост про поиск разработчика на проекты. Занимаюсь full-stack разработкой и AI автоматизацией (Python/JS, FastAPI, боты, интеграции). Формат 1-2 проекта в месяц как раз подходит. Можем пообщаться?`
  },
];

const sentFile = '/tmp/cs_sent.json';
const sent = JSON.parse(fs.readFileSync(sentFile,'utf8').trim()||'{}');

await client.connect();

for (const lead of leads) {
  const key = lead.username || lead.id;
  if (sent[key]) { console.log(`skip ${key} (уже отправлено)`); continue; }
  try {
    let peer;
    if (lead.username) {
      peer = await client.getEntity(lead.username);
    } else {
      // try numeric ID via parseInt
      peer = await client.getEntity(parseInt(lead.id));
    }
    await client.sendMessage(peer, { message: lead.msg });
    sent[key] = { ts: Date.now(), msg: lead.msg.slice(0,80) };
    fs.writeFileSync(sentFile, JSON.stringify(sent, null, 2));
    console.log(`✅ Отправлено @${key}`);
    await tg(`🟢 <b>Написал</b> @${lead.username || lead.id}\n<i>${lead.msg.slice(0,100)}</i>`);
    await new Promise(r => setTimeout(r, 3000));
  } catch(e) {
    console.error(`❌ Ошибка @${key}:`, e.message?.slice(0,100));
    await tg(`⚠️ Не удалось написать @${lead.username || lead.id}: ${e.message?.slice(0,80)}`);
  }
}

await client.disconnect();
console.log('Готово');
