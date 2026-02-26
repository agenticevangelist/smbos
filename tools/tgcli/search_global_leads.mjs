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

// Ключевые фразы для внутреннего поиска Telegram
const searchQueries = [
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
  "нужен ai бот",
  "ищу фрилансера",
  "нужна разработка",
];

const results = [];
const seen = new Set();
const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

for (const query of searchQueries) {
  try {
    const res = await client.invoke(
      new Api.messages.SearchGlobal({
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo,
        maxDate: 0,
        offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0,
        limit: 30,
      })
    );

    const msgs = res.messages || [];
    for (const msg of msgs) {
      if (!msg.message || !msg.peerId) continue;
      if (msg.post) continue;
      if (!msg.fromId) continue;

      const key = `${msg.peerId?.channelId || msg.peerId?.chatId || msg.peerId?.userId}_${msg.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let chatName = "unknown";
      const chatId = msg.peerId?.channelId?.toString() || msg.peerId?.chatId?.toString();
      if (chatId) {
        const chat = (res.chats || []).find(c => c.id?.toString() === chatId);
        if (chat) chatName = chat.title || chat.username || chatId;
      }

      const senderIdStr = msg.fromId?.userId?.toString() || "unknown";

      results.push({
        query,
        chat: chatName,
        chatId: chatId || "dm",
        senderId: senderIdStr,
        text: msg.message.slice(0, 350),
        date: new Date(msg.date * 1000).toISOString().slice(0, 10),
      });
    }
  } catch (e) {
    process.stderr.write(`Error searching "${query}": ${e.message}\n`);
  }

  await new Promise(r => setTimeout(r, 600));
}

// Deduplicate by senderId
const byId = new Map();
for (const r of results) {
  if (!byId.has(r.senderId)) byId.set(r.senderId, r);
}
const unique = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));

console.log(JSON.stringify(unique, null, 2));
await client.disconnect();
