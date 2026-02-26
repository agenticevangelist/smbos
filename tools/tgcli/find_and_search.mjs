import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
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

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── STEP 1: Find relevant groups via Telegram internal search ──────────────

const groupSearchTerms = [
  "разработка сайтов",
  "фриланс разработчики",
  "заказы разработка",
  "фриланс биржа",
  "it заказы",
  "разработка телеграм ботов",
  "web разработка",
  "freelance developers",
  "it грузия",
  "бизнес грузия",
  "стартап грузия",
  "предприниматели грузия",
  "услуги тбилиси",
  "автоматизация бизнеса",
  "ai автоматизация",
  "заказы фриланс",
  "биржа фриланса",
  "it services georgia",
  "startup tbilisi",
  "digital georgia",
];

const foundGroups = new Map(); // id -> {title, username, memberCount}

process.stderr.write("🔍 Ищем группы через внутренний поиск Telegram...\n");

for (const term of groupSearchTerms) {
  try {
    const res = await client.invoke(new Api.contacts.Search({
      q: term,
      limit: 15,
    }));

    for (const chat of [...(res.chats || []), ...(res.users || [])]) {
      if (chat.className !== "Channel" && chat.className !== "Chat") continue;
      if (chat.broadcast) continue; // skip channels, only supergroups
      const id = chat.id?.toString();
      if (!id || foundGroups.has(id)) continue;
      foundGroups.set(id, {
        id,
        title: chat.title || chat.username || id,
        username: chat.username || null,
        members: chat.participantsCount || 0,
      });
    }
  } catch(e) {
    process.stderr.write(`  Error searching groups for "${term}": ${e.message}\n`);
  }
  await delay(700);
}

process.stderr.write(`✅ Найдено ${foundGroups.size} уникальных групп\n`);

// Also add known groups from dialogs
try {
  const dialogs = await client.getDialogs({ limit: 300 });
  for (const d of dialogs) {
    const type = d.entity?.className;
    const isGroup = type === "Chat" || (type === "Channel" && d.entity?.megagroup);
    if (!isGroup) continue;
    const id = d.entity.id?.toString();
    if (!foundGroups.has(id)) {
      foundGroups.set(id, {
        id,
        title: d.entity.title || id,
        username: d.entity.username || null,
        members: d.entity.participantsCount || 0,
      });
    }
  }
} catch(e) {
  process.stderr.write(`Error getting dialogs: ${e.message}\n`);
}

process.stderr.write(`📦 Итого групп для сканирования: ${foundGroups.size}\n`);

// ── STEP 2: Search within each group for lead keywords ─────────────────────

const leadKeywords = [
  "нужен разработчик",
  "ищу разработчика",
  "нужен программист",
  "нужен сайт",
  "нужен бот",
  "нужна автоматизация",
  "заказать сайт",
  "заказать бота",
  "нужен лендинг",
  "нужен телеграм бот",
  "need developer",
  "looking for developer",
  "нужен ai",
  "ищу фрилансера",
  "нужна разработка",
  "ищу исполнителя",
  "кто делает сайт",
  "кто делает бот",
  "ищу подрядчика",
  "нужна помощь с сайт",
  "нужна crm",
  "автоматизировать бизнес",
  "ищу тех партнёра",
  "нужен технический партнёр",
  "ищу команду разработ",
  "чат-бот под заказ",
  "разработка под ключ",
];

const results = [];
const seenMsg = new Set();
const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

process.stderr.write("\n🔎 Ищем лиды внутри групп...\n");

let groupCount = 0;
for (const [gid, group] of foundGroups) {
  groupCount++;
  if (groupCount % 10 === 0) process.stderr.write(`  Обработано ${groupCount}/${foundGroups.size} групп...\n`);

  for (const kw of leadKeywords) {
    try {
      // Use messages.search within the chat
      let entity;
      try {
        if (group.username) {
          entity = await client.getEntity(group.username);
        } else {
          // Try by ID
          const dialogs = await client.getDialogs({ limit: 1 });
          entity = await client.getEntity(BigInt("-100" + gid) ).catch(() => null);
        }
      } catch(_) { continue; }

      if (!entity) continue;

      const res = await client.invoke(new Api.messages.Search({
        peer: await client.getInputEntity(entity),
        q: kw,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo,
        maxDate: 0,
        offsetId: 0,
        addOffset: 0,
        limit: 10,
        maxId: 0,
        minId: 0,
        hash: BigInt(0),
      }));

      for (const msg of (res.messages || [])) {
        if (!msg.message) continue;
        if (msg.post || !msg.fromId) continue;

        const key = `${gid}_${msg.id}`;
        if (seenMsg.has(key)) continue;
        seenMsg.add(key);

        results.push({
          keyword: kw,
          chat: group.title,
          chatId: gid,
          senderId: msg.fromId?.userId?.toString() || "unknown",
          text: msg.message.slice(0, 350),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
        });
      }
    } catch(e) {
      // silent
    }
    await delay(300);
  }
}

process.stderr.write(`\n✅ Всего сообщений найдено: ${results.length}\n`);

// Deduplicate by sender
const byId = new Map();
for (const r of results) {
  if (!byId.has(r.senderId)) byId.set(r.senderId, r);
  else if (r.date > byId.get(r.senderId).date) byId.set(r.senderId, r);
}

const unique = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
process.stderr.write(`📊 Уникальных отправителей: ${unique.length}\n`);

console.log(JSON.stringify(unique, null, 2));
await client.disconnect();
