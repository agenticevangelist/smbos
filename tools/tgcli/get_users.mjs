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

// Load dialogs to cache entities
await client.getDialogs({ limit: 10 });

const ids = ["8336636056", "6838481314"];

for (const id of ids) {
  try {
    const entity = await client.getEntity(parseInt(id));
    console.log(JSON.stringify({
      id,
      firstName: entity.firstName,
      lastName: entity.lastName,
      username: entity.username,
    }));
  } catch(e) {
    console.log(JSON.stringify({ id, error: e.message.slice(0, 100) }));
  }
}

await client.disconnect();
