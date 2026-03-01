// post_to_groups.mjs — постит оффер-сообщения по сегментам
// DEV посты: @DevHubGE (session2.txt)
// DELI посты: @aisceptic0 (session.txt)

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';
const BOT_TOKEN = '8525580677:AAFO5GdNqL-ZPNquL-lnSgvsZYo07ZRVmlw';
const DALI_GROUP = -1003733922250n;
const DALI_GENERAL = 1;

const SESSION1 = fs.readFileSync('store/session.txt', 'utf8').trim();   // @aisceptic0
const SESSION2 = fs.readFileSync('store/session2.txt', 'utf8').trim();  // @DevHubGE

const ENTITY_CACHE_FILE = '/tmp/cs_entity_cache.json';
const POSTED_FILE = '/tmp/posted_groups.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Тексты постов ────────────────────────────────────────────────────────────
const POSTS = {
  infobiz: `Делаю Telegram-ботов и мини-аппы для экспертов и онлайн-школ: автоприём заявок, воронки, оплата внутри бота, CRM для учеников. Стек: Python + FastAPI + React. С нуля до запуска 2-4 недели.\nКейсы и примеры — @DevHubGE`,

  dubai: `Разработка для бизнеса в ОАЭ: CRM-системы, Telegram-боты, сайты, автоматизация. Работаю с русскоязычными предпринимателями, понимаю специфику рынка. Стек: Python, FastAPI, React, AI-интеграции.\n@DevHubGE`,

  realestate: `Делаю CRM и Telegram-ботов для агентств недвижимости: автоматизация заявок, база клиентов, напоминания, парсинг объявлений. Опыт с агентствами в Грузии и СНГ.\n@DevHubGE`,

  miniapps: `Разрабатываю Telegram Mini Apps: React-фронт, FastAPI-бэкенд, платёжки, интеграции. Нужен технический соисполнитель или full-cycle разработка под ваш продукт — пишите.\n@DevHubGE`,

  istanbul: `Разработка для бизнеса в Турции: Telegram-боты, CRM, сайты, автоматизация. Работаю с русскоязычными предпринимателями удалённо. Стек: Python, FastAPI, React, AI.\n@DevHubGE`,

  deli: `Помогаю ресторанам и кафе в Грузии с агрегаторами Wolt, Bolt, Glovo: подключение, аудит меню, оптимизация рейтинга, работа с отзывами. 3 года опыта, 20+ заведений.\nПишите: @aisceptic0`,
};

// ─── Группы по сегментам ─────────────────────────────────────────────────────
const SEGMENT_GROUPS = {
  infobiz: [
    'onlineschoolsclub', 'workwowinfo', 'infobiz_rich', 'infobizchat',
    'infobiznes_Chat', 'infobiz777', 'Integratory_crm_chat', 'infobiz_chat',
    'chat_infobiznes_frilans_udalenka', 'reon_pro',
  ],
  dubai: [
    'chat_Dubai_russian', 'habibibusinessdubai', 'business_dubai_uae',
    'dubai_chat_forum', 'dubai_biznesss', 'bizmarkuae', 'dubai_chat3',
    'dubai_networking',
  ],
  realestate: [
    'Tbilisii_Life', 'georia_realestate', 'tbilisi_nedvizhimost',
    'apartment_tbilisi_ge', 'crescotbilisi', 'georgian_realestate',
    'BatumiRealEstateSell', 'batumi_sity', 'GeorgiaLegal',
  ],
  miniapps: [
    'Web3TelegramBotx', 'tgminiappsinfochat', 'TMiniApps25',
    'miniappstelegram', 'mini_apps_telegram',
  ],
  istanbul: [
    'russiansinturkey_stambul', 'russkie_turtsia_v', 'bp_istanbul',
    'prime_ist', 'clubbusinessist', 'tur_ukraina',
  ],
  deli: [
    'restoran_topchat', 'restodays', 'horecamasters', 'horeca_topchat',
    'RABOTATs_v_HORECA', 'businesGeorgia', 'horecakazakhstan',
    'RestoranBisnes', 'deepfoodtech', 'food_bat',
  ],
};

// ─── Вспомогательные ─────────────────────────────────────────────────────────
async function sendBotMsg(text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(DALI_GROUP),
        message_thread_id: DALI_GENERAL,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.log('bot error:', e.message);
  }
}

// ─── Постинг ─────────────────────────────────────────────────────────────────
async function postToGroups(client, segment, entityCache, accountName) {
  const text = POSTS[segment];
  const groups = SEGMENT_GROUPS[segment];
  let success = 0, skipped = 0, failed = 0;
  const results = [];

  for (const username of groups) {
    const key = `${segment}:${username.toLowerCase()}`;

    // Уже постили?
    let posted = {};
    try { posted = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8')); } catch {}
    if (posted[key]) {
      console.log(`⏭ @${username} — уже постили`);
      skipped++;
      continue;
    }

    // Ищем entity в кэше
    const cached = entityCache[username.toLowerCase()];
    if (!cached) {
      console.log(`⚠️  @${username} — не в entity cache, пропускаем`);
      skipped++;
      continue;
    }

    try {
      await client.invoke(new Api.messages.SendMessage({
        peer: new Api.InputPeerChannel({
          channelId: BigInt(cached.id),
          accessHash: BigInt(cached.accessHash),
        }),
        message: text,
        randomId: BigInt(Math.floor(Math.random() * 1e15)),
        noWebpage: true,
      }));

      // Сохраняем факт постинга
      posted[key] = Date.now();
      fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));

      console.log(`✅ [${accountName}] @${username} (${segment})`);
      results.push(`@${username}`);
      success++;
      await sleep(8000 + Math.random() * 5000); // 8-13 сек между постами
    } catch (e) {
      console.log(`❌ [${accountName}] @${username}: ${e.message}`);
      failed++;
      await sleep(3000);
    }
  }

  return { success, skipped, failed, results };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Загружаем entity cache
  let entityCache = {};
  try { entityCache = JSON.parse(fs.readFileSync(ENTITY_CACHE_FILE, 'utf8')); } catch {}
  console.log(`Entity cache: ${Object.keys(entityCache).length} групп`);

  const summary = [];

  // === DEV посты через @DevHubGE ===
  const devClient = new TelegramClient(new StringSession(SESSION2), API_ID, API_HASH, {
    connectionRetries: 3,
  });
  await devClient.connect();

  // Перестраиваем entity cache из диалогов @DevHubGE
  const devDialogs = await devClient.getDialogs({ limit: 500 });
  for (const d of devDialogs) {
    if (d.entity?.username) {
      const u = d.entity.username.toLowerCase();
      if (!entityCache[u] && d.entity.id) {
        entityCache[u] = {
          id: d.entity.id.toString(),
          accessHash: d.entity.accessHash?.toString() || '0',
          title: d.entity.title,
        };
      }
    }
  }
  console.log(`Entity cache после @DevHubGE диалогов: ${Object.keys(entityCache).length}`);

  for (const seg of ['infobiz', 'dubai', 'realestate', 'miniapps', 'istanbul']) {
    console.log(`\n=== Сегмент: ${seg} ===`);
    const r = await postToGroups(devClient, seg, entityCache, '@DevHubGE');
    summary.push(`<b>${seg}</b>: ✅${r.success} ❌${r.failed} ⏭${r.skipped}`);
    if (r.results.length > 0) {
      summary.push(`  └ ${r.results.join(', ')}`);
    }
    await sleep(5000);
  }
  await devClient.disconnect();

  // === DELI посты через @aisceptic0 ===
  const deliClient = new TelegramClient(new StringSession(SESSION1), API_ID, API_HASH, {
    connectionRetries: 3,
  });
  await deliClient.connect();

  // Добавляем диалоги @aisceptic0 в кэш
  const deliDialogs = await deliClient.getDialogs({ limit: 500 });
  for (const d of deliDialogs) {
    if (d.entity?.username) {
      const u = d.entity.username.toLowerCase();
      if (!entityCache[u] && d.entity.id) {
        entityCache[u] = {
          id: d.entity.id.toString(),
          accessHash: d.entity.accessHash?.toString() || '0',
          title: d.entity.title,
        };
      }
    }
  }

  console.log(`\n=== Сегмент: deli ===`);
  const deliR = await postToGroups(deliClient, 'deli', entityCache, '@aisceptic0');
  summary.push(`<b>deli</b>: ✅${deliR.success} ❌${deliR.failed} ⏭${deliR.skipped}`);
  if (deliR.results.length > 0) {
    summary.push(`  └ ${deliR.results.join(', ')}`);
  }
  await deliClient.disconnect();

  // Отчёт в DALI AGENTS General
  const report = `📢 <b>Постинг завершён</b>\n\n${summary.join('\n')}`;
  await sendBotMsg(report);
  console.log('\n✅ Готово\n' + summary.join('\n'));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
