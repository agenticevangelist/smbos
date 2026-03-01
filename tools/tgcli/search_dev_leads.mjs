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

// Группы где сидят предприниматели, ищущие разработчиков
// Убрали ipgeorgiachat — там бот-ответы мусорят
const targetUsernames = [
  "BiznesKontakti",
  "biznes_chat",
  "biznes_club_russia",
  "predprinimateli_rf2",
  "predprinimateli_chat",
  "Frilans_Birzha",
  "frilancru",
  "moibiz",
  "jobospherechat",
  "tilda_zakazy_chat",
  "thefoundersclub",
  "ProductsAndStartups",
  "tbilisi_startup",
];

// Только конкретные фразы — двухсловные, не срабатывают на бот-ответы
const keywords = [
  // Прямой спрос (точные фразы)
  "ищу разработчика",
  "нужен разработчик",
  "ищу программиста",
  "нужен программист",
  "ищу фрилансера",
  "нужен фрилансер",

  // Задачи (двухсловные — меньше ложных срабатываний)
  "нужен лендинг",
  "нужен телеграм бот",
  "нужна автоматизация",
  "нужен чат-бот",
  "нужен чатбот",
  "нужна crm",

  // Вопросы-поиски
  "кто сделает сайт",
  "кто делает ботов",
  "посоветуйте разработчика",
  "посоветуйте программиста",
  "порекомендуйте разработчика",
  "ищу подрядчика на",
  "ищу исполнителя",

  // Боли
  "заказать сайт",
  "заказать бота",
  "сколько стоит сайт",
  "сколько стоит бот",
  "помогите с ботом",
  "помогите с сайтом",
];

// Слова-исключения: если в тексте есть — это не лид (человек предлагает услуги)
const EXCLUDE_PHRASES = [
  "предлагаю", "разрабатываю", "делаю сайты", "помогу с сайтом",
  "наша команда", "наша студия", "веб-студия", "мои услуги",
  "#помогу", "#услуги", "занимаюсь разработкой", "специализируюсь",
  "портфолио", "кейсы", "стоимость от", "под ключ от",
];

const now = Math.floor(Date.now() / 1000);
const thirtyDaysAgo = now - 60 * 24 * 60 * 60; // 60 дней

const allResults = [];

for (const username of targetUsernames) {
  console.error(`\n🔍 @${username}...`);
  let entity;
  try {
    entity = await client.getEntity(username);
  } catch (e) {
    console.error(`  ❌ ${username}: ${e.message}`);
    continue;
  }

  for (const kw of keywords) {
    try {
      const messages = await client.getMessages(entity, {
        search: kw,
        limit: 30,
      });

      for (const msg of messages) {
        if (!msg.message) continue;
        if (msg.date < thirtyDaysAgo) continue;

        const textLower = msg.message.toLowerCase();
        const isSpam = EXCLUDE_PHRASES.some(ex => textLower.includes(ex.toLowerCase()));
        if (isSpam) continue;

        allResults.push({
          chat: username,
          chatTitle: entity.title || username,
          senderId: msg.senderId?.toString() ?? "unknown",
          text: msg.message.slice(0, 300),
          date: new Date(msg.date * 1000).toISOString().slice(0, 16).replace("T", " "),
          keyword: kw,
          _ts: msg.date,
        });
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      // silent
    }
  }
}

// Дедупликация
const seen = new Set();
const deduped = allResults.filter(r => {
  const key = `${r.chat}|${r.senderId}|${r.text.slice(0, 80)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

deduped.sort((a, b) => b._ts - a._ts);

const top = deduped.slice(0, 15).map(({ _ts, ...r }) => r);

console.log(`\n===== DEV ЛИДЫ (${top.length} из ${deduped.length}) =====`);
console.log(JSON.stringify(top, null, 2));

await client.disconnect();
