// Находит релевантные Telegram-группы через tgstat.ru (без API)
import fs from 'fs';

const GROUPS_FILE = '/tmp/cs_groups_v3.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Категории и запросы для поиска групп
const SEARCHES = [
  // Бизнес/предпринимательство
  { q: 'бизнес предприниматели', country: 'ru', type: 'chat' },
  { q: 'бизнес Грузия', country: 'ge', type: 'chat' },
  { q: 'бизнес Армения', country: 'am', type: 'chat' },
  { q: 'бизнес Казахстан', country: 'kz', type: 'chat' },
  { q: 'бизнес Азербайджан', country: 'az', type: 'chat' },
  { q: 'предприниматели фриланс', country: 'ru', type: 'chat' },
  { q: 'стартапы IT', country: 'ru', type: 'chat' },
  // Рестораны/HoReCa
  { q: 'ресторан кафе бизнес', country: 'ru', type: 'chat' },
  { q: 'HoReCa доставка', country: 'ru', type: 'chat' },
  { q: 'ресторанный бизнес', country: 'ru', type: 'chat' },
  { q: 'доставка еды агрегатор', country: 'ru', type: 'chat' },
  // IT/разработка
  { q: 'разработка программисты', country: 'ru', type: 'chat' },
  { q: 'фриланс разработка', country: 'ru', type: 'chat' },
  // СНГ бизнес
  { q: 'бизнес нетворкинг', country: 'ru', type: 'chat' },
  { q: 'малый бизнес', country: 'ru', type: 'chat' },
];

async function searchTgstat(query, country, type = 'chat') {
  const params = new URLSearchParams({
    q: query,
    search_by_description: '1',
    peer_type: type,
    country: country,
    language: 'ru',
    limit: '50'
  });
  
  const url = `https://tgstat.ru/channels/search?${params}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      }
    });
    
    if (!res.ok) return [];
    const html = await res.text();
    
    // Извлекаем usernames из ссылок вида /channel/@username или t.me/username
    const found = [];
    const patterns = [
      /tgstat\.ru\/chat\/@?([\w_]+)/g,
      /tgstat\.ru\/channel\/@?([\w_]+)/g,
      /t\.me\/([\w_]+)/g,
      /@([\w_]{5,})/g
    ];
    
    const seen = new Set();
    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(html)) !== null) {
        const u = m[1].toLowerCase();
        if (u.length >= 5 && !seen.has(u) && !u.includes('tgstat')) {
          seen.add(u);
          found.push(u);
        }
      }
    }
    
    return found.slice(0, 50);
  } catch(e) {
    return [];
  }
}

async function main() {
  // Загружаем текущие группы
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  } catch {}
  
  const existingSet = new Set(existing.map(g => g.u?.toLowerCase()).filter(Boolean));
  console.log(`Текущих групп: ${existing.length}`);
  
  const newGroups = [];
  
  for (const search of SEARCHES) {
    console.log(`\nИщу: "${search.q}" [${search.country}]...`);
    const found = await searchTgstat(search.q, search.country, search.type);
    console.log(`  Найдено: ${found.length} handles`);
    
    for (const u of found) {
      if (!existingSet.has(u) && u.length >= 5) {
        existingSet.add(u);
        // Определяем категорию по запросу
        const cat = search.q.includes('ресторан') || search.q.includes('HoReCa') || search.q.includes('доставка') ? 'delivery' : 'dev';
        newGroups.push({ u, cat, members: 0, priority: 0 });
        console.log(`  + @${u} [${cat}]`);
      }
    }
    
    await sleep(2000); // пауза между запросами
  }
  
  if (newGroups.length > 0) {
    const updated = [...existing, ...newGroups];
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(updated, null, 2));
    console.log(`\n✅ Добавлено ${newGroups.length} новых групп. Всего: ${updated.length}`);
  } else {
    console.log('\n⚠️ Новых групп не найдено (возможно tgstat блокирует без авторизации)');
  }
  
  // Пробуем lyzem как резерв
  console.log('\nПробую lyzem.com для поиска каналов...');
  const lyzemQueries = ['бизнес предприниматели чат', 'ресторан бизнес чат', 'фриланс разработка'];
  for (const q of lyzemQueries) {
    const url = `https://lyzem.com/search?q=${encodeURIComponent(q)}&lang=ru&type=channels`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const usernames = [...html.matchAll(/t\.me\/([\w_]+)/g)].map(m => m[1]);
      console.log(`  "${q}": ${usernames.slice(0,5).join(', ')}`);
    } catch {}
    await sleep(1500);
  }
}

main().catch(console.error);
