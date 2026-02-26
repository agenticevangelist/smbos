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

const queries = process.env.QUERIES?.split("|") || ["нужен разработчик"];
const results = [];

for (const q of queries) {
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now()/1000) - (30 * 24 * 3600), // last 30 days
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 20,
    }));

    for (const msg of res.messages || []) {
      if (!msg.message) continue;
      // Get chat info
      const chatId = msg.peerId?.channelId || msg.peerId?.chatId || msg.peerId?.userId;
      const chat = res.chats?.find(c => c.id?.equals?.(chatId) || c.id?.toString() === chatId?.toString());
      const user = res.users?.find(u => u.id?.equals?.(msg.fromId?.userId) || u.id?.toString() === msg.fromId?.userId?.toString());
      
      results.push({
        query: q,
        chat: chat?.title || chat?.username || "DM",
        chatUsername: chat?.username,
        senderId: msg.fromId?.userId?.toString(),
        senderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
        senderUsername: user?.username,
        text: msg.message.slice(0, 250),
        date: new Date(msg.date * 1000).toISOString().slice(0, 10),
      });
    }
    await new Promise(r => setTimeout(r, 1000));
  } catch(e) {
    process.stderr.write(`Error on "${q}": ${e.message.slice(0,80)}\n`);
  }
}

fs.writeFileSync('/tmp/global_results.json', JSON.stringify(results, null, 2));
process.stderr.write(`Total: ${results.length} results\n`);
await client.disconnect();
