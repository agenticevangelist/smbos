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

// Target chats to search
const targetChats = [
  { id: "-1001538373506", name: "БИЗНЕС / ИП Грузия" },
  { id: "-1001791634902", name: "IT-чат Грузия" },
  { id: "-1001596261124", name: "IT-чат Тбилиси" },
  { id: "-1001519678828", name: "ВАКАНСИИ Грузия" },
  { id: "-1001714323565", name: "IT Community Georgia" },
  { id: "-1003849134483", name: "Fuck with Agents" },
  { id: "-1001467914348", name: "AI Project Manager" },
];

const keywords = [
  "ищу разработчик", "нужен разработчик", "нужен программист",
  "нужен сайт", "нужно приложение", "нужен бот", "нужна автоматизация",
  "ищу фрилансер", "looking for developer", "need developer",
  "need automation", "нужен веб", "разработка сайта", "сделать сайт",
  "telegram bot", "телеграм бот", "ai автоматизац", "нужен ai",
  "ищу подрядчик", "кто может сделать", "кто делает сайт",
  "flutter", "react developer", "python developer", "fastapi",
];

const results = [];

const dialogs = await client.getDialogs({ limit: 300 });

for (const target of targetChats) {
  const dialog = dialogs.find(d => d.id?.toString() === target.id);
  if (!dialog) {
    console.error(`Not found: ${target.name}`);
    continue;
  }

  try {
    const messages = await client.getMessages(dialog.entity, { limit: 200 });
    for (const msg of messages) {
      if (!msg.message) continue;
      const text = msg.message.toLowerCase();
      const matched = keywords.find(kw => text.includes(kw));
      if (matched) {
        results.push({
          chat: target.name,
          sender: msg.senderId?.toString(),
          text: msg.message.slice(0, 300),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
        });
      }
    }
  } catch(e) {
    console.error(`Error in ${target.name}: ${e.message}`);
  }
}

console.log(JSON.stringify(results, null, 2));
await client.disconnect();
