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

const targets = [
  {
    targetId: "8335775465",
    searchQuery: "разработчика для создания Telegram-бота",
    text: "Привет! Видел твой пост — ищешь разработчика Telegram-бота. Мы команда DevHub.ge, делаем ботов под ключ: Python, aiogram, интеграции с API, AI. Расскажи про задачу?"
  },
  {
    targetId: "7145551141",
    searchQuery: "нужен сайт не сильно сложный",
    text: "Привет! Видел сообщение — нужен сайт. Мы DevHub.ge, делаем сайты под ключ на React, Next.js. Быстро, аккуратно. Что именно нужно?"
  }
];

const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

for (const t of targets) {
  process.stderr.write(`\nResolving user ${t.targetId} via "${t.searchQuery}"...\n`);
  let sent = false;

  // Try multiple search queries
  const queries = [t.searchQuery, t.searchQuery.split(' ').slice(0, 4).join(' ')];

  for (const q of queries) {
    if (sent) break;
    try {
      const res = await client.invoke(new Api.messages.SearchGlobal({
        q,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo,
        maxDate: 0,
        offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0,
        limit: 50,
      }));

      const userMap = new Map();
      for (const u of (res.users || [])) userMap.set(u.id?.toString(), u);

      const user = userMap.get(t.targetId);
      if (user) {
        process.stderr.write(`  ✅ Found: ${user.firstName} @${user.username || 'no username'}\n`);
        await client.sendMessage(user, { message: t.text });
        console.log(JSON.stringify({ id: t.targetId, name: user.firstName, username: user.username, sent: true }));
        sent = true;
      }
    } catch(e) {
      process.stderr.write(`  Error: ${e.message}\n`);
    }
    await delay(800);
  }

  if (!sent) {
    console.log(JSON.stringify({ id: t.targetId, sent: false, reason: "not resolved" }));
  }

  await delay(1500);
}

await client.disconnect();
