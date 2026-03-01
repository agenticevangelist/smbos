import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const client = new TelegramClient(
  new StringSession(sessionStr),
  33887530,
  "fc51f19b4b6ff9f0b8cbd5c4005e9ee4",
  { connectionRetries: 3 }
);

await client.connect();
const dialogs = await client.getDialogs({ limit: 400 });

const MSG = `Привет Рамиль! Увидел ваш вопрос про iiko и Saby Presto.

Работаю с заведениями в Грузии — помогаю с настройкой системы под доставку (Wolt, Bolt, Glovo). Если открываете новое кафе, могу помочь разобраться с выбором CRM под ваши задачи + сразу правильно подключить агрегаторы чтобы не переделывать потом.

Можем созвониться на 15 минут?`;

try {
  const group = dialogs.find(d => {
    const title = d.entity?.title || '';
    return title.includes('Рестораторы');
  });

  if (!group) { console.log("ERROR: group not found"); process.exit(1); }
  console.log("Group found:", group.entity?.title);

  const msgs = await client.getMessages(group.entity, { limit: 500 });
  const msg = msgs.find(m => m.senderId?.toString() === "464284459");

  if (!msg) { console.log("ERROR: sender message not found"); process.exit(1); }
  console.log("Sender found in group, sending...");

  const sender = await client.getEntity(msg.senderId);
  await client.sendMessage(msg.senderId, { message: MSG });

  const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
  console.log(`OK: отправлено -> ${name} (@${sender.username || 'no username'})`);
} catch(e) {
  console.log("ERROR:", e.message);
}

await client.disconnect();
