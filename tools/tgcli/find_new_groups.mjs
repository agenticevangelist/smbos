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

// Запросы для поиска НОВЫХ групп и каналов
const searchTerms = [
  // Бизнес и предприниматели
  "предприниматели чат",
  "бизнес чат",
  "малый бизнес",
  "стартапы чат",
  "предприниматели россия",
  "бизнес клуб",
  "предприниматели снг",
  "бизнес нетворкинг",
  // Фриланс и заказы
  "фриланс биржа",
  "заказы разработчикам",
  "it заказы фриланс",
  "веб разработка заказы",
  "разработка сайтов заказы",
  "фриланс it проекты",
  "биржа фриланса программисты",
  // Грузия / СНГ экспаты
  "грузия предприниматели",
  "тбилиси бизнес",
  "грузия стартапы",
  "georgia startups",
  "georgia business",
  "tbilisi entrepreneurs",
  "грузия нетворкинг",
  "экспаты грузия бизнес",
  // AI и автоматизация
  "ai автоматизация бизнес",
  "ai стартапы",
  "нейросети бизнес",
  "автоматизация бизнеса чат",
  "no code автоматизация",
  // Разработка
  "разработка сайтов чат",
  "веб разработчики",
  "telegram боты разработка",
  "мобильная разработка",
];

const foundGroups = new Map();

// Уже вступленные группы - пропускаем
const alreadyIn = new Set([
  "-1003733922250", // DALI AGENTS
  "-1001538373506", // БИЗНЕС/ИП Грузия
  "-1001791634902", // IT-чат Грузия
  "-1001596261124", // IT-чат Тбилиси
  "-1001519678828", // ВАКАНСИИ Грузия
  "-1001714323565", // IT Community Georgia
  "-1003849134483", // Fuck with Agents
  "-1001467914348", // AI Project Manager
  "-1001746980673", // IT_CVJOB_Georgia
  "-1001549745549", // Экспаты Грузия
  "-1001468418749", // БАТУМИ ЧАТ
  "-1001631977807", // Услуги Мастера Грузия
]);

process.stderr.write(`🔍 Ищем новые группы по ${searchTerms.length} запросам...\n`);

for (let i = 0; i < searchTerms.length; i++) {
  const term = searchTerms[i];
  try {
    const res = await client.invoke(new Api.contacts.Search({
      q: term,
      limit: 20,
    }));

    const all = [...(res.chats || []), ...(res.users || [])];
    for (const chat of all) {
      if (chat.className !== "Channel" && chat.className !== "Chat") continue;

      const id = chat.id?.toString();
      const fullId = chat.megagroup || chat.className === "Chat"
        ? `-100${id}`
        : `-100${id}`;

      if (!id) continue;
      if (alreadyIn.has(fullId) || alreadyIn.has(`-${id}`) || alreadyIn.has(id)) continue;
      if (foundGroups.has(id)) continue;

      // Only groups (megagroups), not broadcast channels
      const isGroup = chat.megagroup === true || chat.className === "Chat";
      const isChannel = chat.broadcast === true;

      foundGroups.set(id, {
        id,
        fullId: `-100${id}`,
        title: chat.title || "unknown",
        username: chat.username || null,
        members: chat.participantsCount || 0,
        type: isGroup ? "group" : isChannel ? "channel" : "unknown",
        isGroup,
        isChannel,
      });
    }
  } catch(e) {
    process.stderr.write(`  ⚠️ "${term}": ${e.message}\n`);
  }
  await delay(500);
}

// Sort by member count
const sorted = [...foundGroups.values()]
  .filter(g => g.members > 100) // only active groups
  .sort((a, b) => b.members - a.members);

process.stderr.write(`\n✅ Найдено новых групп/каналов: ${sorted.length}\n`);
console.log(JSON.stringify(sorted, null, 2));
await client.disconnect();
