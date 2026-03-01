// Мониторинг FL.ru — новые проекты каждые 3 минуты
import fs from 'fs';
import https from 'https';

const BOT_TOKEN = '8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw';
const DALI_GROUP = '-1003733922250';
const TOPIC_DEV = 2;
const TOPIC_DELI = 3;
const SEEN_FILE = '/tmp/flru_seen.json';
const LOG_FILE = '/tmp/flru.log';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function tg(text, topic) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: DALI_GROUP, message_thread_id: topic, text, parse_mode: 'HTML', disable_web_page_preview: true });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); resolve(); });
    req.on('error', resolve);
    req.write(body); req.end();
  });
}

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const DEV_RE = /telegram.?бот|telegram.?bot|mini.?app|чат.?бот|chatbot|python|fastapi|django|react|vue|next\.?js|автоматизац|разработчик|разработк|backend|api интеграц|crm|лендинг|сайт.{0,20}(систем|разраб|под ключ)|бот.{0,20}(разраб|созд|написа|нужен)|нужен разработчик|ищу разработчика|ии.?агент|ai.?агент/i;
const DELI_RE = /wolt|bolt food|glovo|яндекс еда|агрегатор.{0,20}доставк|подключить.{0,20}(wolt|bolt|glovo)/i;
const SKIP_RE = /логотип|фирменный стиль|копирайт|seo|smm|таргет|монтаж|дизайн.{0,15}(логотип|баннер|флаер)|1с\b|битрикс|wordpress|\.net\b|kotlin|swift|unity|roblox|солидворкс|autocad|qgis|ГИС\b|переработка лого|верстк.{0,10}макет/i;

function parseItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
      const res = r.exec(block);
      return res ? (res[1] || res[2] || '').trim() : '';
    };
    items.push({ title: get('title'), desc: get('description'), link: get('link'), guid: get('guid') || get('link') });
  }
  return items;
}

async function check() {
  try {
    const xml = await fetchRSS('https://www.fl.ru/rss/all.xml');
    const items = parseItems(xml);
    const seen = fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')) : {};
    let newLeads = 0;

    for (const { title, desc, link, guid } of items) {
      if (seen[guid]) continue;
      seen[guid] = 1;
      const full = title + ' ' + desc;
      if (SKIP_RE.test(full)) continue;

      if (DEV_RE.test(full)) {
        log(`[DEV] ${title.slice(0, 80)}`);
        await tg(`🔍 <b>FL.ru — DEV проект</b>\n\n<b>${title}</b>\n\n${desc.slice(0, 400)}\n\n<a href="${link}">Открыть →</a>`, TOPIC_DEV);
        newLeads++;
        await sleep(1000);
      } else if (DELI_RE.test(full)) {
        log(`[DELI] ${title.slice(0, 80)}`);
        await tg(`🔍 <b>FL.ru — DELIVERY проект</b>\n\n<b>${title}</b>\n\n${desc.slice(0, 400)}\n\n<a href="${link}">Открыть →</a>`, TOPIC_DELI);
        newLeads++;
        await sleep(1000);
      }
    }

    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));
    return newLeads;
  } catch(e) {
    log(`err: ${e.message}`);
    return 0;
  }
}

async function main() {
  log('🔎 FL.ru монитор запущен');
  await tg('🔎 <b>FL.ru монитор запущен!</b>\nНовые проекты каждые 3 минуты.', TOPIC_DEV);
  
  // Первый прогон — помечаем все как увиденные без отправки
  try {
    const xml = await fetchRSS('https://www.fl.ru/rss/all.xml');
    const items = parseItems(xml);
    const seen = {};
    for (const { guid, link } of items) seen[guid || link] = 1;
    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));
    log(`Проиндексировано ${Object.keys(seen).length} существующих проектов`);
  } catch(e) { log(`init err: ${e.message}`); }

  let cycle = 0;
  while (true) {
    cycle++;
    await sleep(3 * 60 * 1000);
    const found = await check();
    if (found > 0) log(`Цикл ${cycle}: найдено ${found} новых`);
  }
}

main().catch(async e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
