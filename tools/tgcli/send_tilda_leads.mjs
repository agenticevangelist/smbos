import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();
const client = new TelegramClient(
  new StringSession(sessionStr), 33887530,
  "fc51f19b4b6ff9f0b8cbd5c4005e9ee4",
  { connectionRetries: 3 }
);
await client.connect();
const delay = ms => new Promise(r => setTimeout(r, ms));
const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

const targets = [
  {
    targetId: "7973473747",
    query: "разработчика на Tilda кто делает сайты под ключ",
    replyText: "Привет! Видел запрос на лендинг. Мы DevHub.ge — делаем на React/Next.js, это быстрее Tilda и лучше для рекламы (Core Web Vitals, скорость). Стоит того. Напиши в лс, обсудим 🙌",
    group: "frilancru",
  },
  {
    targetId: "7302845946",
    query: "разработчик на Tilda одностраничник мебель",
    replyText: "Привет! Видел пост — нужен лендинг для мебели. Мы DevHub.ge, делаем на React/Next.js — лучше Tilda по скорости и гибкости. Под ваш контент и референсы соберём аккуратно. Напишите в лс 👋",
    group: "frilancru",
  },
];

for (const t of targets) {
  process.stderr.write(`\nTarget ${t.targetId}...\n`);
  let sent = false;

  // First try: reply in group
  try {
    const entity = await client.getEntity(t.group);
    const res = await client.invoke(new Api.messages.Search({
      peer: await client.getInputEntity(entity),
      q: t.query,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: threeMonthsAgo, maxDate: 0,
      offsetId: 0, addOffset: 0, limit: 30,
      maxId: 0, minId: 0, hash: BigInt(0),
    }));

    let targetMsg = (res.messages || []).find(m => m.fromId?.userId?.toString() === t.targetId);
    if (!targetMsg && res.messages?.length > 0) {
      // fallback: take first result matching text pattern
      targetMsg = res.messages[0];
    }

    if (targetMsg) {
      await client.invoke(new Api.messages.SendMessage({
        peer: await client.getInputEntity(entity),
        message: t.replyText,
        replyTo: new Api.InputReplyToMessage({ replyToMsgId: targetMsg.id }),
        randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
        noWebpage: true,
      }));
      console.log(JSON.stringify({ id: t.targetId, group: t.group, replyToMsgId: targetMsg.id, sent: true }));
      sent = true;
    }
  } catch(e) {
    process.stderr.write(`  Group reply error: ${e.message}\n`);
  }

  // Second try: global search → DM
  if (!sent) {
    try {
      const res = await client.invoke(new Api.messages.SearchGlobal({
        q: t.query, filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo, maxDate: 0,
        offsetRate: 0, offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0, limit: 50,
      }));
      for (const u of (res.users || [])) {
        if (u.id?.toString() !== t.targetId || !u.accessHash) continue;
        const peer = new Api.InputPeerUser({ userId: u.id, accessHash: u.accessHash });
        await client.invoke(new Api.messages.SendMessage({
          peer, message: t.replyText,
          randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          noWebpage: true,
        }));
        console.log(JSON.stringify({ id: t.targetId, dm: true, sent: true }));
        sent = true;
        break;
      }
    } catch(e) {
      process.stderr.write(`  DM error: ${e.message}\n`);
    }
  }

  if (!sent) console.log(JSON.stringify({ id: t.targetId, sent: false }));
  await delay(2000);
}

// Also try biznes_chat for lead 7145551141
process.stderr.write("\nTrying biznes_chat join + reply...\n");
try {
  const entity = await client.getEntity("biznes_chat");
  await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
  await delay(1500);
  const res = await client.invoke(new Api.messages.Search({
    peer: await client.getInputEntity(entity),
    q: "нужен сайт не сложный",
    filter: new Api.InputMessagesFilterEmpty(),
    minDate: threeMonthsAgo, maxDate: 0,
    offsetId: 0, addOffset: 0, limit: 20,
    maxId: 0, minId: 0, hash: BigInt(0),
  }));
  const msg = (res.messages||[]).find(m => m.fromId?.userId?.toString() === "7145551141");
  if (msg) {
    await client.invoke(new Api.messages.SendMessage({
      peer: await client.getInputEntity(entity),
      message: "Привет! Мы DevHub.ge — сайты под ключ на React/Next.js. Быстро и аккуратно. Напиши в лс 👋",
      replyTo: new Api.InputReplyToMessage({ replyToMsgId: msg.id }),
      randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      noWebpage: true,
    }));
    console.log(JSON.stringify({ id: "7145551141", group: "biznes_chat", sent: true }));
  } else {
    console.log(JSON.stringify({ id: "7145551141", joined: true, msgNotFound: true }));
  }
} catch(e) {
  process.stderr.write(`  biznes_chat: ${e.message}\n`);
  console.log(JSON.stringify({ id: "7145551141", error: e.message }));
}

await client.disconnect();
