import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const client = new TelegramClient(
  new StringSession(sessionStr),
  parseInt(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 3 }
);

await client.connect();

// Join via invite link
const hash = "mVtEGC2Zduo4ZGEy";
try {
  const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
  const chat = result.chats?.[0];
  console.log(JSON.stringify({
    ok: true,
    id: chat?.id?.toString(),
    title: chat?.title,
    forum: chat?.forum,
    accessHash: chat?.accessHash?.toString(),
  }));
} catch(e) {
  // Maybe already joined, try to get info
  console.log(JSON.stringify({ error: e.message.slice(0, 100) }));
}

// Also check dialogs for this group
const dialogs = await client.getDialogs({ limit: 50 });
for (const d of dialogs) {
  const e = d.entity;
  if ((e.className === "Channel" && e.megagroup) || e.className === "Chat") {
    if (e.forum) {
      // Get forum topics
      try {
        const topics = await client.invoke(new Api.channels.GetForumTopics({
          channel: e,
          limit: 50,
          offsetId: 0,
          offsetDate: 0,
          offsetTopic: 0,
        }));
        const topicList = topics.topics?.map(t => ({
          id: t.id,
          title: t.title,
        }));
        console.log(JSON.stringify({
          groupId: `-100${e.id}`,
          title: e.title,
          forum: true,
          topics: topicList,
        }));
      } catch(e2) {}
    }
  }
}

await client.disconnect();
