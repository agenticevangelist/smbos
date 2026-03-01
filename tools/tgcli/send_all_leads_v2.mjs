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

// Лиды через группу Рестораторы
const groupLeads = [
  {
    senderId: "656657411",
    label: "Никита (@nikita3666)",
    msg: `Привет Никита! Видел, что открываете корнер.

Работаю с заведениями в Грузии — помогаю с настройкой доставки на агрегаторах (Wolt, Bolt, Glovo): меню, фото, рейтинг, видимость в поиске. Если интересно — напишите, расскажу подробнее.`
  },
  {
    senderId: "289066322",
    label: "K K (@dshaizer)",
    msg: `Привет! Видел ваше кафе вьетнамской кухни.

Работаю с заведениями — помогаю с настройкой доставки на агрегаторах (Wolt, Bolt, Glovo): меню, фото, рейтинг, видимость в поиске. Если интересно — напишите, расскажу подробнее.`
  }
];

// Лиды которые уже в диалогах (Грузия)
const directLeads = [
  {
    name: "MAGARI FOOD Batumi",
    id: 7150851954,
    label: "MAGARI FOOD Batumi",
    msg: `Привет! Работаю с заведениями в Грузии — помогаю с настройкой доставки на агрегаторах (Wolt, Bolt, Glovo): меню, фото, рейтинг, видимость в поиске. Если интересно — напишите, расскажу подробнее.`
  },
  {
    name: "Kawaii Sushi",
    id: 6621509770,
    label: "Kawaii Sushi",
    msg: `Привет! Работаю с заведениями в Грузии — помогаю с настройкой доставки на агрегаторах (Wolt, Bolt, Glovo): меню, фото, рейтинг, видимость в поиске. Если интересно — напишите, расскажу подробнее.`
  }
];

// Через группу
const restGroup = dialogs.find(d => (d.entity?.title || '').includes('Рестораторы'));
if (restGroup) {
  const msgs = await client.getMessages(restGroup.entity, { limit: 500 });
  for (const lead of groupLeads) {
    try {
      const m = msgs.find(m => m.senderId?.toString() === lead.senderId);
      if (!m) { console.log(`SKIP: ${lead.label} — не найден в группе`); continue; }
      const sender = await client.getEntity(m.senderId);
      await client.sendMessage(m.senderId, { message: lead.msg });
      console.log(`OK: ${lead.label}`);
    } catch(e) {
      console.log(`ERROR: ${lead.label} — ${e.message.slice(0,100)}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
} else {
  console.log("ERROR: группа Рестораторы не найдена");
}

// Прямые диалоги
for (const lead of directLeads) {
  try {
    const dialog = dialogs.find(d => d.entity?.id?.toString() === lead.id.toString());
    if (!dialog) { console.log(`SKIP: ${lead.label} — нет диалога`); continue; }
    await client.sendMessage(dialog.entity, { message: lead.msg });
    console.log(`OK: ${lead.label}`);
  } catch(e) {
    console.log(`ERROR: ${lead.label} — ${e.message.slice(0,100)}`);
  }
  await new Promise(r => setTimeout(r, 2000));
}

await client.disconnect();
