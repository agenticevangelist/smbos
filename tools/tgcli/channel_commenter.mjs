/**
 * channel_commenter.mjs — комментирует посты в IT/AI каналах от @aisceptic0
 * Цель: привлечь аудиторию на канал @aisceptic
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '33887530');
const API_HASH = process.env.TELEGRAM_API_HASH || 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';
const SESSION = fs.readFileSync(path.join(__dirname, 'store/session.txt'), 'utf8').trim();

const SEEN_FILE = '/tmp/commenter_seen.json';
const LOG_FILE = '/tmp/commenter.log';
const BOT_TOKEN = '8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw';
const DALI_GROUP = '-1003733922250';
const DALI_GENERAL = 1;

// Каналы с дискуссиями (linked discussion group)
const TARGET_CHANNELS = [
  // AI / Telegram боты
  { u: 'tgminiappsinfochat', topic: 'miniapps' },
  { u: 'python_scripts_hub', topic: 'python' },
  { u: 'ai_machinelearning_ru', topic: 'ai' },
  { u: 'chatgpt_aisceptic', topic: 'ai' },
  { u: 'it_startup', topic: 'startup' },
  { u: 'itgeeks', topic: 'it' },
  { u: 'tg_dev', topic: 'miniapps' },
  { u: 'aiinrussia', topic: 'ai' },
  { u: 'buildinpublic_ru', topic: 'startup' },
  { u: 'saas_ru', topic: 'startup' },
  { u: 'indie_hackers_ru', topic: 'startup' },
  { u: 'openai_ru', topic: 'ai' },
  { u: 'llm_ru', topic: 'ai' },
  { u: 'ai_automation_ru', topic: 'ai' },
  { u: 'telegram_bots_dev', topic: 'miniapps' },
];

// Фильтр — только посты по теме
const RELEVANT_RE = /telegram|бот|python|fastapi|ai|ии|автоматизац|разработ|mvp|стартап|запустил|сделал|кейс|инструмент|модель|llm|gpt|claude|нейросет|приложен|backend|frontend|api/i;

// Шаблоны комментариев по теме поста
function genComment(text, topic) {
  const t = text.toLowerCase();

  // Telegram боты / Mini Apps
  if (/mini.?app|webapp|twa/i.test(t)) {
    const opts = [
      `Актуально — сам сейчас строю связки Mini App + FastAPI бэкенд. Интересно насколько конверсия отличается от обычного бота. Пишу про такие штуки в @aisceptic`,
      `Mini Apps это отдельный уровень — особенно когда прокидываешь real-time через WebSocket прямо в интерфейс. Разбираю подобные кейсы у себя на @aisceptic`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // AI автоматизация / агенты
  if (/агент|automation|автоматизац|workflow|n8n|make|langchain/i.test(t)) {
    const opts = [
      `У меня похожий сетап — несколько агентов на разные задачи работают 24/7. Главное не переусложнять архитектуру. Пишу про это на @aisceptic`,
      `Согласен — агенты сейчас меняют как работаешь в одиночку. Сам прошёл путь от "делаю всё руками" до полуавтономного pipeline. Канал @aisceptic если интересно`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // MVP / запуск продукта
  if (/mvp|запустил|запуск|launch|продукт|стартап/i.test(t)) {
    const opts = [
      `Огонь! Сам придерживаюсь принципа — запустить за 2-3 дня, потом итерировать. Про методику быстрого билда писал на @aisceptic`,
      `Круто что быстро запустили. По опыту — первые 10 пользователей всегда дают больше инсайтов чем месяц планирования. @aisceptic про такое пишу`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // Python / FastAPI
  if (/python|fastapi|django|flask/i.test(t)) {
    const opts = [
      `FastAPI + async — лучший стек для Telegram ботов под нагрузкой. Проверено на нескольких продах. Пишу про такие штуки на @aisceptic`,
      `Python всё ещё топ для быстрых MVP особенно с AI интеграциями. Разбираю похожие кейсы у себя на @aisceptic`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // AI / LLM / GPT / Claude
  if (/gpt|claude|llm|нейросет|ии\b|ai\b/i.test(t)) {
    const opts = [
      `Интересный кейс. По моим наблюдениям разница между моделями сильно зависит от задачи — для структурированного вывода одни, для рассуждений другие. Пишу про такое на @aisceptic`,
      `Согласен — AI сейчас меняет как в одиночку строишь продукты. Три года юзаю и нашёл свои рабочие паттерны. Про них на @aisceptic`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  // IT общее
  const defaults = [
    `Интересно — у меня похожий опыт был. Пишу про разработку и AI инструменты на @aisceptic если кому тема близка`,
    `Полезно. Сам разбираю такие кейсы на своём канале @aisceptic — про AI, боты и реальную разработку`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch { return {}; }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

async function tgReport(text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DALI_GROUP, message_thread_id: DALI_GENERAL, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

async function main() {
  log('🗣 Commenter запущен — мониторю каналы для @aisceptic');

  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, { connectionRetries: 5 });
  await client.connect();
  log('Подключён к Telegram');

  // Строим entity cache из диалогов (не триггерит ResolveUsername)
  const entityCache = {};
  const dialogs = await client.getDialogs({ limit: 500 });
  for (const d of dialogs) {
    if (d.entity?.username) {
      entityCache[d.entity.username.toLowerCase()] = d.entity;
    }
  }
  log(`Entity cache: ${Object.keys(entityCache).length} каналов/групп`);

  const seen = loadSeen();
  let commented = 0;

  while (true) {
    for (const ch of TARGET_CHANNELS) {
      try {
        // Используем только каналы из кэша (без ResolveUsername)
        const entity = entityCache[ch.u.toLowerCase()];
        if (!entity) {
          log(`⏭ @${ch.u} не в кэше, пропускаем`);
          continue;
        }

        // Получаем последние 5 постов
        const msgs = await client.getMessages(entity, { limit: 5 });

        for (const msg of msgs) {
          if (!msg.message || msg.message.length < 50) continue;
          const key = `${ch.u}:${msg.id}`;
          if (seen[key]) continue;

          // Проверяем релевантность
          if (!RELEVANT_RE.test(msg.message)) {
            seen[key] = 'skip';
            continue;
          }

          // Проверяем что пост свежий (не старше 48ч)
          const ageHours = (Date.now()/1000 - msg.date) / 3600;
          if (ageHours > 48) {
            seen[key] = 'old';
            continue;
          }

          // Генерируем комментарий
          const comment = genComment(msg.message, ch.topic);

          // Постим ответ
          try {
            await client.invoke(new Api.messages.SendMessage({
              peer: entity,
              message: comment,
              replyTo: new Api.InputReplyToMessage({ replyToMsgId: msg.id }),
              randomId: BigInt(Math.floor(Math.random() * 1e15)),
              noWebpage: true,
            }));
            seen[key] = Date.now();
            fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
            commented++;
            log(`✅ Прокомментировал @${ch.u} msg ${msg.id}`);
            await tgReport(`💬 <b>Комментарий</b>\n@${ch.u}\n\n"${msg.message.slice(0,150)}..."\n\n<i>${comment}</i>`);
            await sleep(30000 + Math.random() * 20000); // 30-50 сек между комментами
          } catch(e) {
            log(`❌ @${ch.u}: ${e.message?.slice(0,60)}`);
            seen[key] = 'err';
          }
          fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
        }

        await sleep(3000);
      } catch(e) {
        if (e.message?.includes('FLOOD_WAIT')) {
          const w = parseInt(e.message.match(/\d+/)?.[0] || '60');
          log(`⏳ Flood wait ${w}s на @${ch.u}`);
          await sleep(Math.min(w * 1000, 120000));
        }
      }
    }

    log(`📊 Цикл завершён. Прокомментировано всего: ${commented}`);
    await sleep(15 * 60 * 1000); // следующий цикл через 15 мин
  }
}

main().catch(e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
