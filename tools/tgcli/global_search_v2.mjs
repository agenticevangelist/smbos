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
const delay = ms => new Promise(r => setTimeout(r, ms));

// Широкий список запросов для глобального поиска
const queries = [
  // Прямые запросы на разработку
  "нужен разработчик сайта",
  "нужен разработчик приложения",
  "нужен разработчик бота",
  "ищу разработчика для проекта",
  "нужен программист для",
  "ищу фрилансера разработчика",
  "ищу исполнителя разработка",
  "нужен веб разработчик",
  "нужен фуллстек",
  "нужен full stack",
  "заказать разработку сайта",
  "заказать телеграм бота",
  "нужен лендинг под ключ",
  "разработка сайта под заказ",
  "нужна автоматизация бизнеса",
  "нужна crm система",
  "нужна интеграция api",
  "нужен ai бот",
  "нужен чат бот",
  "chatbot разработка",
  // English queries
  "need web developer",
  "looking for developer Georgia",
  "need mobile app developer",
  "need telegram bot developer",
  "hire freelance developer",
  "need AI automation",
  "website development needed",
  // Стартапы/партнёры
  "ищу технического партнёра",
  "ищу кофаундера разработчика",
  "ищу тимлида",
  "нужен технический сооснователь",
  "mvp разработка ищу",
  // Боль клиентов
  "кто делает сайты",
  "кто делает ботов",
  "кто занимается разработкой",
  "посоветуйте разработчика",
  "порекомендуйте разработчика",
  "кто может сделать сайт",
  "кто может создать бота",
];

const seenSenders = new Map(); // senderId -> best result
const seenMessages = new Set();
const threeMonthsAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);

// Noise filters
const noisePatterns = [
  /#вакансия/i, /#vacancy/i, /#resume/i, /#резюме/i,
  /ищу работу/i, /looking for work/i, /ищу\s+job/i,
  /продаю/i, /продам/i, /заказывал с сайта/i,
  /наша команда предлагает/i, /мы предлагаем услуги/i,
  /студия разработки/i, /web-студия/i, /вебстудия/i,
];

process.stderr.write(`🌍 Глобальный поиск по ${queries.length} запросам...\n`);

for (let i = 0; i < queries.length; i++) {
  const q = queries[i];
  process.stderr.write(`  [${i+1}/${queries.length}] "${q}"\n`);

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

    const chatMap = new Map();
    for (const c of [...(res.chats || []), ...(res.users || [])]) {
      chatMap.set(c.id?.toString(), c.title || c.firstName || c.username || "unknown");
    }

    for (const msg of (res.messages || [])) {
      if (!msg.message || !msg.fromId || msg.post) continue;
      if (msg.date < threeMonthsAgo) continue;

      const key = `${msg.peerId?.channelId || msg.peerId?.chatId}_${msg.id}`;
      if (seenMessages.has(key)) continue;
      seenMessages.add(key);

      const text = msg.message;
      if (noisePatterns.some(p => p.test(text))) continue;
      if (text.length < 20) continue;

      const senderId = msg.fromId?.userId?.toString() || "unknown";
      const chatId = msg.peerId?.channelId?.toString() || msg.peerId?.chatId?.toString() || "dm";
      const chatName = chatMap.get(chatId) || chatId;
      const date = new Date(msg.date * 1000).toISOString().slice(0, 10);

      const entry = {
        query: q,
        chat: chatName,
        chatId,
        senderId,
        text: text.slice(0, 400),
        date,
      };

      // Keep most recent per sender
      if (!seenSenders.has(senderId) || seenSenders.get(senderId).date < date) {
        seenSenders.set(senderId, entry);
      }
    }
  } catch(e) {
    process.stderr.write(`    ⚠️ Error: ${e.message}\n`);
  }

  await delay(800);
}

const results = [...seenSenders.values()].sort((a, b) => b.date.localeCompare(a.date));
process.stderr.write(`\n✅ Готово! Уникальных лидов: ${results.length}\n`);
console.log(JSON.stringify(results, null, 2));
await client.disconnect();
