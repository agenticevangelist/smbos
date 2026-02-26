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
    queries: [
      "разработчика для создания Telegram-бота под ключ",
      "Ищу разработчика Telegram-бота",
      "разработчика telegram бота бюджет",
    ],
    text: "Привет! Видел твой пост — ищешь разработчика Telegram-бота. Мы команда DevHub.ge, делаем ботов под ключ: Python, aiogram, интеграции с API, AI. Расскажи про задачу?"
  },
  {
    targetId: "7145551141",
    queries: [
      "нужен сайт не сильно сложный за подробностями",
      "нужен сайт не сложный в лс",
      "нужен сайт подробностями в лс",
    ],
    text: "Привет! Видел сообщение — нужен сайт. Мы DevHub.ge, делаем сайты под ключ на React, Next.js. Быстро, аккуратно. Что именно нужно?"
  }
];

for (const t of targets) {
  process.stderr.write(`\nResolving ${t.targetId}...\n`);
  let sent = false;

  for (const q of t.queries) {
    if (sent) break;
    try {
      const res = await client.invoke(new Api.messages.SearchGlobal({
        q,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: threeMonthsAgo,
        maxDate: 0,
        offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0,
        limit: 50,
      }));

      // Find user with access hash in the response
      for (const u of (res.users || [])) {
        if (u.id?.toString() !== t.targetId) continue;
        if (!u.accessHash) {
          process.stderr.write(`  Found user but no accessHash\n`);
          continue;
        }
        process.stderr.write(`  ✅ Found with accessHash: ${u.firstName} @${u.username || 'no_username'}\n`);

        // Build InputPeerUser directly
        const peer = new Api.InputPeerUser({
          userId: u.id,
          accessHash: u.accessHash,
        });

        await client.invoke(new Api.messages.SendMessage({
          peer,
          message: t.text,
          randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          noWebpage: true,
        }));

        console.log(JSON.stringify({
          id: t.targetId,
          name: u.firstName,
          username: u.username || null,
          sent: true
        }));
        sent = true;
        break;
      }

      // Also check messages for this sender (they might appear in fromId)
      if (!sent) {
        for (const msg of (res.messages || [])) {
          if (msg.fromId?.userId?.toString() !== t.targetId) continue;
          const accessHash = msg.fromId?.accessHash;
          if (!accessHash) continue;

          const peer = new Api.InputPeerUser({
            userId: BigInt(t.targetId),
            accessHash,
          });

          await client.invoke(new Api.messages.SendMessage({
            peer,
            message: t.text,
            randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
            noWebpage: true,
          }));

          console.log(JSON.stringify({ id: t.targetId, sent: true, via: "fromId" }));
          sent = true;
          break;
        }
      }
    } catch(e) {
      process.stderr.write(`  Error "${q}": ${e.message}\n`);
    }
    await delay(800);
  }

  if (!sent) {
    console.log(JSON.stringify({ id: t.targetId, sent: false }));
  }
  await delay(1500);
}

await client.disconnect();
