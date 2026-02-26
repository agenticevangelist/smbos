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

const queries = [
  "рестораторы чат",
  "ресторан бизнес чат",
  "доставка еды чат",
  "wolt партнёры",
  "food delivery owners",
  "предприниматели чат",
  "бизнес предприниматели",
  "заказать разработку",
  "заказать бота",
  "заказать сайт чат",
  "фриланс заказы",
  "HoReCa владельцы",
  "кафе бар чат",
  "автоматизация horeca",
  "ресторан автоматизация",
  "доставка агрегаторы",
  "wolt bolt glovo",
  "it фриланс чат",
  "разработка заказы чат",
];

const found = [];
const seen = new Set();

for (const q of queries) {
  try {
    const res = await client.invoke(new Api.contacts.Search({ q, limit: 10 }));
    const all = [...(res.chats || []), ...(res.users || [])];
    for (const c of all) {
      if (!c.username || seen.has(c.username)) continue;
      // Only megagroups (actual chats, not broadcast channels)
      const isMegagroup = c.megagroup === true;
      const isChat = c.className === "Chat";
      if (!isMegagroup && !isChat) continue;
      seen.add(c.username);
      found.push({
        username: c.username,
        title: c.title,
        members: c.participantsCount || 0,
        query: q,
      });
    }
    await new Promise(r => setTimeout(r, 800));
  } catch(e) {}
}

found.sort((a,b) => b.members - a.members);
fs.writeFileSync('/tmp/found_groups.json', JSON.stringify(found, null, 2));
process.stderr.write(`Total: ${found.length} groups\n`);
await client.disconnect();
