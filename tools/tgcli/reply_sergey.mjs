import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sess = fs.readFileSync(path.join(__dirname, "store/session.txt"),"utf8").trim();
const client = new TelegramClient(new StringSession(sess), 33887530, "fc51f19b4b6ff9f0b8cbd5c4005e9ee4", {connectionRetries:3});
await client.connect();

// Try dialogs first, then getEntity
const dialogs = await client.getDialogs({limit:500});
let entity = null;
for (const d of dialogs) {
  const u = d.entity?.username?.toLowerCase?.() || "";
  const id = d.entity?.id?.toString?.() || "";
  if (u === "cheprasov_serg" || id === "7730317395") {
    entity = d.entity;
    console.log("Нашёл в диалогах:", u, id);
    break;
  }
}

if (!entity) {
  console.log("Не в диалогах, пробую getEntity...");
  try { entity = await client.getEntity("Cheprasov_Serg"); }
  catch(e) { console.log("getEntity fail:", e.message.slice(0, 60)); }
}

if (!entity) {
  console.error("Не удалось найти Сергея");
  process.exit(1);
}

const text = `Прочитал, да. Стек не совпадает - я Python/JS, у вас C#/.NET. Удачи в поиске!`;
await client.sendMessage(entity, {message: text});
console.log("✅ Отправлено!");

await client.disconnect();
process.exit(0);
