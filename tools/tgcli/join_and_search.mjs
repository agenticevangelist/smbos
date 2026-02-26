import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();
const client = new TelegramClient(
  new StringSession(sessionStr), 33887530,
  "fc51f19b4b6ff9f0b8cbd5c4005e9ee4",
  { connectionRetries: 3 }
);
await client.connect();
const delay = ms => new Promise(r => setTimeout(r, ms));

// Топ групп для вступления и поиска
const targetGroups = [
  { username: "frilancru",                  name: "ФРИЛАНС ЧАТ | БИРЖА" },
  { username: "BiznesKontakti",             name: "Предприниматели. Не ешьте один!" },
  { username: "biznes_chat",                name: "БИЗНЕС-ЧАТ №1" },
  { username: "businesGeorgia",             name: "БИЗНЕС ЧАТ ГРУЗИЯ" },
  { username: "chat_biznes1",               name: "БИЗНЕС ЧАТ | ПРЕДПРИНИМАТЕЛИ" },
  { username: "predprinimsteli_sng",        name: "Предприниматели СНГ" },
  { username: "Integratory_crm_chat",       name: "Интеграторы CRM | Автоматизация" },
  { username: "startup_chat_youtubecanal",  name: "СТАРТАПЫ Чат" },
  { username: "business_breakfast_georgia", name: "Бизнес-завтрак Тбилиси" },
  { username: "ertad_chat",                 name: "Ertad | Бизнес | Грузия" },
  { username: "predprinimateli_rf2",        name: "Предприниматели РФ" },
  { username: "predprinimateli_chat",       name: "Предприниматели Чат" },
  { username: "klub_biznes",                name: "Нетворкинг | Поиск партнёров" },
];

const leadKeywords = [
  "нужен разработчик", "ищу разработчика", "нужен программист",
  "нужен сайт", "нужен бот", "нужна автоматизация",
  "заказать сайт", "заказать бота", "нужен лендинг",
  "нужен телеграм бот", "need developer", "нужен ai",
  "ищу фрилансера", "нужна разработка", "ищу исполнителя",
  "кто делает сайт", "кто делает бот", "ищу подрядчика",
  "ищу технического партнёра", "нужна crm", "автоматизировать",
  "кто может сделать", "посоветуйте разработчика",
];

const noisePatterns = [
  /#вакансия/i, /#vacancy/i, /#resume/i, /#резюме/i,
  /ищу работу/i, /продаю/i, /продам/i,
  /наша команда предлагает/i, /мы предлагаем/i,
  /студия разработки/i,
];

const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);
const results = [];
const seenIds = new Set();

for (const group of targetGroups) {
  process.stderr.write(`\n📌 ${group.name} (@${group.username})\n`);

  let entity;
  try {
    entity = await client.getEntity(group.username);
  } catch(e) {
    process.stderr.write(`  ❌ getEntity failed: ${e.message}\n`);
    continue;
  }

  // Try to join if not already a member
  try {
    await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
    process.stderr.write(`  ✅ Вступил\n`);
    await delay(2000);
  } catch(e) {
    if (e.message.includes("USER_ALREADY_PARTICIPANT")) {
      process.stderr.write(`  ℹ️ Уже участник\n`);
    } else {
      process.stderr.write(`  ⚠️ Join: ${e.message}\n`);
    }
  }

  // Search within group for each keyword
  let hits = 0;
  for (const kw of leadKeywords) {
    try {
      const res = await client.invoke(new Api.messages.Search({
        peer: await client.getInputEntity(entity),
        q: kw,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo,
        maxDate: 0,
        offsetId: 0,
        addOffset: 0,
        limit: 20,
        maxId: 0,
        minId: 0,
        hash: BigInt(0),
      }));

      for (const msg of (res.messages || [])) {
        if (!msg.message || msg.post || !msg.fromId) continue;
        if (msg.date < threeMonthsAgo) continue;

        const key = `${entity.id}_${msg.id}`;
        if (seenIds.has(key)) continue;
        seenIds.add(key);

        if (noisePatterns.some(p => p.test(msg.message))) continue;
        if (msg.message.length < 20) continue;

        const senderId = msg.fromId?.userId?.toString() || "unknown";
        results.push({
          keyword: kw,
          chat: group.name,
          chatUsername: group.username,
          senderId,
          text: msg.message.slice(0, 350),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
        });
        hits++;
      }
    } catch(_) {}
    await delay(200);
  }
  process.stderr.write(`  🎯 Лидов: ${hits}\n`);
}

// Deduplicate by sender
const byId = new Map();
for (const r of results) {
  if (!byId.has(r.senderId) || byId.get(r.senderId).date < r.date) {
    byId.set(r.senderId, r);
  }
}
const unique = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
process.stderr.write(`\n📊 Итого уникальных лидов: ${unique.length}\n`);
console.log(JSON.stringify(unique, null, 2));
await client.disconnect();
