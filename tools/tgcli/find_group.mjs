import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
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
const dialogs = await client.getDialogs({ limit: 30 });

for (const d of dialogs) {
  const e = d.entity;
  if ((e.className === "Channel" && e.megagroup) || e.className === "Chat") {
    // Check if it's a forum (has topics)
    console.log(JSON.stringify({
      id: e.id?.toString(),
      title: e.title,
      forum: e.forum || false,
      megagroup: e.megagroup || false,
      date: new Date(e.date * 1000).toISOString().slice(0,10),
    }));
  }
}

await client.disconnect();
