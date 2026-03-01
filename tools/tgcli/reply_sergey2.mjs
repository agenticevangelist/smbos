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

// Load ALL dialogs to find Sergey
let offset = 0;
let entity = null;
let found = false;
while (!found) {
  const batch = await client.getDialogs({limit:100, offsetDate:offset});
  if (!batch.length) break;
  for (const d of batch) {
    const u = d.entity?.username?.toLowerCase?.() || "";
    const id = d.entity?.id?.toString?.() || "";
    if (u === "cheprasov_serg" || id === "7730317395") {
      entity = d.entity;
      found = true;
      console.log("Нашёл!", u, id);
      break;
    }
  }
  if (!found) {
    // Use the date of the last dialog as offset for next page
    const last = batch[batch.length - 1];
    const lastDate = last?.dialog?.date || last?.date;
    if (!lastDate || batch.length < 100) break;
    offset = lastDate;
    console.log(`Страница загружена (${batch.length}), ищу дальше...`);
  }
}

if (!entity) {
  // Last resort: send via raw PeerUser — works if server knows the peer
  console.log("Пробую отправить по raw ID...");
  try {
    await client.invoke(new Api.messages.SendMessage({
      peer: new Api.InputPeerUser({userId: BigInt("7730317395"), accessHash: BigInt("0")}),
      message: `Прочитал, да. Стек не совпадает - я Python/JS, у вас C#/.NET. Удачи в поиске!`,
      randomId: BigInt(Math.floor(Math.random() * 1e15)),
      noWebpage: true,
    }));
    console.log("✅ Отправлено по raw ID!");
  } catch(e) {
    console.error("Не удалось:", e.message.slice(0, 100));
  }
} else {
  await client.sendMessage(entity, {message: `Прочитал, да. Стек не совпадает - я Python/JS, у вас C#/.NET. Удачи в поиске!`});
  console.log("✅ Отправлено!");
}

await client.disconnect();
process.exit(0);
