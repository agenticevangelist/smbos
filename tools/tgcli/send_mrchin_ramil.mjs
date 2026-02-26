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

// --- Mr.Chin: новое заведение на доставку (суши+пицца), Тбилиси ---
// Из чата ВАКАНСИИ Грузия (-1001519678828)
const MSG_MRCHIN = `Привет! Видел, что открываешь новое заведение на доставку — суши и пицца. Это как раз наш профиль.

Мы Delivery Flow — запускаем и ведём доставку под ключ. Настраиваем Wolt/Glovo/Bolt с нуля: меню, фото, описания, реклама, видимость в поиске. Плюс CRM и программа лояльности под ваш формат.

Если интересно — пообщаемся до открытия, чтобы сразу стартовать сильно.`;

// --- Рамиль: открывает новое кафе, выбирает между iiko и saby presto ---
// Из чата Рестораторы | Чат (-1001584015504)
const MSG_RAMIL = `Привет! Видел вопрос про iiko и saby presto — сам часто с этим работаю при настройке доставки под ключ.

Мы Delivery Flow — помогаем кафе и ресторанам запускать и развивать доставку: Wolt, Glovo, Bolt, Яндекс Еда. Как раз настраиваем интеграцию с CRM (iiko/saby), программу лояльности, меню под агрегаторы.

Если открываете новое заведение — можем зайти на этапе запуска, чтобы сразу всё выстроить правильно. Интересно?`;

const targets = [
  { groupId: "-1001519678828", senderId: "7047201383", msg: MSG_MRCHIN, label: "Mr.Chin" },
  { groupId: "-1001584015504", senderId: "464284459",  msg: MSG_RAMIL,  label: "Рамиль" },
];

for (const t of targets) {
  try {
    const group = dialogs.find(d => '-100' + d.entity?.id?.toString() === t.groupId);
    if (!group) { console.log(JSON.stringify({ error: "group not found", label: t.label })); continue; }

    const msgs = await client.getMessages(group.entity, { limit: 500 });
    const msg = msgs.find(m => m.senderId?.toString() === t.senderId);

    if (!msg) { console.log(JSON.stringify({ error: "sender message not found", label: t.label })); continue; }

    const sender = await client.getEntity(msg.senderId);
    await client.sendMessage(msg.senderId, { message: t.msg });

    const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
    console.log(JSON.stringify({ ok: true, to: name, username: sender.username || null, label: t.label }));
  } catch(e) {
    console.log(JSON.stringify({ error: e.message.slice(0, 150), label: t.label }));
  }

  await new Promise(r => setTimeout(r, 1500));
}

await client.disconnect();
