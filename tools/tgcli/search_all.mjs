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
const dialogs = await client.getDialogs({ limit: 300 });

// All groups only
const groups = dialogs.filter(d => d.isGroup || d.isChannel && false);
// Actually get groups:
const allGroups = dialogs.filter(d => {
  const type = d.entity?.className;
  return type === "Chat" || type === "Channel" && d.entity?.megagroup;
});

const keywords = [
  "ищу разработчик", "нужен разработчик", "нужен программист",
  "нужен сайт", "нужно приложение", "нужен бот", "нужна автоматизация",
  "ищу фрилансер", "looking for developer", "need developer",
  "need automation", "нужен веб", "разработка сайта", "сделать сайт",
  "telegram bot", "телеграм бот", "ai автоматизац", "нужен ai",
  "ищу подрядчик", "кто может сделать", "кто делает",
  "нужен специалист", "ищу специалист", "hire developer",
  "freelancer needed", "нужна помощь с сайт", "нужен лендинг",
  "нужен интеграц", "нужен crm", "автоматизировать",
  "чат-бот", "chatbot", "openai", "gpt интеграц",
];

// Already searched ones
const alreadySearched = new Set(["-1001538373506","-1001791634902","-1001596261124","-1001519678828","-1001714323565","-1003849134483","-1001467914348"]);

const results = [];
const now = Date.now() / 1000;
const threeMonthsAgo = now - (90 * 24 * 3600);

for (const dialog of allGroups) {
  const chatId = dialog.id?.toString();
  if (alreadySearched.has(chatId)) continue;

  try {
    const msgs = await client.getMessages(dialog.entity, { limit: 300 });
    for (const msg of msgs) {
      if (!msg.message) continue;
      if (msg.date < threeMonthsAgo) continue; // only last 3 months
      const text = msg.message.toLowerCase();
      const matched = keywords.find(kw => text.includes(kw));
      if (matched) {
        // skip if it's a job vacancy (full-time)
        if (text.includes("salary") && text.includes("gross") && !text.includes("фрилан")) continue;
        results.push({
          chat: dialog.name || dialog.title,
          senderId: msg.senderId?.toString(),
          text: msg.message.slice(0, 250),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
        });
      }
    }
  } catch(e) {
    // skip inaccessible chats
  }
}

console.log(JSON.stringify(results));
await client.disconnect();
