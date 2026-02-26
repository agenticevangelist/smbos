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

// Chat 1: IT-чат Тбилиси — ищет мобильного разработчика
const chatTbilisi = dialogs.find(d => d.id?.toString() === "-1001596261124");
// Chat 2: IT Community Georgia — ищет бота
const chatIT = dialogs.find(d => d.id?.toString() === "-1001714323565");

const results = [];

// Get sender from IT-чат Тбилиси
if (chatTbilisi) {
  const msgs = await client.getMessages(chatTbilisi.entity, { limit: 200 });
  const msg = msgs.find(m => m.senderId?.toString() === "8336636056");
  if (msg) {
    const sender = await client.getEntity(msg.senderId);
    results.push({ name: `${sender.firstName || ''} ${sender.lastName || ''}`.trim(), username: sender.username, entity: msg.senderId, context: "mobile dev" });
  }
}

// Get sender from IT Community Georgia
if (chatIT) {
  const msgs = await client.getMessages(chatIT.entity, { limit: 200 });
  const msg = msgs.find(m => m.senderId?.toString() === "6838481314");
  if (msg) {
    const sender = await client.getEntity(msg.senderId);
    results.push({ name: `${sender.firstName || ''} ${sender.lastName || ''}`.trim(), username: sender.username, entity: msg.senderId, context: "tg bot" });
  }
}

// Send messages
const msg1 = `Привет! Увидел в чате, что ищешь разработчика мобильных приложений. Я Full-Stack разработчик, работаю с React Native / Expo (iOS + Android). Если задача ещё актуальна — готов обсудить 🙂`;
const msg2 = `Привет! Видел твой пост про Telegram-бота. Я занимаюсь разработкой ботов и автоматизацией — могу помочь как с самим ботом, так и с его продвижением. Если интересно, можем созвониться 🙂`;

for (const r of results) {
  try {
    const text = r.context === "mobile dev" ? msg1 : msg2;
    await client.sendMessage(r.entity, { message: text });
    console.log(JSON.stringify({ ok: true, to: r.name, username: r.username, context: r.context }));
  } catch(e) {
    console.log(JSON.stringify({ error: e.message.slice(0, 150), to: r.name }));
  }
}

if (results.length === 0) console.log(JSON.stringify({ error: "No senders found" }));

await client.disconnect();
