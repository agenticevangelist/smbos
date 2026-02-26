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

const KEYWORDS = [
  'wolt','glovo','bolt food','яндекс еда',
  'агрегатор','доставку','доставка еды',
  'мало заказов','нет заказов','упал рейтинг','плохой рейтинг',
  'подключить доставку','запустить доставку','открываем','открыл',
  'наш ресторан','наше кафе','наше заведение','моё кафе','мой ресторан',
  'требуется повар','требуется официант','ищем бармена','в команду',
  'наша пиццерия','наш бар','наша кофейня','наша пекарня'
];

// Все чаты для поиска
const CHAT_NAMES = [
  'Повара Тбилиси',
  'Бармены Тбилиси',
  'Официанты Тбилиси',
  'Рестораторы | Чат',
  'Ресторанный Бизнес',
  'Бизнес чат: Доставка еды',
  'Wolt Partner Астана',
  'Wolt Partner Алматы',
];

const dialogs = await client.getDialogs({ limit: 400 });
const seen = new Set();
const leads = [];

for (const chatName of CHAT_NAMES) {
  const group = dialogs.find(d => {
    const title = d.entity?.title || d.entity?.firstName || '';
    return title.toLowerCase().includes(chatName.toLowerCase().slice(0, 12));
  });

  if (!group) {
    process.stderr.write(`Not found: ${chatName}\n`);
    continue;
  }

  process.stderr.write(`Scanning: ${chatName}...\n`);

  try {
    const msgs = await client.getMessages(group.entity, { limit: 300 });
    
    for (const m of msgs) {
      if (!m.message || m.out || !m.senderId) continue;
      const t = m.message.toLowerCase();
      const key = m.senderId?.toString();
      
      if (KEYWORDS.some(k => t.includes(k)) && !seen.has(key)) {
        seen.add(key);
        try {
          const sender = await client.getEntity(m.senderId);
          const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
          if (!name) continue;
          
          leads.push({
            chat: chatName,
            name,
            username: sender.username || null,
            id: key,
            text: m.message.slice(0, 250),
            date: new Date(m.date * 1000).toISOString().slice(0, 10)
          });
        } catch(e) {}
      }
    }
  } catch(e) {
    process.stderr.write(`Error ${chatName}: ${e.message.slice(0,60)}\n`);
  }

  await new Promise(r => setTimeout(r, 600));
}

// Вывод результатов
leads.forEach(l => console.log(JSON.stringify(l)));
process.stderr.write(`\nИтого лидов: ${leads.length}\n`);

await client.disconnect();
