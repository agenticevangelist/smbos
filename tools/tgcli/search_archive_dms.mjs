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

// Load dialogs to cache entities
await client.getDialogs({ limit: 300 });

// Get archived folder
const result = await client.invoke(new Api.messages.GetDialogs({
  offsetDate: 0,
  offsetId: 0,
  offsetPeer: new Api.InputPeerEmpty(),
  limit: 100,
  hash: BigInt(0),
  folderId: 1,
}));

const keywords = [
  "сайт", "разработ", "приложени", "бот", "автоматизац",
  "проект", "заказ", "сколько стоит", "цена", "стоимость",
  "помоги", "можешь сделать", "нужна помощь", "collaborat",
  "freelance", "работа", "задача", "интеграц", "crm", "landing",
  "лендинг", "магазин", "e-commerce", "телеграм бот",
];

const results = [];

// Get all users (direct chats) from archive
const archivedUsers = result.users?.filter(u => !u.bot && u.id?.toString() !== "777000") || [];

for (const user of archivedUsers) {
  try {
    const msgs = await client.getMessages(user, { limit: 50 });
    for (const msg of msgs) {
      if (!msg.message) continue;
      const text = msg.message.toLowerCase();
      const matched = keywords.find(kw => text.includes(kw));
      if (matched) {
        results.push({
          person: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          username: user.username,
          senderId: msg.senderId?.toString(),
          out: msg.out, // true = sent by David, false = received
          text: msg.message.slice(0, 250),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
        });
        break; // one hit per person is enough
      }
    }
  } catch(e) {}
}

console.log(JSON.stringify(results));
await client.disconnect();
