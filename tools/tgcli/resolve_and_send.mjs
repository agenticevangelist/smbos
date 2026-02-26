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

// Re-run targeted global searches to grab user entities from the API response
const searches = [
  { q: "ищу технического партнёра", targetId: "424727482", text: "Привет! Видел твоё сообщение — ищешь технического партнёра для MVP. У нас команда DevHub.ge: Python, FastAPI, React, LangChain, OpenAI. Готовы взяться за разработку под твоё ТЗ. Расскажи подробнее про проект?" },
  { q: "кто делает сайты", targetId: "480990640", text: "Привет! Мы делаем сайты под ключ — от лендинга до интернет-магазина. Команда DevHub.ge, Тбилиси. Что именно нужно?" },
];

const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

for (const s of searches) {
  process.stderr.write(`\nSearching for "${s.q}" to find user ${s.targetId}...\n`);
  let found = false;

  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q: s.q,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: threeMonthsAgo,
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 50,
    }));

    // The users array in the response has access hashes
    const userMap = new Map();
    for (const u of (res.users || [])) {
      userMap.set(u.id?.toString(), u);
    }

    const user = userMap.get(s.targetId);
    if (user) {
      process.stderr.write(`  ✅ Found: ${user.firstName} ${user.lastName || ""} @${user.username || "no username"}\n`);
      console.log(JSON.stringify({
        id: s.targetId,
        username: user.username,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        found: true
      }));

      await delay(500);
      await client.sendMessage(user, { message: s.text });
      console.log(JSON.stringify({ id: s.targetId, sent: true }));
      found = true;
    } else {
      process.stderr.write(`  ❌ User ${s.targetId} not in response users\n`);
      process.stderr.write(`  Users in response: ${[...(res.users||[])].map(u=>u.id).join(', ')}\n`);

      // Try finding msg with that sender and extracting via InputPeerUser
      for (const msg of (res.messages || [])) {
        const sid = msg.fromId?.userId?.toString();
        if (sid === s.targetId) {
          // Try with access hash from peers
          const accessHash = msg.fromId?.accessHash;
          process.stderr.write(`  Found msg, fromId accessHash: ${accessHash}\n`);
          break;
        }
      }
    }
  } catch(e) {
    process.stderr.write(`  Error: ${e.message}\n`);
    console.log(JSON.stringify({ id: s.targetId, error: e.message }));
  }

  if (!found) {
    // Try broader search
    const broadSearches = [
      "ищу разработчика для проекта",
      "технического партнёра mvp",
      "ищу техпартнёра",
      "кто может сделать сайт",
    ];
    for (const bq of broadSearches) {
      try {
        const res2 = await client.invoke(new Api.messages.SearchGlobal({
          q: bq,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: threeMonthsAgo,
          maxDate: 0,
          offsetRate: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          offsetId: 0,
          limit: 50,
        }));
        const userMap2 = new Map();
        for (const u of (res2.users || [])) userMap2.set(u.id?.toString(), u);
        const user2 = userMap2.get(s.targetId);
        if (user2) {
          process.stderr.write(`  ✅ Found via "${bq}": @${user2.username}\n`);
          console.log(JSON.stringify({ id: s.targetId, username: user2.username, found: true }));
          await delay(500);
          await client.sendMessage(user2, { message: s.text });
          console.log(JSON.stringify({ id: s.targetId, sent: true }));
          found = true;
          break;
        }
      } catch(_) {}
      await delay(600);
    }
  }

  if (!found) {
    console.log(JSON.stringify({ id: s.targetId, sent: false, reason: "could not resolve user entity" }));
  }

  await delay(1500);
}

await client.disconnect();
