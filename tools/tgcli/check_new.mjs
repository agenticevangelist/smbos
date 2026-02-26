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

// Check most recent dialogs
const dialogs = await client.getDialogs({ limit: 10 });
for (const d of dialogs) {
  const e = d.entity;
  console.log(JSON.stringify({
    id: e.id?.toString(),
    title: e.title || e.firstName || e.username,
    type: e.className,
    forum: e.forum || false,
    unread: d.unreadCount,
  }));
}

await client.disconnect();
