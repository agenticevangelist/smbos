/**
 * night_discover.mjs — Поиск НОВЫХ групп и лидов в них
 * Параллельный агент — ищет группы которых нет в основном списке
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const BOT_TOKEN = "8525580677:AAFxYCIP9Fi8Rlp_iy8ByeL_wYhyOSF766c";
const DAVID_CHAT_ID = "7981171680";
const SENT_LOG = "/tmp/night_sent_leads.json";
const DISCOVER_LOG = "/tmp/night_discover.log";

const ALREADY_SENT = ["rafael99m", "mary_gvalia", "NiSuVi", "zhannafokk", "topersmm1"];

// Запросы для поиска НОВЫХ групп
const NEW_GROUP_QUERIES = [
  "рестораторы грузия",
  "кафе тбилиси",
  "ресторан батуми",
  "доставка еды грузия",
  "wolt грузия",
  "bolt food грузия",
  "предприниматели грузия",
  "бизнес тбилиси",
  "разработчики грузия",
  "стартапы грузия",
  "freelance georgia",
  "it georgia",
  "restaurant georgia",
  "food delivery georgia",
];

function sendToBot(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: DAVID_CHAT_ID, text, parse_mode: "HTML" });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d)); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function loadSentLog() {
  if (fs.existsSync(SENT_LOG)) {
    try { return JSON.parse(fs.readFileSync(SENT_LOG, "utf8")); } catch {}
  }
  return ALREADY_SENT.slice();
}

function addToSentLog(username) {
  const log = loadSentLog();
  if (!log.includes(username)) {
    log.push(username);
    fs.writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));
  }
}

function rateLead(text) {
  const t = text.toLowerCase();
  let score = 0;
  if (t.includes("нужен разработчик") || t.includes("ищу разработчик")) score += 5;
  if (t.includes("нужен сайт") || t.includes("нужен бот")) score += 4;
  if (t.includes("wolt") || t.includes("bolt") || t.includes("glovo")) score += 4;
  if (t.includes("подключить") || t.includes("открываю")) score += 3;
  if (t.includes("нужно приложение") || t.includes("автоматизация")) score += 3;
  if (t.includes("бюджет") || t.includes("сколько стоит")) score += 2;
  if (t.includes("срочно")) score += 2;
  return Math.min(score, 10);
}

async function searchInGroup(client, entity, groupUsername, cycleNum) {
  const leads = [];
  const keywords = ["нужен разработчик", "нужен сайт", "wolt", "bolt", "нужен бот", "ищу", "помогите"];
  const now = Math.floor(Date.now() / 1000);
  const twoDaysAgo = now - 2 * 24 * 60 * 60;
  const sentLog = loadSentLog();

  for (const kw of keywords) {
    try {
      const messages = await client.invoke(
        new Api.messages.Search({
          peer: entity,
          q: kw,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: twoDaysAgo,
          maxDate: now,
          limit: 20,
          offsetId: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: BigInt(0),
        })
      );
      for (const msg of (messages.messages || [])) {
        if (!msg.fromId || !msg.message) continue;
        const userId = msg.fromId.userId?.toString();
        if (!userId) continue;
        let username = null;
        try {
          const user = await client.getEntity(new Api.PeerUser({ userId: BigInt(userId) }));
          username = user.username;
        } catch {}
        if (!username || sentLog.includes(username)) continue;
        const score = rateLead(msg.message);
        if (score >= 7) {
          leads.push({ username, userId, text: msg.message.slice(0, 200), score, group: groupUsername });
        }
      }
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }
  return leads;
}

async function main() {
  const cycleArg = parseInt(process.argv[2] || "1");
  fs.appendFileSync(DISCOVER_LOG, `\n[${new Date().toISOString()}] Цикл discover ${cycleArg} начат\n`);

  const client = new TelegramClient(
    new StringSession(sessionStr),
    parseInt(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 5 }
  );
  await client.connect();

  const newGroups = [];
  const allLeads = [];

  // Ищем новые группы
  const queryOffset = (cycleArg - 1) * 2;
  const queriesToTry = NEW_GROUP_QUERIES.slice(queryOffset % NEW_GROUP_QUERIES.length, (queryOffset % NEW_GROUP_QUERIES.length) + 3);

  for (const query of queriesToTry) {
    try {
      const result = await client.invoke(
        new Api.contacts.Search({ q: query, limit: 10 })
      );
      for (const chat of (result.chats || [])) {
        if (chat.megagroup && chat.participantsCount > 200) {
          const username = chat.username;
          if (username) {
            newGroups.push({ username, title: chat.title, members: chat.participantsCount });
          }
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      fs.appendFileSync(DISCOVER_LOG, `  Ошибка поиска "${query}": ${e.message}\n`);
    }
  }

  fs.appendFileSync(DISCOVER_LOG, `Найдено новых групп: ${newGroups.length}\n`);

  // Ищем лидов в новых группах
  for (const grp of newGroups.slice(0, 5)) {
    try {
      const entity = await client.getEntity(grp.username);
      const leads = await searchInGroup(client, entity, grp.username, cycleArg);
      allLeads.push(...leads);
      fs.appendFileSync(DISCOVER_LOG, `  @${grp.username} (${grp.members}): ${leads.length} лидов\n`);
    } catch (e) {
      fs.appendFileSync(DISCOVER_LOG, `  Ошибка в @${grp.username}: ${e.message}\n`);
    }
  }

  // Обрабатываем лидов
  const sent10 = [];
  const queue78 = [];

  for (const lead of allLeads.sort((a, b) => b.score - a.score)) {
    if (lead.score >= 9) {
      // Пишем сразу
      const template = lead.text.toLowerCase().includes("wolt") || lead.text.toLowerCase().includes("bolt") || lead.text.toLowerCase().includes("glovo")
        ? `Добрый день! Увидел Ваш вопрос насчёт доставки. Помогаю заведениям подключиться к Wolt, Bolt Food и Glovo и увеличить заказы. Если интересно - расскажу подробнее.`
        : `Добрый день! Увидел Ваш вопрос насчёт разработки. Занимаюсь сайтами, Telegram-ботами и AI-автоматизацией. Если интересно - готов обсудить Вашу задачу.`;
      try {
        await client.sendMessage(new Api.PeerUser({ userId: BigInt(lead.userId) }), { message: template });
        sent10.push(lead);
        addToSentLog(lead.username);
        await new Promise(r => setTimeout(r, 2000));
      } catch {}
    } else {
      queue78.push(lead);
    }
  }

  await client.disconnect();

  // Отчёт только если есть что-то интересное
  if (newGroups.length > 0 || allLeads.length > 0) {
    let report = `🌐 <b>Разведка (цикл ${cycleArg})</b>\n\n`;
    if (newGroups.length > 0) {
      report += `📡 Новых групп найдено: ${newGroups.length}\n`;
      for (const g of newGroups.slice(0, 5)) {
        report += `@${g.username} — ${g.members} чел.\n`;
      }
      report += `\n`;
    }
    if (sent10.length > 0) {
      report += `🟢 <b>Написал сразу (9+/10):</b>\n`;
      for (const l of sent10) {
        report += `@${l.username} (${l.score}/10) — @${l.group}\n`;
      }
      report += `\n`;
    }
    if (queue78.length > 0) {
      report += `🟡 Лиды для тебя: ${queue78.length}\n`;
      for (const l of queue78.slice(0, 3)) {
        report += `@${l.username} — ${l.score}/10 — @${l.group}\n`;
        report += `<i>${l.text.slice(0, 80).replace(/\n/g, " ")}</i>\n`;
      }
    }
    await sendToBot(report);
  }

  fs.appendFileSync(DISCOVER_LOG, `[${new Date().toISOString()}] Цикл ${cycleArg} завершён. Групп: ${newGroups.length}, Лидов: ${allLeads.length}, Написано: ${sent10.length}\n`);
}

main().catch(e => {
  fs.appendFileSync(DISCOVER_LOG, `FATAL: ${e.message}\n`);
  process.exit(1);
});
