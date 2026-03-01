import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const client = new TelegramClient(
  new StringSession(fs.readFileSync('store/session.txt','utf8').trim()),
  33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4',
  { connectionRetries: 3, autoReconnect: true }
);

const BOT_TOKEN = '8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw';
const DALI_GROUP = '-1003733922250';
const TOPIC_DEV = 2;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function notify(text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DALI_GROUP, message_thread_id: TOPIC_DEV, text })
    });
  } catch {}
}

// Паттерны клиента
const CLIENT = [
  /нужен\s+(разработчик|программист|разраб)/i,
  /ищу\s+(разработчик|программист|фрилансер|подрядчик)/i,
  /нужно\s+(сделать|разработать|написать)\s+.*(бот|сайт|приложение|crm)/i,
  /нужен\s+(бот|чат.?бот)/i,
  /хочу\s+заказать\s+(бот|сайт|приложение)/i,
  /кто\s+(делает|разрабатывает|может сделать)/i,
  /порекомендуйте\s+(разработчик|программист)/i,
  /ищем\s+(разработчик|программист|подрядчик)/i,
  /нужна\s+(crm|автоматизация|интеграция)/i,
  /нужно\s+приложение/i,
  /нужен\s+(сайт|лендинг)/i,
];

const SKIP = [
  /^#помогу/i, /^#ищу_работу/i, /^#вакансия/i, /^#vacancy/i,
  /меня зовут.*я .{0,30}(делаю|создаю|разрабатываю)/i,
  /предлагаем услуги/i, /принимаю заказы/i, /беру проекты/i,
];

// Топ группы для вступления (приоритет — бизнес + IT + Грузия)
const TO_JOIN = [
  'horeca_topchat', 'resto_business', 'BusinessInvestStarss', 'chat_biznes1',
  'chatb2bnews', 'bizekb', 'biznes_ok', 'mashtabbeauty',
  'allkzit', 'itkazahstan', 'biznesmenn_uz', 'astanabusiness_ns',
  'BiznesKontakti', 'biznes_club_russia', 'proffreelancee_chat',
  'workk_onchat', 'Frilans_Birzha', 'jobospherechat',
  'ArmeniaBusinessmen', 'business_armenia',
  'tilda_zakazy_chat', 'ecomm_guru', 'bizznes_pro',
];

const SENT = JSON.parse(fs.existsSync('store/sent.json') ? fs.readFileSync('store/sent.json','utf8') : '{}');
const SEEN = JSON.parse(fs.existsSync('/tmp/jas_seen.json') ? fs.readFileSync('/tmp/jas_seen.json','utf8') : '{}');

await client.connect();
console.log('Подключился');
await notify('🔍 Начинаю вступление в новые группы и поиск лидов...');

const since = Math.floor(Date.now()/1000) - 72 * 3600;
let joined = 0;
let leadsTotal = 0;

for (const username of TO_JOIN) {
  try {
    console.log(`Вступаю в @${username}...`);
    const entity = await client.getEntity(username);
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
      joined++;
      console.log(`  ✅ Вступил`);
      await sleep(3000);
    } catch(e) {
      if (e.message?.includes('USER_ALREADY_PARTICIPANT')) {
        console.log(`  уже в группе`);
      } else {
        console.log(`  ошибка вступления: ${e.message}`);
        await sleep(2000);
        continue;
      }
    }

    // Сканируем последние сообщения
    const msgs = await client.getMessages(entity, { limit: 50 });
    const leads = [];
    for (const m of msgs) {
      if (!m.message || m.date < since) continue;
      if (SKIP.some(r => r.test(m.message))) continue;
      if (!CLIENT.some(r => r.test(m.message))) continue;
      const sender = m.fromId?.userId?.toString() || '';
      if (!sender || SENT[sender]) continue;
      const key = `${sender}_${m.id}`;
      if (SEEN[key]) continue;
      SEEN[key] = 1;
      leads.push({ text: m.message.slice(0,250), sender_id: sender });
    }

    if (leads.length > 0) {
      leadsTotal += leads.length;
      console.log(`  💡 Найдено лидов: ${leads.length}`);
      for (const l of leads) {
        await notify(`💡 Лид из @${username}:\n\n${l.text}\n\n👤 ID: ${l.sender_id}`);
        await sleep(1000);
      }
    }

    await sleep(4000); // пауза между группами
  } catch(e) {
    console.log(`  skip @${username}: ${e.message?.slice(0,60)}`);
    await sleep(5000);
  }
}

fs.writeFileSync('/tmp/jas_seen.json', JSON.stringify(SEEN));
const summary = `✅ Готово. Вступил: ${joined} групп. Лидов найдено: ${leadsTotal}`;
console.log(summary);
await notify(summary);
process.exit(0);
