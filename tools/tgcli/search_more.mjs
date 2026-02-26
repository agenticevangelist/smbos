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

// New batch of groups + more global search queries
const newGroups = [
  { username: "tilda_zakazy_chat",       name: "Tilda заказы" },
  { username: "freelance_chat_it",       name: "Фриланс IT чат" },
  { username: "it_freelance_ru",         name: "IT Freelance RU" },
  { username: "Frilans_Birzha",          name: "Фриланс Биржа" },
  { username: "biznes_club_russia",      name: "Бизнес Клуб Россия" },
  { username: "BussinesChat_INF",        name: "Бизнес Чат" },
  { username: "chat_biznes1",            name: "Бизнес Чат Предприниматели" },
  { username: "chatb2bnews",             name: "Предприниматели Москва B2B" },
  { username: "predprinemateli_choogl",  name: "Бизнес Чат Предприниматели" },
  { username: "malii_bizn",             name: "Малый Бизнес" },
  { username: "ArmeniaBusinessmen",      name: "Бизнес Армения" },
  { username: "PBH_GE2PLN",             name: "Poland Business Harbour Georgia" },
  { username: "klub_financier",          name: "Инвестиционный клуб" },
  { username: "club_vanguard",           name: "Предпринимательский клуб Авангард" },
];

// Broader keyword set
const keywords = [
  "нужен разработчик", "ищу разработчика", "нужен программист",
  "нужен сайт", "нужен бот", "нужна автоматизация",
  "заказать сайт", "заказать бота", "нужен лендинг",
  "нужен телеграм бот", "need developer", "нужен ai",
  "ищу фрилансера", "нужна разработка", "ищу исполнителя",
  "кто делает сайт", "кто делает бот", "ищу подрядчика",
  "ищу технического партнёра", "нужна crm", "автоматизировать",
  "кто может сделать", "посоветуйте разработчика",
  "разработка под ключ", "нужен fullstack", "нужен фронтенд",
  "нужен бэкенд", "нужно мобильное приложение",
];

const noisePatterns = [
  /#вакансия/i, /#vacancy/i, /#resume/i, /#резюме/i,
  /ищу работу/i, /продаю/i, /продам/i,
  /наша команда предлагает/i, /мы предлагаем/i,
  /я разработчик/i, /предлагаю услуги/i, /сделаю за/i,
  /готов сделать/i, /открыт к проектам/i, /ищу заказы/i,
  /беру заказы/i, /ищу клиентов/i,
];

const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);
const results = [];
const seenIds = new Set();

// --- Part 1: Global search with fresh queries ---
process.stderr.write("🌍 Глобальный поиск (расширенный)...\n");
const globalQueries = [
  "нужно мобильное приложение разработать",
  "кто занимается созданием ботов",
  "нужен разработчик для стартапа",
  "ищу разработчика mvp",
  "нужен fullstack разработчик",
  "кто разрабатывает телеграм ботов",
  "нужна разработка crm",
  "нужен разработчик лендинга",
  "ищу it подрядчика",
  "нужен разработчик для бизнеса",
  "hire python developer",
  "need react developer",
  "need nextjs developer",
  "нужен разработчик react",
  "нужен python разработчик",
];

for (const q of globalQueries) {
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: threeMonthsAgo, maxDate: 0,
      offsetRate: 0, offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0, limit: 30,
    }));
    const chatMap = new Map();
    for (const c of [...(res.chats||[]), ...(res.users||[])]) {
      chatMap.set(c.id?.toString(), c.title || c.firstName || c.username || "?");
    }
    for (const msg of (res.messages || [])) {
      if (!msg.message || !msg.fromId || msg.post) continue;
      if (msg.date < threeMonthsAgo) continue;
      if (noisePatterns.some(p => p.test(msg.message))) continue;
      if (msg.message.length < 20) continue;
      const key = `g_${msg.peerId?.channelId||msg.peerId?.chatId}_${msg.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const chatId = msg.peerId?.channelId?.toString() || msg.peerId?.chatId?.toString() || "dm";
      results.push({
        keyword: q, chat: chatMap.get(chatId) || chatId, chatId,
        senderId: msg.fromId?.userId?.toString() || "?",
        text: msg.message.slice(0, 350),
        date: new Date(msg.date * 1000).toISOString().slice(0, 10),
        source: "global",
      });
    }
  } catch(e) { process.stderr.write(`  ⚠️ "${q}": ${e.message}\n`); }
  await delay(600);
}
process.stderr.write(`  ✅ После глобального: ${results.length} результатов\n`);

// --- Part 2: Search in new groups ---
process.stderr.write("\n📦 Поиск в новых группах...\n");
for (const group of newGroups) {
  process.stderr.write(`  📌 @${group.username}... `);
  let entity;
  try { entity = await client.getEntity(group.username); }
  catch(e) { process.stderr.write(`skip (${e.message.slice(0,30)})\n`); continue; }

  // Try join
  try {
    await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
    process.stderr.write(`joined, `);
    await delay(1500);
  } catch(e) {
    const msg = e.message;
    if (msg.includes("USER_ALREADY_PARTICIPANT")) process.stderr.write(`already in, `);
    else process.stderr.write(`join skip, `);
  }

  let hits = 0;
  for (const kw of keywords) {
    try {
      const res = await client.invoke(new Api.messages.Search({
        peer: await client.getInputEntity(entity),
        q: kw, filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo, maxDate: 0,
        offsetId: 0, addOffset: 0, limit: 15,
        maxId: 0, minId: 0, hash: BigInt(0),
      }));
      for (const msg of (res.messages || [])) {
        if (!msg.message || msg.post || !msg.fromId) continue;
        if (noisePatterns.some(p => p.test(msg.message))) continue;
        if (msg.message.length < 20) continue;
        const key = `${entity.id}_${msg.id}`;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        results.push({
          keyword: kw, chat: group.name, chatUsername: group.username,
          senderId: msg.fromId?.userId?.toString() || "?",
          text: msg.message.slice(0, 350),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          source: "group",
        });
        hits++;
      }
    } catch(_) {}
    await delay(150);
  }
  process.stderr.write(`${hits} hits\n`);
}

// Deduplicate by sender
const byId = new Map();
for (const r of results) {
  if (!byId.has(r.senderId) || byId.get(r.senderId).date < r.date) byId.set(r.senderId, r);
}
const unique = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
process.stderr.write(`\n✅ Уникальных итого: ${unique.length}\n`);
console.log(JSON.stringify(unique, null, 2));
await client.disconnect();
