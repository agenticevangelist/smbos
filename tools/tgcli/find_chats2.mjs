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

// Search Telegram for relevant public chats/channels
const queries = [
  "ресторанный бизнес",
  "HoReCa",
  "доставка еды бизнес",
  "предприниматели Грузия",
  "wolt партнеры",
  "freelance разработка",
  "заказать сайт",
  "автоматизация бизнес",
];

const results = [];

for (const q of queries) {
  try {
    const res = await client.invoke(new Api.contacts.Search({
      q,
      limit: 5,
    }));
    for (const chat of [...(res.chats || []), ...(res.users || [])]) {
      if (chat.username && chat.participantsCount > 100) {
        results.push({
          query: q,
          username: chat.username,
          title: chat.title || `${chat.firstName} ${chat.lastName || ''}`.trim(),
          members: chat.participantsCount,
          type: chat.className,
        });
      }
    }
  } catch(e) {}
  await new Promise(r => setTimeout(r, 1000));
}

// Sort by members desc
results.sort((a,b) => b.members - a.members);
console.log(JSON.stringify(results));
await client.disconnect();
