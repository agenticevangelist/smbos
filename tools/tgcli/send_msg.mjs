import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sess = fs.readFileSync(path.join(__dirname, "store/session.txt"),"utf8").trim();
const client = new TelegramClient(new StringSession(sess), 33887530, "fc51f19b4b6ff9f0b8cbd5c4005e9ee4", {connectionRetries:3});
await client.connect();

const SERGEY_ID = BigInt("7730317395");
const dialogs = await client.getDialogs({limit:500});
let entity = null;
for (const d of dialogs) {
  const eid = d.entity?.id?.toString?.() || d.entity?.id;
  if (d.entity?.username?.toLowerCase() === "cheprasov_serg" || eid === "7730317395") {
    entity = d.entity;
    break;
  }
}

if (!entity) throw new Error("Сергей не найден в диалогах");

const text = `Прочитал, да. Стек не совпадает - я Python/JS, у вас C#/.NET. Удачи в поиске!`;

await client.sendMessage(entity, {message: text});
console.log("Отправлено!");
await client.disconnect();
process.exit(0);
