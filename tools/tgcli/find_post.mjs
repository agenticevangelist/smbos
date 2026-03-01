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
  const entity = await client.getEntity("cvjobge");
  const user = await client.getEntity("Cheprasov_Serg");
  const res = await client.invoke(new Api.messages.Search({
    peer: entity,
    q: "",
    filter: new Api.InputMessagesFilterEmpty(),
    fromId: new Api.InputPeerUser({userId: user.id, accessHash: user.accessHash}),
    minDate: Math.floor(Date.now()/1000) - 14*24*3600,
    maxDate: Math.floor(Date.now()/1000),
    limit: 5, offsetId:0, addOffset:0, maxId:0, minId:0, hash:BigInt(0)
  }));
  if (!res.messages?.length) {
    console.log("Постов не найдено — возможно бот нашёл его через keyword search");
  }
  for (const msg of (res.messages||[])) {
    console.log("=== POST ===");
    console.log(msg.message);
  }
} catch(e) {
  console.error("ERR:", e.message);
}
await client.disconnect();
process.exit(0);
