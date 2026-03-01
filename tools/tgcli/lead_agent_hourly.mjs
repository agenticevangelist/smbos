/**
 * Lead Hunter Agent — 12-hour autonomous search (v4)
 * Uses getDialogs to avoid contacts.ResolveUsername flood wait
 * Only contacts BUYERS (not sellers)
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const STATE_FILE = "/tmp/lead_agent_state.json";
const BOT_TOKEN = "8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw";
const DAVID_CHAT_ID = "7981171680";

const ALREADY_SENT = ["@rafael99m", "@mary_gvalia", "@NiSuVi", "@zhannafokk", "@topersmm1"];

// Target group usernames to search (without @)
const TARGET_GROUP_USERNAMES = [
  "BiznesKontakti", "biznes_chat", "biznes_club_russia", "restoran_topchat",
  "restodays", "predprinimateli_rf2", "BussinesChat_INF", "chat_biznes1",
  "WOLTGLOVOPOLAND", "bizekb", "predprinimateli_chat", "ip_predprinimateli_biznes",
  "chatb2bnews", "fitnesskuhnya_chat", "podslushka_kur_chat", "predprinimateli_chat1",
  "kurier_poland", "kurierwroclaw", "edasakhalinru_chat", "Frilans_Birzha",
  "chat_deliverymarketing", "restoratory_chat", "tilda_zakazy_chat", "glovo_krakow_pl",
  "Biznes_predprinimateli", "restorant_cafe_obchepit", "stoloffkadostavkaminusinsk",
  "HoReCa29", "Shaman51beer", "uberlyfttaxicusau4011", "ariototulobl",
];

// Keywords that BUYERS use
const DEV_BUYER_KEYWORDS = [
  "нужен разработчик","ищу разработчика","нужен программист",
  "ищу программиста","нужна разработка","нужен telegram бот",
  "нужен телеграм бот","нужен чат-бот","нужен бот для",
  "ищу кто сделает","кто может сделать сайт","кто занимается разработкой",
  "ищу исполнителя","нужен подрядчик","ищу фрилансера",
  "хочу заказать сайт","хочу заказать бота","нужна автоматизация бизнеса",
  "хочу автоматизировать","посоветуйте разработчика","где найти разработчика",
  "где найти программиста","нужна crm система","нужна интеграция",
  "кто делает боты","порекомендуйте разработчика","нужна помощь с сайтом",
  "нужен специалист по","нужно мобильное приложение",
];

const DELIVERY_BUYER_KEYWORDS = [
  "хочу подключить wolt","хочу зайти на wolt","как подключиться к wolt",
  "хочу подключить glovo","как зарегистрироваться в wolt",
  "хочу работать с bolt","как подключить ресторан",
  "упал рейтинг на wolt","падает рейтинг в glovo","потеряли позиции",
  "нет заказов на wolt","нет заказов в glovo","мало заказов с доставки",
  "как поднять рейтинг в wolt","как увеличить продажи через wolt",
  "кто работает с агрегаторами","нужен специалист по wolt",
  "нужна помощь с wolt","нужна помощь с glovo","проблема с wolt",
  "проблема с glovo","помогите разобраться с wolt",
  "нужен аудит меню","хочу работать с доставкой",
];

// Signs of seller/offerer — EXCLUDE
const SELLER_SIGNS = [
  "#помогу","#услуги","#предлагаю","#оказываю",
  "предлагаю свои услуги","я веб-дизайнер","я разработчик",
  "я программист","я фрилансер","создаю сайты","делаю сайты",
  "разрабатываю сайты","помогаю с сайт","моё портфолио",
  "мои работы:","портфолио:","кейсы:","ищу клиентов",
  "ищу проект","ищу заказы","ищу заказчика","готов взяться",
  "готова взяться","возьмусь за ваш проект","#вакансия",
  "ищу сотрудника","ищу менеджера","ищу новичка",
  "приглашаю в команду","набираю команду","приглашаю на обучение",
  "обращайтесь ко мне","пишите мне","пишите в лс",
  "мои услуги","стоимость услуг","прайс",
  "я создатель чат-ботов","я создаю","делаю на заказ",
  "ищу лид-менеджера","за процентный оклад",
  "ищем разработчиков","ищем фрилансеров",
];

const delay = ms => new Promise(r => setTimeout(r, ms));

async function notifyDavid(text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: DAVID_CHAT_ID, text, parse_mode: "HTML" }),
    });
    const d = await r.json();
    if (!d.ok) console.error("Bot error:", JSON.stringify(d));
  } catch(e) {
    console.error("notifyDavid error:", e.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch(e) {}
  return {
    session_start: new Date().toISOString(),
    hour: 0,
    groups_searched: [],
    leads_found: [],
    leads_sent: [],
    total_sent: 0,
    total_found: 0,
    usernames_contacted: [...ALREADY_SENT],
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isSeller(text) {
  const t = text.toLowerCase();
  for (const sign of SELLER_SIGNS) {
    if (t.includes(sign.toLowerCase())) return true;
  }
  return false;
}

function scoreLead(text, category) {
  if (isSeller(text)) return 0;

  const t = text.toLowerCase();
  let score = 5;

  if (category === "dev") {
    if (t.match(/нужен (разработчик|программист|фрилансер)|ищу (разработчика|программиста|фрилансера)/)) score = 7;
    else if (t.match(/нужен (сайт|бот|лендинг)|хочу (заказать|сделать)|ищу (исполнителя|подрядчика)/)) score = 7;
    else if (t.match(/где найти (разработчика|программиста)|посоветуйте|кто может сделать/)) score = 7;
    else if (t.match(/нужна автоматизация|хочу автоматизировать|нужен ai|нужна crm/)) score = 7;
    else score = 6;

    if (t.match(/бюджет|готов (заплатить|платить)|цена|стоимость|тысяч|тыс\.|₽|\$|€/)) score += 2;
    if (t.match(/срочно|сегодня|завтра|до конца|asap/)) score += 1;
    if (t.includes("?")) score = Math.max(score, 7);
  } else {
    if (t.match(/хочу (подключить|зайти|работать|зарегистрировать)/)) score = 7;
    else if (t.match(/упал рейтинг|падает рейтинг|нет заказов|мало заказов/)) score = 8;
    else if (t.match(/проблема с (wolt|glovo|bolt)|как (подключить|поднять|улучшить)/)) score = 7;
    else if (t.match(/нужен специалист|нужна помощь|кто работает с агрегатор/)) score = 7;
    else score = 6;

    if (t.includes("?")) score = Math.max(score, 7);
    if (t.match(/ресторан|кафе|заведение|общепит/)) score += 1;
  }

  return Math.min(score, 10);
}

function getMessageDev(text) {
  const t = text.toLowerCase();
  let topic = "разработки";
  if (t.includes("сайт")) topic = "создания сайта";
  else if (t.includes("лендинг")) topic = "лендинга";
  else if (t.includes("бот")) topic = "Telegram-бота";
  else if (t.includes("автоматизац") || t.includes("ai")) topic = "AI-автоматизации";
  else if (t.includes("crm")) topic = "CRM-системы";
  else if (t.includes("приложение")) topic = "мобильного приложения";

  return `Добрый день! Увидел Ваш вопрос насчёт ${topic}. Я занимаюсь разработкой сайтов, Telegram-ботов и AI-автоматизацией, помог уже десяткам проектов.\n\nЕсли интересно обсудить, напишите, расскажу подробнее и назову стоимость под Вашу задачу.`;
}

function getMessageDelivery(text) {
  const t = text.toLowerCase();
  let topic = "агрегаторов доставки";
  if (t.includes("wolt")) topic = "Wolt";
  else if (t.includes("glovo")) topic = "Glovo";
  else if (t.includes("bolt")) topic = "Bolt Food";

  return `Добрый день! Вижу, Вы интересуетесь ${topic}. Помогаю заведениям работать с Wolt, Bolt Food и Glovo, подключение, оптимизация рейтинга, увеличение заказов.\n\nЕсли интересно, готов рассказать, как это работает и что это даёт на практике.`;
}

async function runHourlyCycle() {
  const state = loadState();
  state.hour += 1;
  const hourNum = state.hour;

  console.error(`\n=== HOUR ${hourNum}/12 START ===`);

  const client = new TelegramClient(
    new StringSession(sessionStr),
    parseInt(process.env.TELEGRAM_API_ID || "33887530"),
    process.env.TELEGRAM_API_HASH || "fc51f19b4b6ff9f0b8cbd5c4005e9ee4",
    { connectionRetries: 5 }
  );
  await client.connect();

  // Load all dialogs upfront — avoids contacts.ResolveUsername flood
  console.error("Loading dialogs...");
  let allDialogs = [];
  try {
    allDialogs = await client.getDialogs({ limit: 500 });
    console.error(`Loaded ${allDialogs.length} dialogs`);
  } catch(e) {
    console.error(`Failed to load dialogs: ${e.message}`);
  }

  // Build a map: lowercased username -> entity
  const dialogMap = new Map();
  for (const d of allDialogs) {
    if (d.entity?.username) {
      dialogMap.set(d.entity.username.toLowerCase(), d.entity);
    }
    if (d.entity?.id) {
      dialogMap.set(d.entity.id?.toString(), d.entity);
    }
  }

  // Pick groups for this hour
  const searched = new Set(state.groups_searched);
  const available = TARGET_GROUP_USERNAMES.filter(g => !searched.has(g));

  let groupsThisHour;
  if (available.length < 3) {
    console.error("Resetting rotation...");
    state.groups_searched = [];
    groupsThisHour = TARGET_GROUP_USERNAMES.slice(0, 4);
  } else {
    groupsThisHour = available.slice(0, 4);
  }

  console.error(`Groups: ${groupsThisHour.join(", ")}`);

  const allLeads = [];
  const threeMonthsAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;

  for (const groupUsername of groupsThisHour) {
    console.error(`Searching @${groupUsername}...`);

    // Use dialog map first, then fallback to getEntity
    let entity = dialogMap.get(groupUsername.toLowerCase());
    if (!entity) {
      // Try to join or access the group
      try {
        entity = await client.getEntity(groupUsername);
        await delay(1000);
      } catch(e) {
        if (e.message?.includes("wait")) {
          console.error(`  Flood wait for ${groupUsername}, skipping`);
          state.groups_searched.push(groupUsername); // mark as done to skip
          await delay(2000);
          continue;
        }
        console.error(`  Cannot resolve ${groupUsername}: ${e.message}`);
        state.groups_searched.push(groupUsername);
        continue;
      }
    }

    const seenInGroup = new Set();
    const allKw = [
      ...DEV_BUYER_KEYWORDS.map(k => ({ kw: k, cat: "dev" })),
      ...DELIVERY_BUYER_KEYWORDS.map(k => ({ kw: k, cat: "delivery" })),
    ];

    for (const { kw, cat } of allKw) {
      try {
        const messages = await client.getMessages(entity, {
          search: kw,
          limit: 15,
        });

        for (const msg of messages) {
          if (!msg.message || msg.date < threeMonthsAgo || msg.post || !msg.senderId) continue;

          let senderUsername = null;
          try {
            const sender = await msg.getSender();
            if (sender?.username) senderUsername = "@" + sender.username;
          } catch(e) {}

          if (!senderUsername) continue;
          if (state.usernames_contacted.includes(senderUsername)) continue;
          if (seenInGroup.has(senderUsername)) continue;
          if (allLeads.find(r => r.username === senderUsername)) continue;

          const score = scoreLead(msg.message, cat);
          if (score >= 7) {
            seenInGroup.add(senderUsername);
            allLeads.push({
              username: senderUsername,
              text: msg.message.slice(0, 300),
              group: "@" + groupUsername,
              category: cat,
              score,
              date: new Date(msg.date * 1000).toISOString(),
              keyword: kw,
            });
          }
        }
        await delay(400);
      } catch(e) {
        if (e.message?.includes("FLOOD_WAIT") || e.message?.includes("flood")) {
          console.error(`  Flood wait, pausing...`);
          await delay(10000);
          break;
        }
      }
    }

    state.groups_searched.push(groupUsername);
    console.error(`  → ${allLeads.length} leads total so far`);
    await delay(2000);
  }

  // Sort by score
  allLeads.sort((a, b) => b.score - a.score);

  // Dedup
  const seen = new Set();
  const uniqueLeads = allLeads.filter(l => {
    if (seen.has(l.username)) return false;
    seen.add(l.username);
    return true;
  });

  // Update state
  for (const lead of uniqueLeads) {
    if (!state.leads_found.find(l => l.username === lead.username)) {
      state.leads_found.push(lead);
      state.total_found++;
    }
  }

  // Contact leads score >= 8
  const contactLeads = uniqueLeads.filter(l => l.score >= 8);
  const warmLeads = uniqueLeads.filter(l => l.score === 7);
  const sentThisHour = [];

  for (const lead of contactLeads.slice(0, 3)) {
    if (state.usernames_contacted.includes(lead.username)) continue;

    const message = lead.category === "dev"
      ? getMessageDev(lead.text)
      : getMessageDelivery(lead.text);

    console.error(`Sending to ${lead.username} (${lead.score}/10)...`);
    try {
      // Try from dialogMap first
      let recipientEntity = null;
      try {
        recipientEntity = await client.getEntity(lead.username);
      } catch(e) {
        console.error(`  Cannot get entity for ${lead.username}: ${e.message}`);
        continue;
      }

      await delay(1500);
      await client.sendMessage(recipientEntity, { message });

      state.usernames_contacted.push(lead.username);
      state.leads_sent.push({ ...lead, sent_at: new Date().toISOString() });
      state.total_sent++;
      sentThisHour.push(lead);
      console.error(`✅ Sent to ${lead.username}`);
      await delay(4000);
    } catch(e) {
      console.error(`❌ Send failed for ${lead.username}: ${e.message}`);
    }
  }

  await client.disconnect();

  // Report
  const groupsStr = groupsThisHour.map(g => "@" + g).join(", ");
  let report = `🔍 Отчёт за час ${hourNum}/12\n\n`;
  report += `Просмотрено групп: ${groupsThisHour.length}\n`;
  report += `(${groupsStr})\n`;
  report += `Найдено лидов (покупатели): ${uniqueLeads.length}\n\n`;

  if (sentThisHour.length > 0) {
    report += `🟢 Написал сразу (8-10/10):\n`;
    for (const l of sentThisHour) {
      const shortText = l.text.slice(0, 80).replace(/\n/g, " ");
      report += `- ${l.username} (${l.score}/10) - "${shortText}..." - ${l.group}\n`;
    }
    report += "\n";
  } else {
    report += `🟢 Горячих лидов нет в этом часе\n\n`;
  }

  if (warmLeads.length > 0) {
    report += `🟡 Тёплые (7/10):\n`;
    for (const l of warmLeads.slice(0, 5)) {
      const shortText = l.text.slice(0, 80).replace(/\n/g, " ");
      report += `- ${l.username} - "${shortText}..." (${l.group})\n`;
    }
    report += "\n";
  }

  report += `📊 Итого за сессию: ${state.total_sent} отправлено\n`;
  report += `💤 Следующая проверка через 1 час`;

  await notifyDavid(report);
  saveState(state);

  console.error(`\n=== HOUR ${hourNum}/12 DONE: sent ${sentThisHour.length}, warm ${warmLeads.length} ===`);
  return state;
}

// === MAIN ===
try {
  const state = await runHourlyCycle();

  if (state.hour >= 12) {
    const allWarm = state.leads_found.filter(l =>
      l.score >= 7 && !state.leads_sent.find(s => s.username === l.username)
    );
    let finalReport = `✅ ИТОГОВЫЙ ОТЧЁТ (12 часов)\n\n`;
    finalReport += `Просмотрено групп: ${new Set(state.groups_searched).size}\n`;
    finalReport += `Всего лидов найдено: ${state.total_found}\n`;
    finalReport += `Сообщений отправлено: ${state.total_sent}\n\n`;

    if (state.leads_sent.length > 0) {
      finalReport += `Отправлено:\n`;
      for (const l of state.leads_sent) {
        finalReport += `- ${l.username} - ${l.score}/10 - ${l.group}\n`;
      }
      finalReport += "\n";
    }

    if (allWarm.length > 0) {
      finalReport += `Топ лиды для ручного следапа:\n`;
      for (const l of allWarm.slice(0, 10)) {
        finalReport += `- ${l.username} - "${l.text.slice(0, 80).replace(/\n/g, " ")}..." - ${l.score}/10\n`;
      }
    }

    finalReport += `\nРекомендации:\n- Расширить список доставочных групп\n- Добавить поиск через globalSearch`;
    await notifyDavid(finalReport);
  }

  process.exit(0);
} catch(e) {
  console.error("Fatal error:", e.message, e.stack);
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: DAVID_CHAT_ID, text: `❌ Критическая ошибка: ${e.message}` }),
    });
  } catch(e2) {}
  process.exit(1);
}
