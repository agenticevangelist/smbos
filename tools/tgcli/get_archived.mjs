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

// Get archived dialogs (folder 1 = Archive)
const result = await client.invoke(new Api.messages.GetDialogs({
  offsetDate: 0,
  offsetId: 0,
  offsetPeer: new Api.InputPeerEmpty(),
  limit: 100,
  hash: BigInt(0),
  folderId: 1,
}));

const chats = result.dialogs?.map((d, i) => {
  const peer = result.chats?.[i] || result.users?.[i];
  return {
    id: d.peer?.channelId?.toString() || d.peer?.chatId?.toString() || d.peer?.userId?.toString(),
    title: peer?.title || peer?.firstName || peer?.username || "unknown",
    type: d.peer?.className,
    unread: d.unreadCount,
  };
}) || [];

console.log(JSON.stringify(chats.slice(0, 50)));
await client.disconnect();
