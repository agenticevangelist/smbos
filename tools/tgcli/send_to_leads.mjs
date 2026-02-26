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

const targets = [
  {
    userId: 424727482,
    chatUsername: "AIProjectManager",  // try username first
    chatId: -1001467914348,
    text: "Привет! Видел твоё сообщение — ищешь технического партнёра для MVP. У нас команда DevHub.ge: Python, FastAPI, React, LangChain, OpenAI. Готовы взяться за разработку под твоё ТЗ. Расскажи подробнее про проект?"
  },
  {
    userId: 480990640,
    chatId: -1001468418749,
    text: "Привет! Мы делаем сайты под ключ — от лендинга до интернет-магазина. Команда DevHub.ge, Тбилиси. Что именно нужно?"
  }
];

for (const t of targets) {
  try {
    // Get the group entity and fetch messages to resolve user's access hash
    const dialogs = await client.getDialogs({ limit: 500 });
    const dialog = dialogs.find(d => {
      const eid = d.entity?.id?.toString();
      return eid === Math.abs(t.chatId).toString() ||
             eid === t.chatId.toString().replace('-100','');
    });

    if (!dialog) {
      process.stderr.write(`Dialog not found for chatId ${t.chatId}\n`);
      // Try without dialog
      const msgs = await client.getMessages(t.chatId, { limit: 300 });
      const userMsg = msgs.find(m => m.fromId?.userId?.toString() === t.userId.toString());
      if (!userMsg) {
        console.log(JSON.stringify({ id: t.userId, error: "user message not found in chat" }));
        continue;
      }
    }

    // Fetch messages from that user to get their access hash cached
    const entity = dialog ? dialog.entity : t.chatId;
    const msgs = await client.getMessages(entity, { limit: 300 });
    const userMsg = msgs.find(m => m.fromId?.userId?.toString() === t.userId.toString());

    if (!userMsg) {
      console.log(JSON.stringify({ id: t.userId, error: "message not found" }));
      continue;
    }

    // Get full user entity from the sender
    const sender = await userMsg.getSender();
    if (!sender) {
      console.log(JSON.stringify({ id: t.userId, error: "sender not resolved" }));
      continue;
    }

    console.log(JSON.stringify({
      id: t.userId,
      username: sender.username,
      name: (sender.firstName || "") + " " + (sender.lastName || ""),
      resolved: true
    }));

    await delay(500);
    await client.sendMessage(sender, { message: t.text });
    console.log(JSON.stringify({ id: t.userId, sent: true }));

  } catch(e) {
    console.log(JSON.stringify({ id: t.userId, error: e.message }));
  }

  await delay(2000);
}

await client.disconnect();
