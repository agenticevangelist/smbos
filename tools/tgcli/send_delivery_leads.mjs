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

const MSG = `Здравствуйте! Меня зовут Давид, занимаюсь ростом и ведением delivery под ключ. Делаю: аудит + анализ конкурентов, оптимизацию меню, продвижение (реклама, промо, видимость), тренинг команды (саппорт, клиенты, операционка), настраиваю СРМ, лояльность, сайты. Работаю как с единоразовой оплатой так и помесячной. Если актуально, расскажу подробнее!`;

// Целевые пользователи
const GROUP_ID = "-1001519678828"; // ВАКАНСИИ Грузия
const TARGETS = ["5121731111", "1048191005"]; // Tata, Vladislav

// Загружаем диалоги
const dialogs = await client.getDialogs({ limit: 300 });
const group = dialogs.find(d => d.id?.toString() === GROUP_ID);

if (!group) {
  console.log(JSON.stringify({ error: "Group not found" }));
  await client.disconnect();
  process.exit(1);
}

// Получаем сообщения из группы
const messages = await client.getMessages(group.entity, { limit: 500 });

for (const targetId of TARGETS) {
  // Находим сообщение от этого пользователя в группе
  const msg = messages.find(m => m.senderId?.toString() === targetId);
  if (!msg) {
    console.log(JSON.stringify({ id: targetId, error: "no message found in group" }));
    continue;
  }

  try {
    // Получаем entity через senderId из реального сообщения группы
    const sender = await client.getEntity(msg.senderId);
    const name = `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
    const username = sender.username || null;

    // Отправляем сообщение
    await client.sendMessage(msg.senderId, { message: MSG });
    console.log(JSON.stringify({ ok: true, to: name, username, id: targetId }));
  } catch(e) {
    console.log(JSON.stringify({ error: e.message.slice(0, 200), id: targetId }));
  }
}

await client.disconnect();
