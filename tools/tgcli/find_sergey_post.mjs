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
  // Get Sergey's entity from dialog cache
  const dialogs = await client.getDialogs({limit:200});
  let sergey = null;
  for (const d of dialogs) {
    if (d.entity?.username?.toLowerCase() === "cheprasov_serg") {
      sergey = d.entity;
      break;
    }
  }
  if (!sergey) { console.log("Нет в диалогах"); process.exit(1); }
  console.log("Sergey ID:", sergey.id.toString());

  // Search his messages in cvjobge
  const groupDialogs = await client.getDialogs({limit:500});
  let group = null;
  for (const d of groupDialogs) {
    if (d.entity?.username?.toLowerCase() === "cvjobge") {
      group = d.entity;
      break;
    }
  }
  if (!group) { console.log("Группа не найдена в диалогах"); process.exit(1); }

  const res = await client.invoke(new Api.messages.Search({
    peer: group,
    q: "",
    filter: new Api.InputMessagesFilterEmpty(),
    fromId: new Api.InputPeerUser({userId: sergey.id, accessHash: sergey.accessHash}),
    minDate: Math.floor(Date.now()/1000) - 30*24*3600,
    maxDate: Math.floor(Date.now()/1000),
    limit: 10, offsetId:0, addOffset:0, maxId:0, minId:0, hash:BigInt(0)
  }));

  if (!res.messages?.length) {
    console.log("Постов не найдено в @cvjobge");
  }
  for (const msg of res.messages||[]) {
    const date = new Date(msg.date*1000).toLocaleString("ru-RU");
    console.log(`\n=== [${date}] ===`);
    console.log(msg.message);
  }
} catch(e) {
  console.error("ERR:", e.message);
}
await client.disconnect();
process.exit(0);
