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
const dialogs = await client.getDialogs({ limit: 200 });
const liana = dialogs.find(d => d.name && d.name.toLowerCase() === "liana");

if (!liana) {
  console.log(JSON.stringify({ error: "Liana not found" }));
} else {
  await client.sendMessage(liana.entity, { message: "Привет" });
  console.log(JSON.stringify({ ok: true, sent: "Привет", to: liana.name }));
}

await client.disconnect();
