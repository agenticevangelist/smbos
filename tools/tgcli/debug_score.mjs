// Дебаг скоринга — один цикл, полный лог
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 });

const OFFER_RE = /#помогу|#техспец|#дизайнер|#маркетолог|#копирайтер|меня зовут|я занимаюсь|мой опыт|мои услуги|беру проекты|портфолио|ищу клиентов|ищу заказы|принимаю заказы|предлагаю|оказываю услуги|делаю сайты|разрабатываю|разрабатываем|наша команда|наша компания|мы делаем|мы разрабатываем|готов помочь|бесплатная консультация|пишите мне|пишите в лс|ищу инвестора|ищу партнёра|ищу работу|хочу стать|ищем сотрудника|ищем менеджера|ищем партнёра|ищем инвестора|нужен инвестор|нужен партнёр|нас зовут|наш проект|наш сервис|хочу работать|ищу клиентов|наш стартап/i;

const DEV_CLIENT = /нужен (разработчик|программист|telegram.?бот|чат.?бот|сайт|лендинг|crm|автоматизац)|нужна (разработка|crm|интеграция|автоматизац|помощь с сайтом|помощь с ботом)|нужно (разработать|сделать (сайт|бот|crm|приложение)|создать (сайт|бот|crm))|ищу (разработчика|программиста|исполнителя на (сайт|бот|разработку))|ищем (разработчика|программиста)|хочу заказать (сайт|бот|разработку|автоматизацию)|хочу (сделать|создать|разработать) (сайт|бот|telegram.?бот|crm|приложение|лендинг)|хотим (сделать|создать|разработать) (сайт|бот|crm)|кто (делает|создаёт|разрабатывает|может сделать) (telegram.?бот|сайт|crm|бота)|порекомендуйте (разработчика|программиста)|посоветуйте (разработчика|программиста)|где найти (разработчика|программиста)|заказать разработку|нужен бот для|нужен сайт для|помогите (сделать|создать|разработать) (сайт|бот|crm)|ищу кто (сделает|сделает бот|сделает сайт)|нужна помощь с разработкой/i;

const DELI_CLIENT = /подключить (wolt|bolt|glovo|яндекс.?еду)|как (подключиться к|работать с) (wolt|bolt|glovo)|проблем[ауы] с (wolt|bolt|glovo)|рейтинг (wolt|bolt|glovo|на wolt|на bolt)|wolt.{0,20}(помог|упал|низкий|поднять|увеличить)|меню (wolt|bolt|glovo)|заказы (wolt|bolt|glovo).{0,20}(мало|упали|нет)/i;

const QUERIES = [
  'нужен разработчик', 'нужен бот', 'нужен telegram бот', 'ищу программиста',
  'хочу сделать бота', 'хочу сделать сайт', 'кто делает сайты',
  'нужна автоматизация', 'нужна crm', 'заказать разработку',
  'подключить wolt', 'подключить bolt', 'подключить glovo',
];

const stats = { total: 0, offer: 0, devHit: 0, deliHit: 0, noMatch: 0 };
const examples = { offer: [], devHit: [], deliHit: [], noMatch: [] };

await client.connect();
console.log('🔍 Дебаг скоринга — один цикл по', QUERIES.length, 'запросам\n');

for (const q of QUERIES) {
  let res;
  try {
    res = await client.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now() / 1000) - 7 * 24 * 3600,
      maxDate: 0, offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0, limit: 20
    }));
  } catch(e) {
    console.log(`❌ "${q}" — ошибка: ${e.message?.slice(0, 60)}`);
    await new Promise(r => setTimeout(r, 2000));
    continue;
  }

  const msgs = res.messages || [];
  console.log(`\n📌 "${q}" — ${msgs.length} сообщений`);

  for (const msg of msgs) {
    if (!msg.message) continue;
    const text = msg.message;
    stats.total++;

    let reason = '';
    let bucket = '';

    // Найти что сработало в OFFER_RE
    const offerMatch = text.match(OFFER_RE);
    if (offerMatch) {
      reason = `OFFER: "${offerMatch[0]}"`;
      bucket = 'offer';
      stats.offer++;
    } else if (DEV_CLIENT.test(text)) {
      const devMatch = text.match(DEV_CLIENT);
      reason = `DEV_HIT: "${devMatch[0]}"`;
      bucket = 'devHit';
      stats.devHit++;
    } else if (DELI_CLIENT.test(text)) {
      const deliMatch = text.match(DELI_CLIENT);
      reason = `DELI_HIT: "${deliMatch[0]}"`;
      bucket = 'deliHit';
      stats.deliHit++;
    } else {
      reason = 'NO_MATCH (не DEV и не DELI)';
      bucket = 'noMatch';
      stats.noMatch++;
    }

    const preview = text.slice(0, 120).replace(/\n/g, ' ');
    if (examples[bucket].length < 3) {
      examples[bucket].push({ q, reason, preview });
    }
    console.log(`  [${bucket.toUpperCase()}] ${reason}\n    "${preview}"`);
  }

  await new Promise(r => setTimeout(r, 1500));
}

console.log('\n' + '='.repeat(60));
console.log('📊 ИТОГ:');
console.log(`  Всего сообщений: ${stats.total}`);
console.log(`  OFFER (отфильтровано): ${stats.offer} (${Math.round(stats.offer/stats.total*100)}%)`);
console.log(`  DEV лиды: ${stats.devHit}`);
console.log(`  DELI лиды: ${stats.deliHit}`);
console.log(`  NO_MATCH (не то и не то): ${stats.noMatch} (${Math.round(stats.noMatch/stats.total*100)}%)`);

if (examples.noMatch.length > 0) {
  console.log('\n⚠️ Примеры NO_MATCH (потенциально упущенные лиды):');
  for (const ex of examples.noMatch) {
    console.log(`  [${ex.q}] ${ex.preview}`);
  }
}

if (examples.devHit.length > 0) {
  console.log('\n✅ Примеры DEV лидов:');
  for (const ex of examples.devHit) {
    console.log(`  [${ex.q}] ${ex.preview}`);
  }
}

await client.disconnect();
