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
const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

// Wave 3: different angle — AI, no-code, biz Armenia, tbilisi services, CIS startups
const groups = [
  { username: "ArmeniaBusinessmen",     name: "Бизнес Армения" },
  { username: "predprinimateli_rf2",    name: "Предприниматели РФ" },
  { username: "predprinimateli_chat",   name: "Предприниматели Чат" },
  { username: "restorant_cafe_obchepit",name: "Рестораны/Кафе" },
  { username: "restoran_topchat",       name: "Рестораторы TopChat" },
  { username: "restodays",              name: "Restodays" },
  { username: "HoReCa29",              name: "HoReCa" },
  { username: "chat_deliverymarketing", name: "Delivery Marketing" },
  { username: "it_georgia",            name: "IT Georgia" },
  { username: "tbilisi_startups",       name: "Tbilisi Startups" },
  { username: "georgia_startups",       name: "Georgia Startups" },
  { username: "nocode_community",       name: "No-Code Community" },
  { username: "makegeorgia",            name: "Make Georgia" },
  { username: "digitalgeorgia",         name: "Digital Georgia" },
  { username: "georgian_it",            name: "Georgian IT" },
];

// Global search wave 3 — different angles
const globalQueries = [
  "нужно создать приложение для бизнеса",
  "ищу разработчика для интернет-магазина",
  "нужен разработчик чат-бота",
  "нужна автоматизация процессов",
  "кто разрабатывает crm системы",
  "нужен разработчик для автоматизации",
  "нужно приложение для доставки",
  "нужен разработчик для ресторана",
  "нужен разработчик в тбилиси",
  "нужна разработка в грузии",
  "нужен веб разработчик грузия",
  "looking for web developer tbilisi",
  "need developer georgia",
  "нужен разработчик бот whatsapp",
  "нужна интеграция telegram whatsapp",
  "нужен разработчик aiogram",
  "нужен разработчик langchain",
  "нужна разработка ai агента",
  "ищу разработчика ai бота",
  "нужен технический директор cto",
];

const noisePatterns = [
  /#вакансия/i, /#vacancy/i, /#resume/i, /#резюме/i,
  /ищу работу/i, /продаю/i, /продам/i,
  /наша команда предлагает/i, /мы предлагаем/i,
  /я разработчик/i, /предлагаю услуги/i, /сделаю за/i,
  /готов сделать/i, /ищу заказы/i, /беру заказы/i,
  /ищу клиентов/i, /DALI AGENTS/i,
];

const results = [];
const seenIds = new Set();

// Global search
process.stderr.write(`🌍 Волна 3 — глобальный поиск (${globalQueries.length} запросов)...\n`);
for (const q of globalQueries) {
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: threeMonthsAgo, maxDate: 0,
      offsetRate: 0, offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0, limit: 30,
    }));
    const chatMap = new Map();
    for (const c of [...(res.chats||[]), ...(res.users||[])])
      chatMap.set(c.id?.toString(), c.title || c.firstName || c.username || "?");
    for (const msg of (res.messages || [])) {
      if (!msg.message || !msg.fromId || msg.post) continue;
      if (msg.date < threeMonthsAgo) continue;
      if (noisePatterns.some(p => p.test(msg.message))) continue;
      const key = `g_${msg.peerId?.channelId||msg.peerId?.chatId}_${msg.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const chatId = msg.peerId?.channelId?.toString()||msg.peerId?.chatId?.toString()||"dm";
      results.push({
        keyword: q, chat: chatMap.get(chatId)||chatId, chatId,
        senderId: msg.fromId?.userId?.toString()||"?",
        text: msg.message.slice(0, 350),
        date: new Date(msg.date*1000).toISOString().slice(0,10),
        source: "global",
      });
    }
  } catch(e) { process.stderr.write(`  ⚠️ "${q}": ${e.message.slice(0,50)}\n`); }
  await delay(600);
}
process.stderr.write(`  → ${results.length} results so far\n`);

// Group search
const keywords = [
  "нужен разработчик", "нужен сайт", "нужен бот", "нужна автоматизация",
  "ищу разработчика", "ищу фрилансера", "заказать сайт",
  "нужна разработка", "кто делает сайт", "кто делает бот",
  "нужно приложение", "нужен телеграм бот", "нужна crm",
  "ищу исполнителя", "ищу подрядчика",
];

process.stderr.write(`\n📦 Поиск в ${groups.length} группах...\n`);
for (const group of groups) {
  process.stderr.write(`  📌 @${group.username}... `);
  let entity;
  try { entity = await client.getEntity(group.username); }
  catch(e) { process.stderr.write(`skip\n`); continue; }

  try {
    await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
    process.stderr.write(`joined, `);
    await delay(1200);
  } catch(e) {
    const m = e.message;
    if (m.includes("USER_ALREADY_PARTICIPANT")) process.stderr.write(`in, `);
    else process.stderr.write(`skip join, `);
  }

  let hits = 0;
  for (const kw of keywords) {
    try {
      const res = await client.invoke(new Api.messages.Search({
        peer: await client.getInputEntity(entity),
        q: kw, filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo, maxDate: 0,
        offsetId: 0, addOffset: 0, limit: 15, maxId: 0, minId: 0, hash: BigInt(0),
      }));
      for (const msg of (res.messages||[])) {
        if (!msg.message || msg.post || !msg.fromId) continue;
        if (noisePatterns.some(p => p.test(msg.message))) continue;
        const key = `${entity.id}_${msg.id}`;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        results.push({
          keyword: kw, chat: group.name, chatUsername: group.username,
          senderId: msg.fromId?.userId?.toString()||"?",
          text: msg.message.slice(0,350),
          date: new Date(msg.date*1000).toISOString().slice(0,10),
          source: "group",
        });
        hits++;
      }
    } catch(_) {}
    await delay(150);
  }
  process.stderr.write(`${hits} hits\n`);
}

const byId = new Map();
for (const r of results) {
  if (!byId.has(r.senderId) || byId.get(r.senderId).date < r.date) byId.set(r.senderId, r);
}
const unique = [...byId.values()].sort((a,b) => b.date.localeCompare(a.date));
process.stderr.write(`\n✅ Уникальных итого: ${unique.length}\n`);
console.log(JSON.stringify(unique, null, 2));
await client.disconnect();
