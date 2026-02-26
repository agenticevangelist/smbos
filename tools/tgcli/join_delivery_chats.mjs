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

// Список чатов для вступления — ищем по названию
const TARGETS = [
  // Тбилиси - вакансии (горячие лиды)
  "Повара Тбилиси",
  "Бармены Тбилиси",
  "Официанты Тбилиси",
  // Рестораторы бизнес
  "Рестораторы | Чат",
  "Ресторанный Бизнес",
  "Бизнес в общепите",
  "HORECA FOOD BUSINESS",
  "Бизнес чат: Доставка еды",
  // Казахстан
  "Работа Алматы Общепит Рестораны Кафе",
  // Wolt Partners
  "Wolt Partner Астана",
  "Wolt Partner Алматы",
];

for (const query of TARGETS) {
  try {
    // Ищем через contacts.Search
    const res = await client.invoke(new Api.contacts.Search({ q: query, limit: 5 }));
    
    // Пробуем найти совпадение в чатах
    const match = res.chats?.find(c => 
      c.title?.toLowerCase().includes(query.toLowerCase().slice(0, 15))
    );
    
    if (!match) {
      console.log(JSON.stringify({ query, status: "not found" }));
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    // Пробуем вступить
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: match }));
      console.log(JSON.stringify({ ok: true, joined: match.title, id: match.id?.toString() }));
    } catch(e) {
      if (e.message?.includes("USER_ALREADY_PARTICIPANT")) {
        console.log(JSON.stringify({ ok: true, already: true, name: match.title }));
      } else {
        console.log(JSON.stringify({ error: e.message?.slice(0, 100), name: match.title }));
      }
    }

    await new Promise(r => setTimeout(r, 1200));
  } catch(e) {
    console.log(JSON.stringify({ error: e.message?.slice(0, 100), query }));
    await new Promise(r => setTimeout(r, 800));
  }
}

await client.disconnect();
console.log("Done");
