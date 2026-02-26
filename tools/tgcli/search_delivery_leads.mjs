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

const targetChats = [
  "restoran_topchat",
  "restodays",
  "restorant_cafe_obchepit",
  "chat_deliverymarketing",
  "BiznesKontakti",
  "biznes_chat",
  "biznes_club_russia",
];

const keywords = [
  "помогите с wolt",
  "помогите с bolt",
  "помогите с glovo",
  "нет заказов",
  "упал рейтинг",
  "как поднять",
  "проблема с доставкой",
  "нужен специалист по доставке",
  "кто настраивает",
  "агрегатор",
];

// 90 days ago in Unix timestamp
const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

const results = [];

for (const chatUsername of targetChats) {
  let entity;
  try {
    entity = await client.getEntity(chatUsername);
    console.error(`✓ Resolved: ${chatUsername} → ${entity.title || entity.username}`);
  } catch (e) {
    console.error(`✗ Could not resolve: ${chatUsername} — ${e.message}`);
    continue;
  }

  try {
    // Fetch messages in batches, stop when older than 90 days
    let offsetId = 0;
    let done = false;
    let batchCount = 0;

    while (!done && batchCount < 20) {
      const messages = await client.getMessages(entity, {
        limit: 100,
        offsetId,
      });

      if (!messages || messages.length === 0) break;
      batchCount++;

      for (const msg of messages) {
        if (!msg.message || !msg.date) continue;
        if (msg.date < ninetyDaysAgo) {
          done = true;
          break;
        }

        const text = msg.message.toLowerCase();
        const matched = keywords.find(kw => text.includes(kw.toLowerCase()));
        if (matched) {
          results.push({
            chat: chatUsername,
            chatTitle: entity.title || chatUsername,
            senderId: msg.senderId?.toString() || "unknown",
            text: msg.message.slice(0, 200),
            date: new Date(msg.date * 1000).toISOString().slice(0, 16).replace("T", " "),
            dateTs: msg.date,
            keyword: matched,
          });
        }
      }

      offsetId = messages[messages.length - 1].id;

      // Small delay to avoid flood limits
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    console.error(`Error searching ${chatUsername}: ${e.message}`);
  }
}

await client.disconnect();

// Sort by date descending, take top 10
results.sort((a, b) => b.dateTs - a.dateTs);
const top10 = results.slice(0, 10);

if (top10.length === 0) {
  console.log(JSON.stringify({ leads: [], message: "No leads found in the specified chats for the last 90 days." }, null, 2));
} else {
  console.log(JSON.stringify({ total: results.length, leads: top10 }, null, 2));
}
