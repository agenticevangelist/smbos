// Ищет релевантные Telegram-группы через contacts.Search (MTProto, без API)
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session2.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 });

const GROUPS_FILE = '/tmp/cs_groups_v3.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const QUERIES = [
  // Бизнес/предпринимательство
  ['бизнес предприниматели', 'dev'],
  ['бизнес нетворкинг', 'dev'],
  ['малый бизнес чат', 'dev'],
  ['стартап IT', 'dev'],
  ['фриланс биржа', 'dev'],
  ['предприниматели Грузия', 'dev'],
  ['бизнес Тбилиси', 'dev'],
  ['предприниматели Армения', 'dev'],
  ['бизнес Казахстан', 'dev'],
  ['бизнес Ереван', 'dev'],
  ['бизнес Баку', 'dev'],
  ['бизнес Алматы', 'dev'],
  // IT/разработка
  ['разработка заказ', 'dev'],
  ['программисты фриланс', 'dev'],
  ['чат программистов', 'dev'],
  ['разработчики Python', 'dev'],
  ['telegram боты разработка', 'dev'],
  // Рестораны/HoReCa
  ['ресторанный бизнес', 'delivery'],
  ['рестораны кафе', 'delivery'],
  ['HoReCa', 'delivery'],
  ['wolt bolt glovo', 'delivery'],
  ['доставка еда', 'delivery'],
  ['ресторан Грузия', 'delivery'],
  ['кафе Тбилиси', 'delivery'],
  // Общие бизнес СНГ
  ['бизнес клуб', 'dev'],
  ['предприниматели клуб', 'dev'],
  ['инвестиции бизнес', 'dev'],
  ['маркетплейс продажи', 'dev'],
  ['онлайн бизнес', 'dev'],
  // Новые регионы
  ['бизнес Дубай', 'dev'],
  ['Дубай предприниматели', 'dev'],
  ['бизнес Стамбул', 'dev'],
  ['Стамбул русские', 'dev'],
  ['бизнес Ташкент', 'dev'],
  ['предприниматели Узбекистан', 'dev'],
  ['бизнес Минск', 'dev'],
  ['предприниматели Беларусь', 'dev'],
  ['бизнес Тбилиси грузия', 'dev'],
  ['русские Тбилиси', 'dev'],
  ['эмигранты предприниматели', 'dev'],
  ['релоканты бизнес', 'dev'],
  // E-commerce / интернет-магазины
  ['интернет магазин чат', 'dev'],
  ['ecommerce продажи', 'dev'],
  ['маркетплейс предприниматели', 'dev'],
  ['dropshipping дропшиппинг', 'dev'],
  // Инфобизнес / коучи
  ['инфобизнес чат', 'dev'],
  ['коучи предприниматели', 'dev'],
  ['онлайн курсы бизнес', 'dev'],
  ['продюсеры эксперты', 'dev'],
  // Недвижимость
  ['риелторы агентства', 'dev'],
  ['недвижимость Грузия', 'dev'],
  ['недвижимость Тбилиси', 'dev'],
  ['агентство недвижимости чат', 'dev'],
  // Бьюти / салоны
  ['салоны красоты бизнес', 'dev'],
  ['beauty бьюти предприниматели', 'dev'],
  ['nail мастера студия', 'dev'],
  // Туризм / отели
  ['туризм отели Грузия', 'delivery'],
  ['гостиницы хостелы чат', 'delivery'],
  ['туристический бизнес', 'dev'],
  // Автоматизация / CRM
  ['автоматизация бизнес', 'dev'],
  ['CRM бизнес чат', 'dev'],
  ['чатботы telegram бизнес', 'dev'],
  ['mini app telegram', 'dev'],
  // Доставка / тёмные кухни
  ['dark kitchen тёмная кухня', 'delivery'],
  ['доставка ресторан агрегатор', 'delivery'],
  ['кейтеринг бизнес', 'delivery'],
  ['food court фудкорт', 'delivery'],
  ['бары клубы владельцы', 'delivery'],
  ['ресторан Армения', 'delivery'],
  ['ресторан Азербайджан', 'delivery'],
  ['HoReCa Казахстан', 'delivery'],
  ['HoReCa Узбекистан', 'delivery'],
  // Логистика / склад
  ['логистика бизнес чат', 'dev'],
  ['склад фулфилмент', 'dev'],
  // Юридические / бухгалтерия
  ['юристы предприниматели', 'dev'],
  ['бухгалтеры автоматизация', 'dev'],
  // Строительство / ремонт
  ['строительство бизнес чат', 'dev'],
  ['ремонт бригады заказы', 'dev'],
];

async function main() {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8')); } catch {}
  const existingSet = new Set(existing.map(g => g.u?.toLowerCase()).filter(Boolean));
  console.log(`Текущих групп: ${existing.length}\n`);

  await client.connect();
  const newGroups = [];

  for (const [q, cat] of QUERIES) {
    try {
      const res = await client.invoke(new Api.contacts.Search({ q, limit: 20 }));
      const chats = (res.chats || []).filter(c => 
        c.username && 
        (c.megagroup || c.participantsCount > 100) &&
        !existingSet.has(c.username.toLowerCase())
      );
      
      if (chats.length > 0) {
        console.log(`"${q}": ${chats.length} новых`);
        for (const c of chats) {
          const u = c.username.toLowerCase();
          existingSet.add(u);
          newGroups.push({ u: c.username, cat, members: c.participantsCount || 0, priority: 0 });
          console.log(`  + @${c.username} (${c.participantsCount || '?'} чел) — ${c.title}`);
        }
      } else {
        console.log(`"${q}": ничего нового`);
      }
    } catch(e) {
      if (e.message?.includes('FLOOD_WAIT')) {
        const w = parseInt(e.message.match(/\d+/)?.[0] || '10');
        console.log(`FLOOD_WAIT ${w}s...`);
        await sleep(w * 1000);
      } else {
        console.log(`Ошибка "${q}": ${e.message?.slice(0,50)}`);
      }
    }
    await sleep(1000);
  }

  if (newGroups.length > 0) {
    const updated = [...existing, ...newGroups];
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(updated, null, 2));
    console.log(`\n✅ Добавлено ${newGroups.length} новых групп. Итого: ${updated.length}`);
  } else {
    console.log('\nНовых не найдено');
  }

  await client.disconnect();
}

main().catch(console.error);
