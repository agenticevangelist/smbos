import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
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

// Группы рестораторов и владельцев кафе
const targetChats = [
  "restoran_topchat",
  "restodays",
  "restorant_cafe_obchepit",
  "chat_deliverymarketing",
  "RABOTATs_v_HORECA",
  "BiznesKontakti",
  "biznes_chat",
  "moibiz",
];

// Фразы, которые говорят о РЕАЛЬНОЙ боли / поиске помощи с доставкой
const keywords = [
  // Агрегаторы — проблемы (короткие, реальные)
  "упал рейтинг",
  "низкий рейтинг",
  "упали заказы",
  "мало заказов",
  "нет заказов",
  "заблокировали",
  "отключили",

  // Wolt/Bolt/Glovo — поиск помощи
  "помогите с wolt",
  "помогите с bolt",
  "помогите с glovo",
  "проблема с wolt",
  "проблема с bolt",
  "проблема с glovo",
  "вопрос по wolt",
  "вопрос по bolt",

  // Подключение/запуск
  "хочу подключиться",
  "как подключиться",
  "открываю доставку",
  "запускаю доставку",
  "хочу запустить доставку",
  "подключение к wolt",
  "подключение к bolt",
  "подключение к glovo",

  // Поиск специалиста
  "нужен специалист",
  "ищу специалиста",
  "кто разбирается в wolt",
  "кто разбирается в bolt",
  "нужна помощь с меню",
  "как поднять рейтинг",
  "как увеличить заказы",
];

// Исключения — не лиды (сами предлагают услуги)
const EXCLUDE_PHRASES = [
  "предлагаю", "наша компания", "помогаем ресторанам", "наши услуги",
  "делаем аудит", "занимаемся продвижением", "специализируемся",
  "подключаем к", "#реклама", "#услуги", "стоимость от", "под ключ",
];

const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60; // 60 дней

const results = [];

for (const chatUsername of targetChats) {
  let entity;
  try {
    entity = await client.getEntity(chatUsername);
    console.error(`✓ ${chatUsername} → ${entity.title || chatUsername}`);
  } catch (e) {
    console.error(`✗ ${chatUsername}: ${e.message}`);
    continue;
  }

  try {
    let offsetId = 0;
    let done = false;
    let batchCount = 0;

    while (!done && batchCount < 15) {
      const messages = await client.getMessages(entity, {
        limit: 100,
        offsetId,
      });

      if (!messages || messages.length === 0) break;
      batchCount++;

      for (const msg of messages) {
        if (!msg.message || !msg.date) continue;
        if (msg.date < thirtyDaysAgo) { done = true; break; }

        const textLower = msg.message.toLowerCase();
        const matched = keywords.find(kw => textLower.includes(kw.toLowerCase()));
        if (!matched) continue;

        const isSpam = EXCLUDE_PHRASES.some(ex => textLower.includes(ex.toLowerCase()));
        if (isSpam) continue;

        results.push({
          chat: chatUsername,
          chatTitle: entity.title || chatUsername,
          senderId: msg.senderId?.toString() || "unknown",
          text: msg.message.slice(0, 300),
          date: new Date(msg.date * 1000).toISOString().slice(0, 16).replace("T", " "),
          dateTs: msg.date,
          keyword: matched,
        });
      }

      offsetId = messages[messages.length - 1].id;
      await new Promise(r => setTimeout(r, 600));
    }
  } catch (e) {
    console.error(`Error: ${chatUsername}: ${e.message}`);
  }
}

await client.disconnect();

// Дедупликация + сортировка
const seen = new Set();
const deduped = results.filter(r => {
  const key = `${r.chat}|${r.senderId}|${r.text.slice(0, 80)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

deduped.sort((a, b) => b.dateTs - a.dateTs);
const top = deduped.slice(0, 15);

console.log(`\n===== DELI ЛИДЫ (${top.length} из ${deduped.length}) =====`);
if (top.length === 0) {
  console.log(JSON.stringify({ leads: [], message: "Лидов не найдено за последние 30 дней." }));
} else {
  console.log(JSON.stringify({ total: deduped.length, leads: top }, null, 2));
}
