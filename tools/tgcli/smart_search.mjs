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

const myIds = ["8466294883", "8412690459"]; // David's accounts
const skipWords = ["#вакансия","#vacancy","#resume","#резюме","salary","gross","ищу работу","ищу джоб","looking for job"];

const devQueries = [
  "нужен разработчик", "ищу разработчика", "нужен телеграм бот",
  "нужен сайт срочно", "нужна автоматизация", "ищу фрилансера",
  "нужен лендинг", "нужен AI агент", "заказать бота",
];

const deliveryQueries = [
  "помогите с wolt", "помогите с bolt", "упал рейтинг wolt",
  "нет заказов доставка", "как поднять рейтинг", "подключить wolt",
  "проблема с агрегатором", "нужен специалист wolt",
];

async function searchGlobal(q, type) {
  const results = [];
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q,
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now()/1000) - (30 * 24 * 3600),
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 15,
    }));

    for (const msg of res.messages || []) {
      if (!msg.message) continue;
      const senderId = msg.fromId?.userId?.toString();
      if (myIds.includes(senderId)) continue;
      const text = msg.message.toLowerCase();
      if (skipWords.some(w => text.includes(w))) continue;

      const chatId = msg.peerId?.channelId || msg.peerId?.chatId || msg.peerId?.userId;
      const chat = res.chats?.find(c => c.id?.toString() === chatId?.toString());
      const user = res.users?.find(u => u.id?.toString() === senderId);

      results.push({
        type,
        query: q,
        chat: chat?.title || "DM",
        chatUsername: chat?.username,
        senderId,
        senderName: user ? `${user.firstName||''} ${user.lastName||''}`.trim() : null,
        senderUsername: user?.username,
        text: msg.message.slice(0, 250),
        date: new Date(msg.date * 1000).toISOString().slice(0, 10),
      });
    }
  } catch(e) {}
  await new Promise(r => setTimeout(r, 1200));
  return results;
}

const devResults = [];
for (const q of devQueries) {
  const r = await searchGlobal(q, "dev");
  devResults.push(...r);
}

const deliveryResults = [];
for (const q of deliveryQueries) {
  const r = await searchGlobal(q, "delivery");
  deliveryResults.push(...r);
}

// Deduplicate by senderId
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter(r => {
    if (seen.has(r.senderId)) return false;
    seen.add(r.senderId);
    return true;
  });
};

const final = {
  dev: dedup(devResults).slice(0, 10),
  delivery: dedup(deliveryResults).slice(0, 10),
};

fs.writeFileSync('/tmp/smart_leads.json', JSON.stringify(final, null, 2));
process.stderr.write(`Dev: ${final.dev.length} | Delivery: ${final.delivery.length}\n`);
await client.disconnect();
