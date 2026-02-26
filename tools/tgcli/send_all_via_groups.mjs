import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const client = new TelegramClient(
  new StringSession(sessionStr),
  parseInt(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 3 }
);

await client.connect();
const dialogs = await client.getDialogs({ limit: 400 });

const MSG_ACTIVE = `Привет! Меня зовут Давид, помогаю кафе и ресторанам расти на агрегаторах доставки.

Делаю: аудит меню и конкурентов, оптимизацию на Wolt/Glovo/Bolt, рекламу и промо, настройку CRM и программы лояльности.

Работаю разово или помесячно. Если актуально — расскажу подробнее!`;

const MSG_DARK = `Привет! Меня зовут Давид, занимаюсь запуском delivery под ключ.

Вижу что открываете новое заведение — как раз вовремя. Помогаю с нуля: регистрация на Wolt/Glovo/Bolt, меню, фото, продвижение, CRM и лояльность. Запускаем правильно с первого дня.

Если интересно — пообщаемся!`;

// senderId → { groupId, msg, label }
const LEADS = [
  // Из ВАКАНСИИ Грузия (-1001519678828)
  { groupId: "-1001519678828", senderId: "7617075928",  msg: MSG_ACTIVE, label: "Pause.ge" },
  { groupId: "-1001519678828", senderId: "2080295936",  msg: MSG_DARK,   label: "Андрей кафе Ваке" },
  { groupId: "-1001519678828", senderId: "624207618",   msg: MSG_ACTIVE, label: "Ресторан грузинской кухни Тбилиси" },
  { groupId: "-1001519678828", senderId: "310878256",   msg: MSG_ACTIVE, label: "Dessert Ballet" },
  { groupId: "-1001519678828", senderId: "6254312622",  msg: MSG_ACTIVE, label: "Кофейня Сабуртало" },
  { groupId: "-1001519678828", senderId: "395557973",   msg: MSG_ACTIVE, label: "Спешелти кофейни Тбилиси" },
  { groupId: "-1001519678828", senderId: "7613307955",  msg: MSG_ACTIVE, label: "Рюмочная Старый город" },
  { groupId: "-1001519678828", senderId: "5021313939",  msg: MSG_ACTIVE, label: "2 паба Батуми" },
  { groupId: "-1001519678828", senderId: "209836790",   msg: MSG_ACTIVE, label: "CloudSpace lounge bar" },
  { groupId: "-1001519678828", senderId: "7150851954",  msg: MSG_ACTIVE, label: "МАГАРИ шашлычная" },
  { groupId: "-1001519678828", senderId: "388267695",   msg: MSG_ACTIVE, label: "Ресторан Patelnya" },
  { groupId: "-1001519678828", senderId: "1882572252",  msg: MSG_ACTIVE, label: "Кафе Батуми Nika" },
  { groupId: "-1001519678828", senderId: "1651464220",  msg: MSG_ACTIVE, label: "Кафе Батуми evgella" },
  { groupId: "-1001519678828", senderId: "350390305",   msg: MSG_ACTIVE, label: "Ресторан Батуми круглый год" },
  { groupId: "-1001519678828", senderId: "1209061006",  msg: MSG_ACTIVE, label: "Кофейня SAGE Батуми" },
  { groupId: "-1001519678828", senderId: "6074480610",  msg: MSG_ACTIVE, label: "Суши-бар Батуми" },
  { groupId: "-1001519678828", senderId: "5900192121",  msg: MSG_ACTIVE, label: "Кафе Олива Батуми" },
  { groupId: "-1001519678828", senderId: "859715790",   msg: MSG_ACTIVE, label: "Кафе Tangerine Батуми" },
  { groupId: "-1001519678828", senderId: "6384060818",  msg: MSG_ACTIVE, label: "GudauriExpress доставка" },
  { groupId: "-1001519678828", senderId: "751197728",   msg: MSG_DARK,   label: "Новая кофейня Тбилиси" },
  { groupId: "-1001519678828", senderId: "8230401233",  msg: MSG_DARK,   label: "Новый ресторан вокзал Тбилиси" },
  // Из Рестораторы | Чат (-1001584015504)
  { groupId: "-1001584015504", senderId: "656657411",   msg: MSG_DARK,   label: "Dark kitchen Москва Никита" },
  { groupId: "-1001584015504", senderId: "1943600322",  msg: MSG_ACTIVE, label: "Гастробар Виновные" },
  { groupId: "-1001584015504", senderId: "289066322",   msg: MSG_ACTIVE, label: "Кафе вьетнамской кухни ВДНХ" },
  { groupId: "-1001584015504", senderId: "751973978",   msg: MSG_ACTIVE, label: "Кафе-лофт Сингулярность" },
];

// Кешируем сообщения групп
const groupMsgs = {};
for (const lead of LEADS) {
  if (!groupMsgs[lead.groupId]) {
    const g = dialogs.find(d => '-100' + d.entity?.id?.toString() === lead.groupId);
    if (g) {
      process.stderr.write(`Loading ${lead.groupId}...\n`);
      groupMsgs[lead.groupId] = await client.getMessages(g.entity, { limit: 500 });
    }
  }
}

let sent = 0, failed = 0;

for (const lead of LEADS) {
  const msgs = groupMsgs[lead.groupId];
  if (!msgs) {
    console.log(JSON.stringify({ error: "group not cached", label: lead.label }));
    failed++;
    continue;
  }

  const msg = msgs.find(m => m.senderId?.toString() === lead.senderId);
  if (!msg) {
    console.log(JSON.stringify({ error: "not found in group", label: lead.label, id: lead.senderId }));
    failed++;
    continue;
  }

  try {
    const sender = await client.getEntity(msg.senderId);
    await client.sendMessage(msg.senderId, { message: lead.msg });
    const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
    console.log(JSON.stringify({ ok: true, label: lead.label, to: name, username: sender.username || null }));
    sent++;
  } catch(e) {
    console.log(JSON.stringify({ error: e.message.slice(0, 100), label: lead.label }));
    failed++;
  }

  await new Promise(r => setTimeout(r, 2000));
}

console.log(JSON.stringify({ summary: true, sent, failed }));
await client.disconnect();
