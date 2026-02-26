/**
 * continuous_search.mjs v3 — нишевые группы, меньше спама
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
const DAVID_ID  = "7981171680";
const SENT_FILE  = "/tmp/cs_sent.json";
const SEEN_FILE  = "/tmp/cs_seen.json";
const STATE_FILE = "/tmp/cs_state.json";
const GROUPS_FILE = "/tmp/cs_groups_v3.json";
const COOLDOWN_FILE = "/tmp/cs_cooldown.json";
const LOG_FILE   = "/tmp/cs.log";

// ─── sent/seen ────────────────────────────────────────────────────────────────
const BOOTSTRAP_SENT = ["rafael99m","mary_gvalia","NiSuVi","zhannafokk","topersmm1","bestmanagern1"];
function loadSent() { try { return JSON.parse(fs.readFileSync(SENT_FILE,"utf8")); } catch {} return [...BOOTSTRAP_SENT]; }
function markSent(u) { const a=loadSent(); if(!a.includes(u)){a.push(u);fs.writeFileSync(SENT_FILE,JSON.stringify(a,null,2));} }
function alreadySent(u) { return loadSent().includes(u); }

let _seen = null;
function getSeen() { if(!_seen){try{_seen=new Set(JSON.parse(fs.readFileSync(SEEN_FILE,"utf8")));}catch{_seen=new Set(BOOTSTRAP_SENT);}} return _seen; }
function markSeen(u) { getSeen().add(u); fs.writeFileSync(SEEN_FILE,JSON.stringify([...getSeen()],null,2)); }
function alreadySeen(u) { return getSeen().has(u) || alreadySent(u); }

// ─── кулдаун групп ────────────────────────────────────────────────────────────
function loadCooldowns() { try { return JSON.parse(fs.readFileSync(COOLDOWN_FILE,"utf8")); } catch {} return {}; }
function saveCooldowns(c) { fs.writeFileSync(COOLDOWN_FILE,JSON.stringify(c,null,2)); }
const COOLDOWN_MS = 45 * 60 * 1000; // 45 минут
function canSearch(u) { const cd=loadCooldowns(); return Date.now()-(cd[u]||0) >= COOLDOWN_MS; }
function touchGroup(u) { const cd=loadCooldowns(); cd[u]=Date.now(); saveCooldowns(cd); }

// ─── состояние ────────────────────────────────────────────────────────────────
function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE,"utf8")); } catch {} return {found:0,sent:0,cycles:0,start:Date.now(),lastReport:0,lastDiscover:0}; }
function saveState(s) { fs.writeFileSync(STATE_FILE,JSON.stringify(s,null,2)); }

// ─── стартовые нишевые группы ─────────────────────────────────────────────────
function loadGroups() {
  try { return JSON.parse(fs.readFileSync(GROUPS_FILE,"utf8")); } catch {}
  return [
    // === РЕСТОРАНЫ / ДОСТАВКА === (владельцы, не работники)
    {u:"restoran_topchat",    cat:"delivery", priority:1},
    {u:"restodays",           cat:"delivery", priority:1},
    {u:"chat_deliverymarketing",cat:"delivery",priority:1},
    {u:"restoratory_chat",    cat:"delivery", priority:1},
    {u:"restorant_cafe_obchepit",cat:"delivery",priority:1},
    {u:"RABOTATs_v_HORECA",   cat:"delivery", priority:1},
    {u:"edasakhalinru_chat",  cat:"delivery", priority:2},
    {u:"WOLTGLOVOPOLAND",     cat:"delivery", priority:2},
    // === ВАКАНСИИ (компании ищут разработчиков = потенциальный аутсорс) ===
    {u:"jobospherechat",      cat:"dev", priority:1},   // 44k вакансии
    {u:"workk_onchat",        cat:"dev", priority:1},   // 38k работа
    {u:"proffreelancee_chat", cat:"dev", priority:1},   // 41k фриланс
    // === IT / СТАРТАПЫ (основатели ищут разработчиков) ===
    {u:"ipgeorgiachat",       cat:"dev", priority:1},   // Грузия!
    {u:"tilda_zakazy_chat",   cat:"dev", priority:1},   // заказывают на Tilda
    {u:"Frilans_Birzha",      cat:"dev", priority:1},
    {u:"frilancru",           cat:"dev", priority:1},
    {u:"chatb2bnews",         cat:"dev", priority:2},
    // === ТОРГОВЛЯ / E-COMMERCE ===
    {u:"bizekb",              cat:"dev", priority:2},
    {u:"chat_biznes1",        cat:"dev", priority:2},
  ];
}
function saveGroups(g) { fs.writeFileSync(GROUPS_FILE,JSON.stringify(g,null,2)); }

// ─── запросы для поиска новых НИШЕВЫХ групп ───────────────────────────────────
const DISCOVER_QUERIES = [
  // рестораны и кафе (владельцы)
  "рестораторы чат","кафе владельцы","ресторан открытие","общепит бизнес",
  "horeca чат","фудкорт","ресторанный бизнес","кейтеринг",
  // доставка
  "служба доставки чат","доставка еды бизнес","dark kitchen",
  "облачная кухня","фуд-корт",
  // e-commerce / интернет-магазины
  "интернет-магазин владельцы","e-commerce чат","онлайн продажи",
  "маркетплейс продавцы","wb продавцы","wildberries продавцы","ozon продавцы",
  // стартапы и продукты
  "стартап основатели","продуктовые команды","saas основатели",
  "it стартап","продукт менеджеры",
  // услуги (потенциально ищут автоматизацию)
  "салон красоты бизнес","медицина бизнес","фитнес владельцы",
  "стоматология бизнес","клиника автоматизация",
  // грузия конкретно
  "грузия предприниматели","тбилиси бизнес","georgia startup",
  "бизнес грузия чат","relocate georgia business",
  // автоматизация (прямые покупатели)
  "crm бизнес чат","автоматизация бизнеса чат","no-code чат",
  "чат-бот для бизнеса","ai для бизнеса",
  // вакансии IT (компании ищут разработчиков)
  "вакансии it грузия","it работа тбилиси","вакансии разработчик",
  "вакансии python","вакансии telegram бот","remote работа it",
  "it вакансии georgia","jobs georgia it","работа тбилиси it",
];

// ─── ключевые слова — ПОКУПАТЕЛЬСКИЕ сигналы ─────────────────────────────────
// Не "нужен разработчик" (так пишут и сами разработчики), а конкретные проблемы
const KW = {
  delivery: [
    // прямые сигналы
    "wolt","bolt food","glovo","яндекс еда",
    "хочу подключить","как подключиться","как зарегистрироваться",
    "открываю ресторан","открыл кафе","открываю кафе",
    "рейтинг упал","мало заказов","как поднять заказы",
    "помогите с доставкой","меню для агрегатора",
    // проблемы ресторанов
    "нет заказов","мало клиентов","как продвинуть",
    "фото блюд","описание меню",
  ],
  dev: [
    // покупатели описывают ЗАДАЧУ
    "нужен бот","нужен сайт","нужен лендинг","нужно приложение",
    "нужна crm","нужна автоматизация","нужна интеграция",
    "ищу разработчика","ищу программиста","ищу подрядчика",
    "посоветуйте разработчика","кто делает боты",
    "заказать сайт","заказать бота","как автоматизировать",
    // вакансии (аутсорс вместо найма)
    "вакансия разработчик","вакансия программист","ищем разработчика",
    "вакансия python","вакансия fullstack","вакансия бот",
    "требуется разработчик","ищем программиста",
    // салоны красоты (запись, CRM, боты)
    "онлайн запись","бот для записи","автоматизация записи",
    "crm для салона","программа для салона","нужен бот записи",
    "как автоматизировать запись","рассылка клиентам",
    // WB/Ozon (боты, автоматизация, сайты)
    "нужен бот для wb","автоматизация wildberries","парсер ozon",
    "нужен сайт магазин","нужна crm для магазина",
    "как автоматизировать ozon","бот для маркетплейса",
  ],
};

// ─── оценка ──────────────────────────────────────────────────────────────────
function scoreMsg(text, cat) {
  const t = text.toLowerCase();
  let s = 0;

  // Негативные сигналы — скорее всего это продавец, не покупатель
  if (/предлагаю|помогу|делаю сайты|занимаюсь разработкой|мои услуги|портфолио|кейсы|#помогу|оказываю услуги|разработчик с опытом/.test(t)) return 0;
  if (/ищу работу|ищу заказы|ищу клиентов|@skach|ищу проект/.test(t)) return 0;

  // Вакансии — компания ищет разработчика (хороший лид для аутсорса)
  if (/вакансия.{0,30}(разработчик|программист|python|fullstack|backend|frontend|бот|it|автоматизация)|ищем.{0,20}(разработчика|программиста)|требуется.{0,20}(разработчик|программист)/.test(t)) return 8;

  if (cat === "delivery" || cat === "any") {
    if (/wolt|bolt food|glovo|яндекс еда/.test(t)) s += 3;
    if (/хочу подключить|как подключиться|как попасть|хочу зарегистр/.test(t)) s += 4;
    if (/открываю|открыл|открыла|новый ресторан|новое кафе/.test(t)) s += 3;
    if (/рейтинг упал|мало заказов|нет заказов|как поднять/.test(t)) s += 4;
    if (/помогите|подскажите|посоветуйте/.test(t)) s += 2;
    if (/ресторан|кафе|доставка|кухня/.test(t)) s += 1;
    if (/бюджет|стоимость|сколько стоит/.test(t)) s += 2;
  }
  if (cat === "dev" || cat === "any") {
    if (/нужен бот|нужен сайт|нужен лендинг|нужно приложение|нужна crm|нужна автоматизация/.test(t)) s += 5;
    if (/ищу разработчика|ищу программиста|ищу подрядчика|посоветуйте разработчика/.test(t)) s += 5;
    if (/как сделать бот|кто делает боты|заказать бота|заказать сайт/.test(t)) s += 4;
    if (/помогите с сайтом|автоматизировать/.test(t)) s += 3;
    if (/бюджет|стоимость|сколько стоит|цена/.test(t)) s += 2;
    if (/срочно|asap|сегодня|быстро/.test(t)) s += 1;
  }
  return Math.min(s, 10);
}

function msgText(cat, hint) {
  const t = (hint||"").toLowerCase();
  const isDelivery = cat==="delivery" || /wolt|bolt|glovo|доставка|ресторан|кафе/.test(t);
  const isVacancy = /вакансия|ищем разработчика|требуется разработчик|нанимаем/.test(t);

  if (isVacancy) {
    return `Добрый день! Увидел вакансию разработчика. Если рассматриваете аутсорс или проектную работу - могу взяться. Full-stack разработчик, Python/FastAPI/Vue/React, Telegram-боты, AI-автоматизация. Быстрее и дешевле штатного сотрудника. Если интересно - напишите, обсудим задачу.`;
  }
  if (isDelivery) {
    return `Добрый день! Увидел Ваш вопрос насчёт доставки. Помогаю ресторанам и кафе подключиться к Wolt, Bolt Food и Glovo, повысить рейтинг и увеличить заказы. Если интересно - расскажу подробнее.`;
  }
  return `Добрый день! Увидел Ваш вопрос. Занимаюсь разработкой сайтов, Telegram-ботов и AI-автоматизацией для бизнеса. Если интересно - готов обсудить задачу и назвать стоимость.`;
}

// ─── утилиты ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
function log(msg) { const l=`[${new Date().toISOString()}] ${msg}`; console.error(l); fs.appendFileSync(LOG_FILE,l+"\n"); }
function tg(text) {
  const body = JSON.stringify({chat_id:DAVID_ID,text,parse_mode:"HTML"});
  return new Promise((ok,err)=>{
    const r=https.request({hostname:"api.telegram.org",path:`/bot${BOT_TOKEN}/sendMessage`,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>ok(d));});
    r.on("error",err); r.write(body); r.end();
  }).catch(()=>{});
}

// ─── поиск в группе ──────────────────────────────────────────────────────────
async function searchGroup(client, grp) {
  const leads = [];
  const kws = KW[grp.cat] || KW.dev;
  const sinceTs = Math.floor(Date.now()/1000) - 14*24*3600; // 14 дней

  let entity;
  try { entity = await client.getEntity(grp.u); }
  catch(e) {
    if (e.message?.includes("FLOOD_WAIT")) {
      const w = parseInt(e.message.match(/\d+/)?.[0]||"60");
      const cd=loadCooldowns(); cd[grp.u]=Date.now()+w*1000; saveCooldowns(cd);
    }
    log(`skip @${grp.u}: ${e.message.slice(0,60)}`);
    return leads;
  }

  for (const kw of kws) {
    try {
      const res = await client.invoke(new Api.messages.Search({
        peer:entity, q:kw,
        filter:new Api.InputMessagesFilterEmpty(),
        minDate:sinceTs, maxDate:Math.floor(Date.now()/1000),
        limit:30, offsetId:0, addOffset:0, maxId:0, minId:0, hash:BigInt(0),
      }));
      for (const msg of (res.messages||[])) {
        if (!msg.fromId?.userId || !msg.message) continue;
        const uid = msg.fromId.userId.toString();
        let username=null;
        try { const u=await client.getEntity(new Api.PeerUser({userId:BigInt(uid)})); username=u?.username; } catch {}
        if (!username || alreadySeen(username)) continue;

        const s = scoreMsg(msg.message, grp.cat);
        if (s < 5) continue;

        markSeen(username);
        leads.push({username, uid, text:msg.message.slice(0,200), score:s, cat:grp.cat, group:grp.u, date:new Date(msg.date*1000).toLocaleDateString("ru-RU")});
      }
      await sleep(400);
    } catch(e) {
      if (e.message?.includes("FLOOD_WAIT")) {
        const w=parseInt(e.message.match(/\d+/)?.[0]||"10");
        await sleep(Math.min(w*1000,30000));
      }
    }
  }
  return leads;
}

// ─── поиск новых нишевых групп ────────────────────────────────────────────────
async function discoverNiche(client, existingSet, queryIdx) {
  const found=[];
  const queries=DISCOVER_QUERIES.slice(queryIdx%DISCOVER_QUERIES.length, queryIdx%DISCOVER_QUERIES.length+3);
  for (const q of queries) {
    try {
      const res=await client.invoke(new Api.contacts.Search({q,limit:15}));
      for (const chat of (res.chats||[])) {
        if (!chat.username || existingSet.has(chat.username.toLowerCase())) continue;
        if (chat.participantsCount<150) continue;
        // Фильтруем — только тематические (не общие "бизнес" группы)
        const title=(chat.title||"").toLowerCase();
        const uname=chat.username.toLowerCase();
        const isSpammy = /biznes_chat|predprinimateli|бизнес чат|business_chat|club_russia/i.test(title+uname);
        if (isSpammy) continue;
        const cat = /ресторан|кафе|доставка|wolt|bolt|glovo|food|horeca|общепит|кухня/i.test(title+uname) ? "delivery" : "dev";
        found.push({u:chat.username, cat, priority:2, members:chat.participantsCount, title:chat.title||""});
      }
      await sleep(800);
    } catch {}
  }
  return found;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log("=== Агент v3 (нишевые группы) запущен ===");

  const client = new TelegramClient(
    new StringSession(sessionStr),
    parseInt(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    {connectionRetries:5}
  );
  await client.connect();
  log("Подключён к Telegram");

  await tg(`🔍 <b>Агент v3 запущен!</b>

Теперь ищу только в нишевых группах — рестораторы, e-commerce, стартапы.
Спам-группы исключены.
Жду реальных покупателей 💪`);

  let groups = loadGroups();
  saveGroups(groups);

  const state = loadState();
  state.start = Date.now();
  state.lastReport = Date.now();
  state.lastDiscover = 0;

  let idx = 0;
  let discoverIdx = 0;
  let cycleLeads = [];
  let newGroupsTotal = 0;

  const REPORT_INTERVAL  = 30*60*1000;
  const DISCOVER_INTERVAL = 20*60*1000;

  while (true) {
    // Поиск новых нишевых групп каждые 20 мин
    if (Date.now()-state.lastDiscover >= DISCOVER_INTERVAL) {
      const existing=new Set(groups.map(g=>g.u.toLowerCase()));
      const found=await discoverNiche(client, existing, discoverIdx);
      if (found.length>0) {
        groups.push(...found);
        saveGroups(groups);
        newGroupsTotal+=found.length;
        log(`[DISCOVER] +${found.length} нишевых групп. Всего: ${groups.length}`);
        const names=found.slice(0,4).map(g=>`@${g.u} (${g.members})`).join("\n");
        await tg(`📡 <b>Новые нишевые группы: +${found.length}</b>\n${names}`);
      }
      discoverIdx+=3;
      state.lastDiscover=Date.now();
      saveState(state);
    }

    // Выбираем группу (приоритет = 1 идут чаще)
    const grp = groups[idx % groups.length];
    idx++;

    if (!canSearch(grp.u)) { await sleep(300); continue; }
    touchGroup(grp.u);

    log(`Ищу @${grp.u} [${grp.cat}]`);
    const leads = await searchGroup(client, grp);
    if (leads.length) log(`  ${leads.length} лидов в @${grp.u}`);

    for (const lead of leads.sort((a,b)=>b.score-a.score)) {
      state.found++;

      if (lead.score >= 7) {
        try {
          await client.sendMessage(new Api.PeerUser({userId:BigInt(lead.uid)}), {message:msgText(lead.cat,lead.text)});
          markSent(lead.username);
          state.sent++;
          log(`✅ НАПИСАЛ @${lead.username} (${lead.score}/10) из @${lead.group}`);
          await tg(`🟢 <b>Написал (${lead.score}/10)</b>\n@${lead.username} — @${lead.group}\n<i>${lead.text.slice(0,120).replace(/\n/g," ")}</i>`);
          await sleep(3000);
        } catch(e) {
          log(`❌ @${lead.username}: ${e.message.slice(0,60)}`);
        }
      } else {
        // 5-6/10 — в сводку
        if (!cycleLeads.find(l=>l.username===lead.username)) cycleLeads.push(lead);
      }
    }

    state.cycles++;
    saveState(state);

    // Сводка каждые 30 мин
    if (Date.now()-state.lastReport >= REPORT_INTERVAL) {
      const min=Math.round((Date.now()-state.start)/60000);
      let r=`📊 <b>Сводка за ${min} мин (v3)</b>\n\nГрупп: ${groups.length}\nПросмотров: ${state.cycles}\nНайдено: ${state.found}\nНаписано: ${state.sent}\n`;
      if (cycleLeads.length>0) {
        r+=`\n🟡 <b>На твоё усмотрение (5-6/10):</b>\n`;
        for (const l of cycleLeads.slice(0,5)) {
          r+=`@${l.username} — ${l.score}/10 — @${l.group} — ${l.date}\n<i>${l.text.slice(0,80).replace(/\n/g," ")}</i>\n\n`;
        }
        cycleLeads=[];
      } else {
        r+=`\n😴 Пока тишина — ищу дальше`;
      }
      await tg(r);
      state.lastReport=Date.now();
      saveState(state);
    }

    await sleep(1500);
  }
}

main().catch(async e => {
  log(`FATAL: ${e.stack||e.message}`);
  await tg(`❌ <b>Агент упал!</b> ${e.message}`).catch(()=>{});
  process.exit(1);
});
