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

const targetUsernames = [
  "BiznesKontakti",
  "biznes_chat",
  "biznes_club_russia",
  "predprinimateli_rf2",
  "predprinimateli_chat",
  "Frilans_Birzha",
  "restoran_topchat",
  "restodays",
];

const keywords = [
  "нужен разработчик",
  "ищу разработчик",
  "нужен сайт",
  "нужен бот",
  "нужна автоматизация",
  "ищу фрилансер",
  "нужен лендинг",
  "телеграм бот",
  "нужен ai",
  "чат-бот",
  "ищу подрядчик",
  "кто сделает сайт",
  "заказать бота",
  "нужен программист",
  "голосовой агент",
];

const now = Math.floor(Date.now() / 1000);
const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

const allResults = [];

for (const username of targetUsernames) {
  console.error(`\n🔍 Searching in @${username}...`);
  let entity;
  try {
    entity = await client.getEntity(username);
  } catch (e) {
    console.error(`  ❌ Could not resolve @${username}: ${e.message}`);
    continue;
  }

  for (const kw of keywords) {
    try {
      const messages = await client.getMessages(entity, {
        search: kw,
        limit: 50,
      });

      for (const msg of messages) {
        if (!msg.message) continue;
        if (msg.date < ninetyDaysAgo) continue;

        allResults.push({
          chat: username,
          senderId: msg.senderId?.toString() ?? "unknown",
          text: msg.message.slice(0, 200),
          date: new Date(msg.date * 1000).toISOString().slice(0, 16).replace("T", " "),
          keyword: kw,
          _ts: msg.date,
        });
      }

      await new Promise(r => setTimeout(r, 400)); // rate limit
    } catch (e) {
      console.error(`  ⚠️ Error searching "${kw}" in @${username}: ${e.message}`);
    }
  }
}

// Deduplicate by (chat + senderId + first 100 chars of text)
const seen = new Set();
const deduped = allResults.filter(r => {
  const key = `${r.chat}|${r.senderId}|${r.text.slice(0, 100)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Sort by freshness (newest first)
deduped.sort((a, b) => b._ts - a._ts);

// Top 10
const top10 = deduped.slice(0, 10).map(({ _ts, keyword, ...r }) => r);

console.log("\n===== TOP LEADS =====");
console.log(JSON.stringify(top10, null, 2));

await client.disconnect();
