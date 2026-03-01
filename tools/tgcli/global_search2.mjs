// Непрерывный глобальный поиск лидов по Telegram
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session2.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 5, autoReconnect: true });

const BOT_TOKEN = '8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw';
const DALI_GROUP = '-1003733922250';
const TOPIC_DEV = 2;
const TOPIC_DELI = 3;
const TOPIC_GENERAL = 1;
const SENT_FILE = 'store/sent.json';
const SEEN_FILE = '/tmp/gs2_seen.json';
const LOG_FILE = '/tmp/gs2.log';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

async function tg(text, topic = TOPIC_GENERAL) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DALI_GROUP, message_thread_id: topic, text, parse_mode: 'HTML' }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch {}
}

// Жёсткий фильтр: всё что не запрос на покупку услуги
const SKIP_STACK_RE = /\.net|c#|java|kotlin|swift/i;

const OFFER_RE = /#помогу|#техспец|#дизайнер|#маркетолог|#копирайтер|меня зовут|я занимаюсь|мой опыт|мои услуги|беру проекты|портфолио|ищу клиентов|ищу заказы|принимаю заказы|предлагаю|оказываю услуги|делаю сайты|разрабатываю|разрабатываем|наша команда|наша компания|мы делаем|мы разрабатываем|готов помочь|бесплатная консультация|пишите мне|пишите в лс|ищу инвестора|ищу партнёра|ищу работу|хочу стать|ищем сотрудника|ищем менеджера|ищем партнёра|ищем инвестора|нужен инвестор|нужен партнёр|нас зовут|наш проект|наш сервис|хочу работать|ищу клиентов|наш стартап/i;

// Запросы — как пишет клиент
const QUERIES = [
  // Dev запросы
  'кто делает telegram бот',
  'хочу заказать бот',
  'нужен бот для записи',
  'нужен бот для заявок',
  'нужен бот для магазина',
  'порекомендуйте разработчика',
  'ищу разработчика проект',
  'нужно сделать приложение',
  'кто может сделать сайт',
  'хочу заказать сайт',
  'нужен лендинг срочно',
  'нужна CRM своя',
  'нужна автоматизация бизнес',
  'интеграция API нужна',
  'нужен парсер',
  'ai агент заказать',
  'нужен разработчик для стартапа',
  'ищу разработчика mvp',
  'нужен бот для магазина',
  'нужен бот для ресторана',
  'разработать telegram бота',
  'создать сайт под ключ',
  'нужен программист для приложения',
  'ищем разработчика в команду',
  'нужна разработка бота',
  'создать crm систему',
  // Delivery запросы
  'подключить wolt',
  'проблема wolt рейтинг',
  'bolt food партнер',
  'glovo ресторан подключить',
  'яндекс еда подключить',
  'агрегаторы доставки настройка',
  'wolt как поднять рейтинг',
  'меню wolt помощь',
  'wolt ресторан проблема',
  'bolt доставка ресторан',
  'подключить доставку ресторан',
  'агрегатор доставки как работать',
  // YC / стартапы / инди хакеры
  'нужен разработчик стартап mvp',
  'ищу cto стартап',
  'нужен tech co-founder',
  'ищу технического со основателя',
  'нужен разработчик для mvp',
  'looking for developer startup',
  'need developer for saas',
  'нужен разработчик saas',
  'ищу разработчика для продукта',
  'нужна помощь с mvp',
  'сделать mvp быстро',
  'разработать saas продукт',
  'нужен разработчик indie',
  'ищу разработчика pet проект',
  'построить стартап разработчик',
  'hire developer yc startup',
  'need fullstack developer',
];

function scoreMsg(text) {
  if (OFFER_RE.test(text)) return 0;
  if (SKIP_STACK_RE.test(text)) return 0; // Tilda, WordPress и пр.
  const lower = text.toLowerCase();

  // ТОЛЬКО прямые запросы на покупку/заказ разработки или помощи с доставкой
  const DEV_CLIENT = /нужен (разработчик|программист|telegram.?бот|чат.?бот|сайт|лендинг|crm|автоматизац)|нужна (разработка|crm|интеграция|автоматизац|помощь с сайтом|помощь с ботом)|нужно (разработать|сделать (сайт|бот|crm|приложение)|создать (сайт|бот|crm))|ищу (разработчика|программиста|исполнителя на (сайт|бот|разработку))|ищем (разработчика|программиста)|хочу заказать (сайт|бот|разработку|автоматизацию)|хочу (сделать|создать|разработать) (сайт|бот|telegram.?бот|crm|приложение|лендинг)|хотим (сделать|создать|разработать) (сайт|бот|crm)|кто (делает|создаёт|разрабатывает|может сделать) (telegram.?бот|сайт|crm|бота)|порекомендуйте (разработчика|программиста)|посоветуйте (разработчика|программиста)|где найти (разработчика|программиста)|заказать разработку|нужен бот для|нужен сайт для|помогите (сделать|создать|разработать) (сайт|бот|crm)|ищу кто (сделает|сделает бот|сделает сайт)|нужна помощь с разработкой/i;

  const DELI_CLIENT = /подключить (wolt|bolt|glovo|яндекс.?еду)|как (подключиться к|работать с) (wolt|bolt|glovo)|проблем[ауы] с (wolt|bolt|glovo)|рейтинг (wolt|bolt|glovo|на wolt|на bolt)|wolt.{0,20}(помог|упал|низкий|поднять|увеличить)|меню (wolt|bolt|glovo)|заказы (wolt|bolt|glovo).{0,20}(мало|упали|нет)/i;

  if (DEV_CLIENT.test(text)) return 9;
  if (DELI_CLIENT.test(text)) return 9;
  return 0;
}

function msgText(text, username) {
  const lower = text.toLowerCase();
  if (lower.includes('wolt') || lower.includes('bolt') || lower.includes('glovo') || lower.includes('агрегатор') || lower.includes('доставка')) {
    return `Привет! Увидел ваш вопрос про агрегаторы доставки. Помогаю ресторанам с Wolt, Bolt, Glovo — аудит, настройка, рейтинг. Если актуально, могу рассказать подробнее?`;
  }
  if (lower.includes('бот') && (lower.includes('запись') || lower.includes('заявк'))) {
    return `Привет! Я как раз делаю Telegram боты для автоматизации заявок и записи. Покажу примеры если интересно, напишите что нужно?`;
  }
  if (lower.includes('сайт') || lower.includes('лендинг')) {
    return `Привет! Увидел вопрос про сайт. Занимаюсь разработкой — сайты, лендинги, под любую задачу. Что за проект, если не секрет?`;
  }
  return `Привет! Увидел ваш вопрос. Занимаюсь разработкой и AI автоматизацией — боты, сайты, CRM, интеграции. Если нужна помощь, напишите что за задача?`;
}

async function runCycle(sent, seen) {
  let found = 0;
  let scanned = 0;
  for (let qi = 0; qi < QUERIES.length; qi++) {
    const q = QUERIES[qi];
    try {
      const res = await client.invoke(new Api.messages.SearchGlobal({
        q, filter: new Api.InputMessagesFilterEmpty(),
        minDate: Math.floor(Date.now() / 1000) - 14 * 24 * 3600,
        maxDate: 0, offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0, limit: 25
      }));

      const users = {};
      (res.users || []).forEach(u => users[u.id.toString()] = u);

      for (const msg of (res.messages || [])) {
        if (!msg.message || !msg.fromId) continue;
        const msgKey = `${msg.fromId.userId}_${msg.id}`;
        if (seen[msgKey]) continue;
        seen[msgKey] = 1;
        scanned++;

        const score = scoreMsg(msg.message);
        if (score < 7) continue;

        const fromId = msg.fromId.userId?.toString();
        if (!fromId) continue;
        if (fromId === '8466294883') continue;
        if (fromId === '7310390783') continue;
        if (fromId === '7310390783') continue; // DevHubGE
        const user = users[fromId];
        if (!user || user.bot) continue;
        const sk = user.username || fromId;
        if (sent[sk]) continue;

        log(`[LEAD ${score}/10] @${user.username || fromId} — "${msg.message.slice(0, 100).replace(/\n/g, ' ')}"`);

        const isDelivery = /wolt|bolt|glovo|агрегатор|доставка/i.test(msg.message);
        const text = isDelivery
          ? `Добрый день! Увидел Ваш вопрос про агрегаторы доставки. Помогаю ресторанам с Wolt/Bolt/Glovo — аудит меню, рейтинг, подключение. Если актуально — готов обсудить.`
          : `Добрый день! Увидел Ваш вопрос. Занимаюсь разработкой сайтов, Telegram-ботов и AI-автоматизацией для бизнеса. Если интересно — готов обсудить задачу.`;

        // Авто-отправка через MTProto (accessHash из SearchGlobal)
        let wasSent = false;
        if (user.accessHash) {
          try {
            await client.invoke(new Api.messages.SendMessage({
              peer: new Api.InputPeerUser({ userId: BigInt(fromId), accessHash: user.accessHash }),
              message: text,
              randomId: BigInt(Math.floor(Math.random() * 1e15))
            }));
            wasSent = true;
            log(`[SENT] @${sk}`);
            let sentData = {};
            try { sentData = JSON.parse(fs.readFileSync(SENT_FILE,'utf8').trim()||'{}'); } catch {}
            if (Array.isArray(sentData)) sentData = {};
            sentData[sk] = { ts: Date.now(), msg: text };
            fs.writeFileSync(SENT_FILE, JSON.stringify(sentData, null, 2));
          } catch(e) {
            log(`[SEND_ERR] @${sk}: ${e.message?.slice(0,60)}`);
          }
        }

        const topic = isDelivery ? TOPIC_DELI : TOPIC_DEV;
        const status = wasSent ? '✅ Отправлено' : '⚠️ Нет доступа';
        const tgMsg = `🔍 <b>Лид (${score}/10) [global]</b> ${status}\n@${sk} — ${(user.firstName||'')} ${(user.lastName||'')}\n\n"${msg.message.slice(0,200).replace(/\n/g,' ')}"`;
        await tg(tgMsg, topic);

        seen[msgKey] = 1;
        fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));
        found++;
        log(`[REPORTED] @${sk}`);
      }
      await sleep(1200);
    } catch(e) {
      if (e.message?.includes('FLOOD_WAIT')) {
        const w = parseInt(e.message.match(/\d+/)?.[0] || '60');
        log(`FLOOD_WAIT ${w}s на запросе "${q}"`);
        await sleep(Math.min(w * 1000, 60000));
      } else {
        log(`err "${q}": ${e.message?.slice(0, 60)}`);
        await sleep(3000);
      }
    }
  }
  return { found, scanned };
}

async function main() {
  await client.connect();
  log('🌐 Глобальный поиск запущен');
  await tg('🌐 <b>Глобальный поиск лидов запущен!</b>\nСканирую весь Telegram по ключевым словам...', TOPIC_GENERAL);

  let cycle = 0;
  let totalScanned = 0;
  let totalFound = 0;
  const STATUS_EVERY = 5;

  while (true) {
    cycle++;
    const sent = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8').trim() || '{}');
    const seen = fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8').trim() || '{}') : {};
    log(`=== Цикл ${cycle} ===`);
    const { found, scanned } = await runCycle(sent, seen);
    totalScanned += scanned;
    totalFound += found;
    log(`Цикл ${cycle} завершён. Новых: ${scanned}, лидов: ${found}. Всего: ${totalScanned} / ${totalFound}. Пауза 30 сек...`);

    if (cycle % STATUS_EVERY === 0) {
      const acct = '(@DevHubGE)';
      await tg(
        `📊 <b>Глобальный поиск — цикл ${cycle}</b> ${acct}\n` +
        `🔍 Новых сообщений за 10 циклов: <b>${totalScanned}</b>\n` +
        `🎯 Лидов в очереди: <b>${totalFound}</b>\n` +
        `📝 Запросов в цикле: ${QUERIES.length}\n` +
        `⏱ Работает с запуска — каждые ~2 мин`,
        TOPIC_GENERAL
      );
    }

    await sleep(30 * 1000);
  }
}

main().catch(async e => {
  log(`FATAL: ${e.message}`);
  await tg(`❌ <b>Глобальный поиск упал!</b> ${e.message}`).catch(() => {});
  process.exit(1);
});
