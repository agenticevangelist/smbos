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

const LEADS = [
  { id: "289066322", name: "K K (@dshaizer)" },
  { id: "656657411", name: "Никита (@nikita3666)" },
  { id: "464284459", name: "Рамиль (@Riraa20022010)" },
  { id: "7150851954", name: "MAGARI FOOD Batumi" },
  { id: "6621509770", name: "Kawaii Sushi" },
];

for (const lead of LEADS) {
  try {
    const msgs = await client.getMessages(parseInt(lead.id), { limit: 10 });
    const outgoing = msgs.filter(m => m.out);
    process.stdout.write(`${lead.name}|${outgoing.length > 0 ? 'ПИСАЛИ' : 'НЕТ'}|${msgs.length}\n`);
    if (outgoing.length > 0) {
      outgoing.forEach(m => process.stdout.write(`  -> [${new Date(m.date*1000).toISOString().slice(0,10)}]: ${(m.message||'').slice(0,150)}\n`));
    }
  } catch(e) {
    process.stdout.write(`${lead.name}|НЕТ|0\n`);
  }
  await new Promise(r => setTimeout(r, 500));
}

await client.disconnect();
