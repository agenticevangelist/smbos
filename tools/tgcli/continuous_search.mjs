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

const BOT_TOKEN  = "8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw";
const DALI_GROUP = "-1003733922250";
const TOPIC_DEV  = 2;
const TOPIC_DELI = 3;
const TOPIC_GEN  = 1;
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
    // === ГРУЗИЯ / МЕЖДУНАРОДНЫЕ ===
    {u:"ipgeorgiachat",       cat:"dev", priority:1},   // IP Georgia
    {u:"tbilisi_startup",     cat:"dev", priority:1},   // стартапы Тбилиси
    {u:"georgia_it",          cat:"dev", priority:1},   // IT в Грузии
    {u:"CommunITy_GE",        cat:"dev", priority:1},   // IT Community Georgia
    {u:"it_chat_ge",          cat:"dev", priority:1},   // IT Chat Georgia
    {u:"jobs_ge",             cat:"dev", priority:1},   // Jobs Georgia
    {u:"ads_ge",              cat:"dev", priority:2},   // Объявления Грузия
    // === СТАРТАПЫ / ОСНОВАТЕЛИ ===
    {u:"thefoundersclub",     cat:"dev", priority:1},   // 50k основателей
    {u:"saas_founders",       cat:"dev", priority:1},   // SaaS founders
    {u:"ProductsAndStartups", cat:"dev", priority:1},   // продукты и стартапы
    // === ФРИЛАНС БИРЖИ ===
    {u:"mindset_jobs",        cat:"dev", priority:1},   // реально дают лиды
    {u:"itmankz",             cat:"dev", priority:1},   // даёт лиды KZ
    {u:"qwork_qwork",         cat:"dev", priority:1},   // 49k фриланс
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
const KW_EN = [
  // English - looking for dev
  "need developer","looking for developer","need a website",
  "need a bot","looking for programmer","hire developer",
  "need automation","looking for freelancer","build a bot",
  "chatbot for business","need mobile app","need web app",
  // English - vacancies
  "hiring developer","hiring programmer","looking for fullstack",
  "we need a developer","seeking developer",
  // English - restaurant/delivery
  "need delivery solution","wolt partner","restaurant software",
  "food delivery app","restaurant management",
];

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
const SKIP_STACK_RE = /\.net|c#|java|kotlin|swift/i;

function scoreMsg(text, cat) {
  const t = text.toLowerCase();

  // Всё что не запрос клиента — выбрасываем
  const IS_OFFER = /предлагаю|помогу|делаю сайты|занимаюсь разработкой|мои услуги|портфолио|кейсы|#помогу|оказываю услуги|разработчик с опытом|ищу работу|ищу заказы|ищу клиентов|ищу проект|ищу инвестора|ищу партнёра|хочу стать|нас зовут|наш (проект|сервис|стартап|продукт)|мы (делаем|разрабатываем|предлагаем)|наша (команда|компания)|меня зовут|я (занимаюсь|делаю|разрабатываю|помогаю)|готов (помочь|взяться)|пишите (мне|в лс)/i;
  if (IS_OFFER.test(t)) return 0;
  if (SKIP_STACK_RE.test(t)) return 0; // Tilda, WordPress, нерелевантный стек

  // DEV: только прямой запрос на покупку/заказ разработки
  const DEV_CLIENT = /нужен (разработчик|программист|telegram.?бот|чат.?бот|сайт|лендинг|crm|автоматизац)|нужна (разработка|crm|интеграция|автоматизац|помощь с сайтом|помощь с ботом)|нужно (разработать|сделать (сайт|бот|crm|приложение)|создать (сайт|бот|crm))|ищу (разработчика|программиста|исполнителя на (сайт|бот|разработку))|ищем (разработчика|программиста)|хочу заказать (сайт|бот|разработку|автоматизацию)|хочу (сделать|создать|разработать) (сайт|бот|telegram.?бот|crm|приложение|лендинг)|хотим (сделать|создать|разработать) (сайт|бот|crm)|кто (делает|создаёт|разрабатывает|может сделать) (telegram.?бот|сайт|crm|бота)|порекомендуйте (разработчика|программиста)|посоветуйте (разработчика|программиста)|где найти (разработчика|программиста)|заказать разработку|нужен бот для|нужен сайт для|помогите (сделать|создать|разработать) (сайт|бот|crm)|ищу кто (сделает|сделает бот|сделает сайт)|нужна помощь с разработкой/i;

  // DELIVERY: только прямой запрос ресторатора про агрегаторы
  const DELI_CLIENT = /подключить (wolt|bolt|glovo|яндекс.?еду)|как (подключиться к|работать с) (wolt|bolt|glovo)|проблем[ауы] с (wolt|bolt|glovo)|рейтинг (wolt|bolt|glovo|на wolt).{0,20}(упал|низкий|поднять|помогите)|wolt.{0,30}(помог|мало заказов|нет заказов)|меню (на wolt|wolt|bolt|glovo)/i;

  if ((cat === 'dev' || cat === 'any') && DEV_CLIENT.test(t)) return 9;
  if ((cat === 'delivery' || cat === 'any') && DELI_CLIENT.test(t)) return 9;
  return 0;
}

function msgText(cat, hint) {
  const t = (hint||"").toLowerCase();
  const isDelivery = cat==="delivery" || /wolt|bolt|glovo|доставка|ресторан|кафе|delivery|restaurant/.test(t);
  const isVacancy = /вакансия|ищем разработчика|требуется разработчик|нанимаем|hiring developer|hiring programmer/.test(t);
  const isEnglish = /need developer|looking for|build a|chatbot for|automate/.test(t);

  const asksForLinks = /резюме|резюмэ|cv|портфолио|portfolio|linkedin|github|ссылку на|ссылка на/i.test(hint||"");
  const GITHUB = "https://github.com/larsen66";
  const LINKEDIN = "https://www.linkedin.com/in/davidhakobyan/";

  if (isEnglish || /[a-zA-Z]{10,}/.test(hint||"")) {
    if (isVacancy) return `Hi! Saw your post about hiring a developer. Open to freelance/contract work — Full-stack dev (Python/FastAPI, Vue, React, Telegram bots, AI automation). GitHub: ${GITHUB} | LinkedIn: ${LINKEDIN}. Happy to discuss your project!`;
    if (isDelivery) return `Hi! Saw your post about food delivery. I help restaurants connect to Wolt, Bolt Food and Glovo, improve ratings and grow orders. Happy to share more if you're interested!`;
    return `Hi! Saw your post about development/automation. I'm a Full-stack developer specializing in websites, Telegram bots and AI automation for businesses. Happy to discuss your project and share pricing if you're interested!`;
  }
  if (isVacancy) {
    const linksLine = asksForLinks ? `\nGitHub: ${GITHUB}\nLinkedIn: ${LINKEDIN}` : "";
    return `Добрый день! Увидел вакансию. Работаю на проектной и контрактной основе - Full-stack (Python/FastAPI, Vue, React), Telegram-боты, AI-автоматизация.${linksLine}\nОбсудим задачу?`;
  }
  if (isDelivery) {
    return `Добрый день! Увидел Ваш вопрос насчёт доставки. Помогаю ресторанам и кафе подключиться к Wolt, Bolt Food и Glovo, повысить рейтинг и увеличить заказы. Если интересно - расскажу подробнее.`;
  }
  return `Добрый день! Увидел Ваш вопрос. Занимаюсь разработкой сайтов, Telegram-ботов и AI-автоматизацией для бизнеса. Если интересно - готов обсудить задачу и назвать стоимость.`;
}

// ─── утилиты ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
function log(msg) { const l=`[${new Date().toISOString()}] ${msg}`; process.stdout.write(l+"\n"); }
async function tg(text, topic=TOPIC_GEN) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DALI_GROUP, message_thread_id: topic, text, parse_mode: 'HTML' }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch {}
}

// ─── поиск в группе ──────────────────────────────────────────────────────────
async function searchGroup(client, grp, dialogCache={}) {
  const leads = [];
  const isGlobal = /community|founders|startup|networking|entrepreneurs|horeca|hub|nomad|dubai|india/i.test(grp.u);
  const kws = isGlobal ? [...KW_EN, ...(KW[grp.cat]||KW.dev).slice(0,5)] : (KW[grp.cat] || KW.dev);
  const sinceTs = Math.floor(Date.now()/1000) - 14*24*3600;

  let entity;
  // Если состоим в группе — берём entity из кэша диалогов (нет flood wait!)
  const cached = dialogCache[grp.u.toLowerCase()];
  if (cached) {
    entity = cached;
  } else {
    // НЕ пытаемся резолвить группы не из кэша — gramjs засыпает на весь flood wait!
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
        if (uid === '8466294883') continue; // пропускаем свой аккаунт
        if (uid === '7310390783') continue; // DevHubGE
        let username=null, accessHash=null;
        try { const u=await client.getEntity(new Api.PeerUser({userId:BigInt(uid)})); username=u?.username; accessHash=u?.accessHash?.toString(); } catch {}
        if (!username || alreadySeen(username)) continue;

        const s = scoreMsg(msg.message, grp.cat);
        if (s < 5) continue;

        markSeen(username);
        leads.push({username, uid, accessHash, text:msg.message.slice(0,200), score:s, cat:grp.cat, group:grp.u, msgId:msg.id, date:new Date(msg.date*1000).toLocaleDateString("ru-RU")});
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
  // Сброс cooldown при старте чтобы не зависнуть в пустом цикле
  fs.writeFileSync(COOLDOWN_FILE, '{}');

  const client = new TelegramClient(
    new StringSession(sessionStr),
    parseInt(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    {connectionRetries:5}
  );
  await client.connect();
  log("Подключён к Telegram (@aisceptic0)");

  // Подключаем второй аккаунт @DevHubGE для комментирования в группах
  let client2 = null;
  try {
    const session2Str = fs.readFileSync(path.join(__dirname, 'store/session2.txt'), 'utf8').trim();
    client2 = new TelegramClient(
      new StringSession(session2Str),
      parseInt(process.env.TELEGRAM_API_ID),
      process.env.TELEGRAM_API_HASH,
      { connectionRetries: 3 }
    );
    await client2.connect();
    log("Подключён @DevHubGE для комментирования");
  } catch(e) {
    log(`[WARN] @DevHubGE не подключён: ${e.message?.slice(0,60)}`);
  }

  // Загружаем диалоги чтобы кэшировать entity для групп где состоим
  log("Загружаю диалоги (entity cache)...");
  const dialogCache = {};
  try {
    const dialogs = await client.getDialogs({limit:500});
    for (const d of dialogs) {
      if (d.entity?.username) {
        dialogCache[d.entity.username.toLowerCase()] = d.entity;
      }
    }
    log(`Entity cache: ${Object.keys(dialogCache).length} групп/каналов`);
  } catch(e) { log(`Cache warn: ${e.message}`); }

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
  let recentGroups = [];
  let groupsScannedTotal = 0;

  const REPORT_INTERVAL  = 10*60*1000;
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

    // Выбираем следующую доступную группу
    let grp = null;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[idx % groups.length];
      idx++;
      if (canSearch(g.u)) { grp = g; break; }
    }

    if (!grp) { await sleep(500); continue; }
    touchGroup(grp.u);

    log(`Ищу @${grp.u} [${grp.cat}]`);

    const batchResults = [{ grp, leads: await searchGroup(client, grp, dialogCache).catch(() => []) }];

    for (const { grp, leads } of batchResults) {
      groupsScannedTotal++;
      recentGroups.unshift(`@${grp.u}`);
      if (recentGroups.length > 8) recentGroups.pop();
      if (leads.length) log(`  ${leads.length} лидов в @${grp.u}`);

      for (const lead of leads.sort((a,b)=>b.score-a.score)) {
        state.found++;

        if (lead.score >= 7) {
          log(`[LEAD] @${lead.username} (${lead.score}/10) из @${lead.group}`);

          const text = lead.cat === 'delivery'
            ? `Добрый день! Увидел Ваш вопрос про агрегаторы доставки. Помогаю ресторанам с Wolt/Bolt/Glovo — аудит меню, рейтинг, подключение. Если актуально — готов обсудить.`
            : `Добрый день! Увидел Ваш вопрос. Занимаюсь разработкой сайтов, Telegram-ботов и AI-автоматизацией для бизнеса. Если интересно — готов обсудить задачу.`;

          // Ответ в группе через @DevHubGE (client2 уже подключён)
          let commented = false;
          let dmSent = false;
          const grpEntity = dialogCache[lead.group.toLowerCase()];
          if (grpEntity && lead.msgId && client2) {
            try {
              const commentText = lead.cat === 'delivery'
                ? `Добрый день! Помогаю ресторанам с Wolt, Bolt, Glovo — подключение, аудит меню, рейтинг. Если актуально — пишите в ЛС @aisceptic0`
                : `Добрый день! Занимаюсь разработкой Telegram-ботов, сайтов и AI-автоматизацией для бизнеса. Если нужна помощь — пишите, обсудим. @DevHubGE`;

              await client2.invoke(new Api.messages.SendMessage({
                peer: new Api.InputPeerChannel({
                  channelId: BigInt(grpEntity.id),
                  accessHash: grpEntity.accessHash,
                }),
                message: commentText,
                replyTo: new Api.InputReplyToMessage({ replyToMsgId: lead.msgId }),
                randomId: BigInt(Math.floor(Math.random() * 1e15)),
                noWebpage: true,
              }));
              commented = true;
              log(`[COMMENT] @${lead.username} в @${lead.group} (msg ${lead.msgId})`);
            } catch(e) {
              log(`[COMMENT_ERR] @${lead.username}: ${e.message?.slice(0,80)}`);
            }
          }

          // Также пробуем ЛС если не удался комментарий
          if (!commented && lead.accessHash) {
            try {
              await client.invoke(new Api.messages.SendMessage({
                peer: new Api.InputPeerUser({ userId: BigInt(lead.uid), accessHash: BigInt(lead.accessHash) }),
                message: text,
                randomId: BigInt(Math.floor(Math.random() * 1e15))
              }));
              dmSent = true;
              log(`[DM_SENT] @${lead.username}`);
              const sentData = JSON.parse(fs.readFileSync(SENT_FILE,'utf8').trim()||'{}');
              sentData[lead.username] = { ts: Date.now(), msg: text };
              fs.writeFileSync(SENT_FILE, JSON.stringify(sentData, null, 2));
            } catch(e) {
              log(`[DM_ERR] @${lead.username}: ${e.message?.slice(0,60)}`);
            }
          }

          // Репорт в DALI AGENTS
          const topic = lead.cat === 'delivery' ? TOPIC_DELI : TOPIC_DEV;
          const status = commented ? '💬 Ответил в группе' : dmSent ? '✅ ЛС отправлено' : '⚠️ Нет доступа';
          const msg = `🔍 <b>Лид (${lead.score}/10)</b> ${status}\n@${lead.username} — @${lead.group}\n\n"${lead.text.slice(0,200).replace(/\n/g,' ')}"`;
          await tg(msg, topic);
        } else {
          if (!cycleLeads.find(l=>l.username===lead.username)) cycleLeads.push(lead);
        }
      }
    }

    state.cycles++;
    saveState(state);

    // Сводка каждые 30 мин
    if (Date.now()-state.lastReport >= REPORT_INTERVAL) {
      const min=Math.round((Date.now()-state.start)/60000);
      let r=`📡 <b>Группы — статус (${min} мин)</b>\n\n`;
      r+=`🔍 Сканировано: <b>${groupsScannedTotal}</b> групп\n`;
      r+=`🎯 Найдено лидов: <b>${state.found}</b>\n`;
      r+=`📋 Групп в ротации: ${groups.length}\n`;
      r+=`\n<b>Последние сканы:</b>\n${recentGroups.slice(0,6).join(', ')}\n`;
      if (cycleLeads.length>0) {
        r+=`\n🟡 <b>На очереди:</b>\n`;
        for (const l of cycleLeads.slice(0,5)) {
          r+=`@${l.username} — ${l.score}/10 — @${l.group}\n<i>${l.text.slice(0,80).replace(/\n/g," ")}</i>\n\n`;
        }
        cycleLeads=[];
      } else {
        r+=`\n😴 Реальных лидов пока нет — ищу`;
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
