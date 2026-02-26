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
await client.getDialogs({ limit: 300 });

const result = await client.invoke(new Api.messages.GetDialogs({
  offsetDate: 0,
  offsetId: 0,
  offsetPeer: new Api.InputPeerEmpty(),
  limit: 100,
  hash: BigInt(0),
  folderId: 1,
}));

// Check all archived users - show last 5 messages in each convo
const targets = [
  { username: "pause_ge", name: "Pause.ge" },
  { username: "kawaiisush", name: "Kawaii Sushi" },
  { username: "cafe_Chiti", name: "Алексей Клич - CHITI" },
  { username: "krucheshipa", name: "lizu" },
];

for (const t of targets) {
  try {
    const entity = await client.getEntity(t.username);
    const msgs = await client.getMessages(entity, { limit: 5 });
    const convo = msgs.reverse().map(m => ({
      out: m.out,
      text: m.message?.slice(0, 150),
      date: new Date(m.date * 1000).toISOString().slice(0, 10),
    }));
    console.log(JSON.stringify({ person: t.name, messages: convo }));
  } catch(e) {
    console.log(JSON.stringify({ person: t.name, error: e.message.slice(0, 80) }));
  }
}

await client.disconnect();
