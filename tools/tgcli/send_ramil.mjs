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

const msg = `Привет Рамиль! Увидел ваш вопрос про iiko и Saby Presto.

Работаю с заведениями в Грузии — помогаю с настройкой системы под доставку (Wolt, Bolt, Glovo). Если открываете новое кафе, могу помочь разобраться с выбором CRM под ваши задачи + сразу правильно подключить агрегаторы чтобы не переделывать потом.

Можем созвониться на 15 минут?`;

try {
  const entity = await client.getEntity("Riraa20022010");
  await client.sendMessage(entity, { message: msg });
  console.log("OK: отправлено");
} catch(e) {
  console.log("ERROR:", e.message);
}

await client.disconnect();
