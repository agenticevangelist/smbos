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

const chats = [
  "RestoranBisnes", "gutsfood", "horecaestate",
  "biznes_dostavka_edi", "chat_deliverymarketing", "HoReCa29",
  "zakazatbotax", "ZeroToSite", "avtomatizaciatrafika",
];

// Dev keywords
const devKw = [
  "нужен разработчик","ищу разработчик","нужен программист",
  "нужен сайт","нужен бот","нужна автоматизация","ищу фрилансер",
  "нужен лендинг","телеграм бот","нужен ai","чат-бот",
  "ищу подрядчик","кто сделает","кто может сделать","нужна интеграц",
  "looking for dev","need developer","hire","freelancer",
];

// Delivery/cafe pain keywords — people with problems = potential clients
const deliveryKw = [
  "не успеваем","теряем заказы","низкий рейтинг","упал рейтинг",
  "помогите с wolt","помогите с bolt","помогите с glovo",
  "как поднять","как увеличить","как настроить агрегатор",
  "проблема с доставкой","не работает доставка","подключить wolt",
  "нужен специалист","посоветуйте специалиста","ищу помощь",
  "кто занимается","кто настраивает","кто работает с wolt",
  "нужна помощь с","агрегатор помог","кто поможет",
];

const allKw = [...devKw, ...deliveryKw];
const results = [];
const threeMonthsAgo = Date.now() / 1000 - (90 * 24 * 3600);

for (const username of chats) {
  try {
    const entity = await client.getEntity(username);
    const msgs = await client.getMessages(entity, { limit: 300 });
    let chatHits = 0;
    for (const msg of msgs) {
      if (!msg.message || msg.date < threeMonthsAgo) continue;
      const text = msg.message.toLowerCase();
      const matched = allKw.find(kw => text.includes(kw));
      if (matched) {
        // Skip admin/bot announcements
        if (msg.post || !msg.senderId) continue;
        results.push({
          chat: username,
          senderId: msg.senderId?.toString(),
          text: msg.message.slice(0, 300),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
          type: devKw.includes(matched) ? "dev" : "delivery",
        });
        chatHits++;
      }
    }
    process.stderr.write(`✓ @${username}: ${chatHits} hits\n`);
  } catch(e) {
    process.stderr.write(`✗ @${username}: ${e.message.slice(0,50)}\n`);
  }
}

console.log(JSON.stringify(results));
await client.disconnect();
