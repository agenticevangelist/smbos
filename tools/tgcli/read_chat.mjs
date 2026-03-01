import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sess = fs.readFileSync(path.join(__dirname, "store/session.txt"),"utf8").trim();
const client = new TelegramClient(new StringSession(sess), 33887530, "fc51f19b4b6ff9f0b8cbd5c4005e9ee4", {connectionRetries:3});
await client.connect();

try {
  // Try getting entity from dialog cache first (no flood wait)
  const dialogs = await client.getDialogs({limit:200});
  let entity = null;
  for (const d of dialogs) {
    if (d.entity?.username?.toLowerCase() === "cheprasov_serg") {
      entity = d.entity;
      break;
    }
  }
  if (!entity) {
    console.log("Не нашёл в диалогах, пробую напрямую...");
    entity = await client.getEntity("Cheprasov_Serg");
  }

  const msgs = await client.getMessages(entity, {limit: 20});
  for (const m of msgs.reverse()) {
    const who = m.out ? "ВЫ" : "Сергей";
    const time = new Date(m.date * 1000).toLocaleTimeString("ru-RU");
    console.log(`[${time}] ${who}: ${m.message}`);
  }
} catch(e) {
  console.error("ERR:", e.message);
}
await client.disconnect();
process.exit(0);
