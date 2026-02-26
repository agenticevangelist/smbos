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
    targetId: "8335775465",
    groupUsername: "frilancru",
    searchQuery: "Ищу разработчика для создания Telegram-бота",
    replyText: "Привет! Мы команда DevHub.ge — делаем Telegram-ботов под ключ: Python, aiogram, интеграции с API, AI-функции. Напиши в личку, обсудим задачу 🙌"
  },
  {
    targetId: "7145551141",
    groupUsername: "biznes_chat",
    searchQuery: "нужен сайт не сильно сложный",
    replyText: "Привет! Мы DevHub.ge — сайты под ключ на React/Next.js. Быстро и аккуратно. Напиши в лс, расскажи что нужно 👋"
  }
];

for (const t of targets) {
  process.stderr.write(`\nLooking for msg from ${t.targetId} in @${t.groupUsername}...\n`);

  try {
    const groupEntity = await client.getEntity(t.groupUsername);

    // Search within the group
    const res = await client.invoke(new Api.messages.Search({
      peer: await client.getInputEntity(groupEntity),
      q: t.searchQuery,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: threeMonthsAgo,
      maxDate: 0,
      offsetId: 0,
      addOffset: 0,
      limit: 30,
      maxId: 0,
      minId: 0,
      hash: BigInt(0),
    }));

    // Find message from our target user
    let targetMsg = null;
    for (const msg of (res.messages || [])) {
      if (msg.fromId?.userId?.toString() === t.targetId) {
        targetMsg = msg;
        break;
      }
    }

    // If not found by sender, take most recent matching message
    if (!targetMsg && res.messages?.length > 0) {
      targetMsg = res.messages[0];
      process.stderr.write(`  Using first result (sender: ${targetMsg.fromId?.userId})\n`);
    }

    if (!targetMsg) {
      process.stderr.write(`  ❌ Message not found\n`);
      console.log(JSON.stringify({ id: t.targetId, sent: false, reason: "message not found" }));
      continue;
    }

    process.stderr.write(`  ✅ Found msg id=${targetMsg.id}, replying...\n`);

    // Reply to their message in the group
    await client.invoke(new Api.messages.SendMessage({
      peer: await client.getInputEntity(groupEntity),
      message: t.replyText,
      replyTo: new Api.InputReplyToMessage({
        replyToMsgId: targetMsg.id,
      }),
      randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
      noWebpage: true,
    }));

    console.log(JSON.stringify({
      id: t.targetId,
      group: t.groupUsername,
      replyToMsgId: targetMsg.id,
      sent: true
    }));

  } catch(e) {
    process.stderr.write(`  Error: ${e.message}\n`);
    console.log(JSON.stringify({ id: t.targetId, error: e.message }));
  }

  await delay(2000);
}

await client.disconnect();
