/**
 * night_search.mjs — Автономный ночной поиск лидов
 * Запускается из night_loop.sh каждый час
 * 
 * Аргументы: node night_search.mjs <cycle_number> <hour_offset_days>
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
const STATE_FILE = "/tmp/night_agent_state.json";
const SENT_LOG = "/tmp/night_sent_leads.json";

// Уже отправленные лиды (никогда не писать снова)
const ALREADY_SENT = ["rafael99m", "mary_gvalia", "NiSuVi", "zhannafokk", "topersmm1"];

// Все группы — перетасовываем каждый цикл
const ALL_GROUPS = {
  // Рестораны и доставка (высокий приоритет)
  delivery: [
    "restoran_topchat",
    "restodays",
    "chat_deliverymarketing",
    "restoratory_chat",
    "WOLTGLOVOPOLAND",
    "kurier_poland",
    "kurierwroclaw",
    "edasakhalinru_chat",
    "restorant_cafe_obchepit",
    "HoReCa29",
    "fitnesskuhnya_chat",
  ],
  // Бизнес и предприниматели
  business: [
    "BiznesKontakti",
    "biznes_chat",
    "biznes_club_russia",
    "predprinimateli_rf2",
    "BussinesChat_INF",
    "chat_biznes1",
    "bizekb",
    "predprinimateli_chat",
    "ip_predprinimateli_biznes",
    "chatb2bnews",
    "predprinimateli_chat1",
    "Biznes_predprinimateli",
    "Frilans_Birzha",
  ],
};

// Ключевые слова
const DEV_KEYWORDS = [
  "нужен разработчик",
  "ищу разработчик",
  "нужен сайт",
  "нужен бот",
  "нужна автоматизация",
  "ищу фрилансер",
  "нужен лендинг",
  "телеграм бот",
  "нужен ai",
  "чат-бот",
  "ищу подрядчик",
  "кто сделает",
  "заказать бота",
  "нужен программист",
  "голосовой агент",
  "нейросеть",
  "нужно приложение",
  "мобильное приложение",
];

const DELIVERY_KEYWORDS = [
  "Wolt",
  "Bolt Food",
  "Glovo",
  "яндекс еда",
  "подключить доставку",
  "агрегатор доставки",
  "рейтинг wolt",
  "доставка ресторан",
  "служба доставки",
  "меню доставки",
  "помогите с доставкой",
  "открыть ресторан",
  "кафе доставка",
];

// Отправка через бот
function sendToBot(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: DAVID_CHAT_ID,
      text: text,
      parse_mode: "HTML",
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (d) => data += d);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Загрузка состояния
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {}
  }
  return { cycle: 0, searched: [], sent: [], found_total: 0, sent_total: 0, start_time: Date.now() };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Загрузка уже отправленных
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

// Оценка лида
function rateLead(text, type) {
  const t = text.toLowerCase();
  let score = 0;

  if (type === "dev") {
    if (t.includes("нужен разработчик") || t.includes("ищу разработчик") || t.includes("нужен программист")) score += 5;
    if (t.includes("нужен сайт") || t.includes("сделать сайт") || t.includes("нужен лендинг")) score += 4;
    if (t.includes("нужен бот") || t.includes("телеграм бот") || t.includes("чат-бот")) score += 4;
    if (t.includes("бюджет") || t.includes("цена") || t.includes("стоимость") || t.includes("сколько")) score += 2;
    if (t.includes("срочно") || t.includes("асап") || t.includes("нужно быстро")) score += 2;
    if (t.includes("нужна автоматизация") || t.includes("ai") || t.includes("нейросеть")) score += 3;
    if (t.includes("нужно приложение") || t.includes("мобильное")) score += 4;
  } else {
    if (t.includes("wolt") || t.includes("bolt food") || t.includes("glovo")) score += 4;
    if (t.includes("подключить") || t.includes("зарегистрироваться")) score += 3;
    if (t.includes("рейтинг") || t.includes("оптимизация")) score += 3;
    if (t.includes("ресторан") || t.includes("кафе") || t.includes("доставка")) score += 2;
    if (t.includes("помогите") || t.includes("как") || t.includes("подскажите")) score += 2;
    if (t.includes("открываю") || t.includes("открыл") || t.includes("новый")) score += 2;
  }

  return Math.min(score, 10);
}

// Главная функция
async function main() {
  const cycleArg = parseInt(process.argv[2] || "1");
  const state = loadState();
  state.cycle = cycleArg;

  console.error(`\n🌙 Цикл ${cycleArg} начат`);

  const client = new TelegramClient(
    new StringSession(sessionStr),
    parseInt(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 5 }
  );

  await client.connect();

  const sentLog = loadSentLog();
  const now = Math.floor(Date.now() / 1000);
  const twoDaysAgo = now - 7 * 24 * 60 * 60; // 7 дней для лучшего охвата

  // Выбираем группы для этого цикла (ротация)
  const allDelivery = [...ALL_GROUPS.delivery];
  const allBusiness = [...ALL_GROUPS.business];

  // Каждый цикл берём разные группы
  const offset = (cycleArg - 1) * 3;
  const deliveryGroups = allDelivery.slice(offset % allDelivery.length, (offset % allDelivery.length) + 4);
  const businessGroups = allBusiness.slice(offset % allBusiness.length, (offset % allBusiness.length) + 4);
  const groupsThisCycle = [...deliveryGroups, ...businessGroups];

  const leadsFound = [];
  let groupsSearched = 0;

  // Поиск в группах
  for (const groupName of groupsThisCycle) {
    const isDelivery = ALL_GROUPS.delivery.includes(groupName);
    const keywords = isDelivery ? DELIVERY_KEYWORDS : DEV_KEYWORDS;

    console.error(`\n🔍 @${groupName} (${isDelivery ? "delivery" : "dev"})`);

    let entity;
    try {
      entity = await client.getEntity(groupName);
    } catch (e) {
      console.error(`  ❌ Не удалось получить @${groupName}: ${e.message}`);
      continue;
    }

    groupsSearched++;

    for (const keyword of keywords.slice(0, 5)) { // 5 ключевых слов на группу
      try {
        const messages = await client.invoke(
          new Api.messages.Search({
            peer: entity,
            q: keyword,
            filter: new Api.InputMessagesFilterEmpty(),
            minDate: twoDaysAgo,
            maxDate: now,
            limit: 30,
            offsetId: 0,
            addOffset: 0,
            maxId: 0,
            minId: 0,
            hash: BigInt(0),
          })
        );

        const msgs = messages.messages || [];
        for (const msg of msgs) {
          if (!msg.fromId || !msg.message) continue;
          const userId = msg.fromId.userId?.toString();
          if (!userId) continue;

          // Получаем username
          let username = null;
          try {
            const user = await client.getEntity(new Api.PeerUser({ userId: BigInt(userId) }));
            username = user.username;
          } catch {}

          if (!username) continue;
          if (sentLog.includes(username)) continue;
          if (state.sent?.includes(username)) continue;

          const score = rateLead(msg.message, isDelivery ? "delivery" : "dev");
          if (score < 5) continue;

          // Проверяем дубли
          const already = leadsFound.find(l => l.username === username);
          if (already) {
            already.score = Math.max(already.score, score);
            continue;
          }

          leadsFound.push({
            username,
            userId,
            text: msg.message.slice(0, 200),
            score,
            type: isDelivery ? "delivery" : "dev",
            group: groupName,
            date: new Date(msg.date * 1000).toISOString(),
            entity: entity, // для отправки
          });
        }

        await new Promise(r => setTimeout(r, 500)); // антифлуд
      } catch (e) {
        console.error(`  ⚠️ Поиск "${keyword}" в @${groupName}: ${e.message}`);
      }
    }
  }

  // Сортируем по оценке
  leadsFound.sort((a, b) => b.score - a.score);

  const sent10 = [];
  const queue89 = [];

  // Обрабатываем лидов
  for (const lead of leadsFound) {
    if (lead.score >= 10) {
      // Пишем сразу!
      const template = lead.type === "delivery"
        ? `Добрый день! Увидел Ваш вопрос насчёт доставки. Помогаю заведениям подключиться к Wolt, Bolt Food и Glovo и увеличить заказы. Если интересно - расскажу подробнее.`
        : `Добрый день! Увидел Ваш вопрос насчёт разработки. Я занимаюсь созданием сайтов, Telegram-ботов и AI-автоматизацией. Если интересно - готов обсудить Вашу задачу и назвать стоимость.`;

      try {
        await client.sendMessage(new Api.PeerUser({ userId: BigInt(lead.userId) }), { message: template });
        sent10.push(lead);
        addToSentLog(lead.username);
        if (!state.sent) state.sent = [];
        state.sent.push(lead.username);
        state.sent_total = (state.sent_total || 0) + 1;
        console.error(`  ✅ Написал @${lead.username} (10/10)`);
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error(`  ❌ Не смог написать @${lead.username}: ${e.message}`);
      }
    } else if (lead.score >= 8) {
      queue89.push(lead);
    }
  }

  state.found_total = (state.found_total || 0) + leadsFound.length;
  if (!state.searched) state.searched = [];
  state.searched.push(...groupsThisCycle);
  saveState(state);

  await client.disconnect();

  // Формируем отчёт
  const elapsed = Math.floor((Date.now() - (state.start_time || Date.now())) / 1000 / 60);
  let report = `🔍 <b>Отчёт цикл ${cycleArg}</b>\n\n`;
  report += `Просмотрено групп: ${groupsSearched}\n`;
  report += `Найдено лидов: ${leadsFound.length}\n\n`;

  if (sent10.length > 0) {
    report += `🟢 <b>10/10 — написал сразу:</b>\n`;
    for (const l of sent10) {
      report += `@${l.username} — ${l.text.slice(0, 80).replace(/\n/g, " ")}...\n`;
      report += `<i>Группа: @${l.group}</i>\n\n`;
    }
  }

  if (queue89.length > 0) {
    report += `🟡 <b>8-9/10 — твои лиды:</b>\n`;
    for (const l of queue89.slice(0, 5)) {
      report += `@${l.username} — оценка ${l.score}/10\n`;
      report += `<i>${l.text.slice(0, 100).replace(/\n/g, " ")}</i>\n`;
      report += `<i>Группа: @${l.group}</i>\n\n`;
    }
  }

  if (leadsFound.length === 0) {
    report += `😴 Новых лидов не найдено в этом цикле\n`;
  }

  report += `\n📊 Всего за сессию: найдено ${state.found_total}, отправлено ${state.sent_total || 0}\n`;
  report += `💤 Следующая проверка через 1 час`;

  await sendToBot(report);
  console.log(JSON.stringify({ ok: true, cycle: cycleArg, found: leadsFound.length, sent: sent10.length }));
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  // Сообщаем об ошибке
  const body = JSON.stringify({
    chat_id: DAVID_CHAT_ID,
    text: `⚠️ Ошибка в цикле: ${e.message}`,
  });
  https.request({
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).end(body);
  process.exit(1);
});
