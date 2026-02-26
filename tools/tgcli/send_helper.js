const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

async function main() {
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
    await client.disconnect();
    return;
  }
  
  await client.sendMessage(liana.entity, { message: "Привет" });
  console.log(JSON.stringify({ ok: true, sent: "Привет", to: liana.name }));
  
  await client.disconnect();
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
