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

const chats = [
  // Рестораторы
  "restoran_topchat", "restodays", "restorant_cafe_obchepit",
  "restoratory_chat", "restodeliverychanell", "ariototulobl",
  // Доставка
  "chat_deliverymarketing",
  // Предприниматели
  "BiznesKontakti", "biznes_chat", "biznes_club_russia",
  "predprinimateli_rf2", "predprinimateli_chat",
  // Фриланс/разработка
  "Frilans_Birzha", "tilda_zakazy_chat", "freelance_chat_it",
];

const devKw = [
  "нужен разработчик","ищу разработчик","нужен программист",
  "нужен сайт","нужен бот","нужна автоматизация","ищу фрилансер",
  "нужен лендинг","телеграм бот","нужен ai","ищу подрядчик",
  "кто сделает сайт","кто делает ботов","нужна интеграц",
  "посоветуйте разработчик","кто занимается разработк",
  "нужен специалист по сайт","заказать сайт","заказать бота",
  "нужен программист","ищу исполнителя","кто может разработать",
];

const deliveryKw = [
  "помогите с wolt","помогите с bolt","помогите с glovo",
  "как поднять рейтинг","как увеличить заказы","как настроить агрегатор",
  "проблема с доставкой","подключить к wolt","подключить к bolt",
  "нужен специалист по доставке","кто работает с агрегатор",
  "кто настраивает wolt","упал рейтинг","потеряли позиции",
  "как работать с wolt","теряем клиентов","нет заказов",
  "помогите настроить","кто занимается агрегатор",
  "посоветуйте по доставке","нужна помощь wolt",
];

const painKw = [
  "нужна помощь","не знаю как","кто посоветует","порекомендуйте",
  "ищу кого","кто умеет","кто знает как","помогите разобраться",
  "как автоматизировать","нужно настроить crm","нужна crm",
  "устал отвечать вручную","теряю клиентов","нет системы учёта",
];

const allKw = [...devKw, ...deliveryKw, ...painKw];
const results = [];
const threeMonthsAgo = Date.now() / 1000 - (90 * 24 * 3600);

for (const username of chats) {
  try {
    const entity = await client.getEntity(username);
    const msgs = await client.getMessages(entity, { limit: 500 });
    let hits = 0;
    for (const msg of msgs) {
      if (!msg.message || msg.date < threeMonthsAgo || msg.post || !msg.senderId) continue;
      const text = msg.message.toLowerCase();
      const matched = allKw.find(kw => text.includes(kw));
      if (matched) {
        const type = devKw.includes(matched) ? "dev" : deliveryKw.includes(matched) ? "delivery" : "pain";
        results.push({
          chat: username,
          senderId: msg.senderId?.toString(),
          text: msg.message.slice(0, 280),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
          type,
        });
        hits++;
      }
    }
    process.stderr.write(`✓ @${username}: ${hits} hits\n`);
  } catch(e) {
    process.stderr.write(`✗ @${username}: ${e.message.slice(0,50)}\n`);
  }
}

// Deduplicate by chat+sender
const seen = new Set();
const unique = results.filter(r => {
  const k = `${r.chat}_${r.senderId}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

fs.writeFileSync('/tmp/best_leads.json', JSON.stringify(unique, null, 2));
process.stderr.write(`\nИтого уникальных лидов: ${unique.length}\n`);
await client.disconnect();
