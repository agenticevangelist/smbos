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

// Load all dialogs first to cache entities
const dialogs = await client.getDialogs({ limit: 300 });

// Get archived dialogs
const result = await client.invoke(new Api.messages.GetDialogs({
  offsetDate: 0,
  offsetId: 0,
  offsetPeer: new Api.InputPeerEmpty(),
  limit: 100,
  hash: BigInt(0),
  folderId: 1,
}));

const keywords = [
  "ищу разработчик", "нужен разработчик", "нужен программист",
  "нужен сайт", "нужно приложение", "нужен бот", "нужна автоматизация",
  "ищу фрилансер", "looking for developer", "need developer",
  "нужен веб", "разработка сайта", "сделать сайт", "нужен лендинг",
  "telegram bot", "телеграм бот", "ai автоматизац", "нужен ai",
  "ищу подрядчик", "кто может сделать", "кто делает сайт",
  "нужен специалист", "ищу исполнитель", "кто умеет",
  "нужна автоматизация", "автоматизировать", "чат-бот", "chatbot",
  "нужен разраб", "посоветуйте разраб", "порекомендуйте",
];

const results = [];
const threeMonthsAgo = Date.now() / 1000 - (90 * 24 * 3600);

// Get archived group chats (not just channels)
const archivedGroups = result.chats?.filter(c => 
  c.className === "Chat" || (c.className === "Channel" && c.megagroup)
) || [];

for (const chat of archivedGroups) {
  try {
    const entity = await client.getEntity(chat.id);
    const msgs = await client.getMessages(entity, { limit: 300 });
    for (const msg of msgs) {
      if (!msg.message || msg.date < threeMonthsAgo) continue;
      const text = msg.message.toLowerCase();
      const matched = keywords.find(kw => text.includes(kw));
      if (matched) {
        if (text.includes("salary") && text.includes("gross")) continue;
        if (text.includes("#resume") || text.includes("#резюме")) continue;
        results.push({
          chat: chat.title,
          senderId: msg.senderId?.toString(),
          text: msg.message.slice(0, 300),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
        });
      }
    }
  } catch(e) {}
}

console.log(JSON.stringify(results));
await client.disconnect();
