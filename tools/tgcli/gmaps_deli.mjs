// Google Maps DELI lead scraper
// Ищет рестораны/кафе в Тбилиси, собирает контакты
import fs from 'fs';

const API_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';
const OUT_FILE = '/tmp/deli_leads_gmaps.json';

const QUERIES = [
  'ресторан Тбилиси',
  'кафе Тбилиси',
  'restaurant Tbilisi',
  'cafe Tbilisi',
  'доставка еды Тбилиси',
  'food delivery Tbilisi',
  'пицца Тбилиси',
  'суши Тбилиси',
  'бургер Тбилиси',
  'грузинская кухня Тбилиси',
  'Georgian restaurant Tbilisi',
  'dark kitchen Tbilisi',
  'cloud kitchen Tbilisi',
];

async function textSearch(query, pageToken = null) {
  const params = new URLSearchParams({ query, key: API_KEY, language: 'ru' });
  if (pageToken) params.set('pagetoken', pageToken);
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  return r.json();
}

async function getDetails(placeId) {
  const fields = 'name,formatted_phone_number,website,formatted_address,rating,user_ratings_total,url,types,opening_hours';
  const params = new URLSearchParams({ place_id: placeId, key: API_KEY, language: 'ru', fields });
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const d = await r.json();
  return d.result || null;
}

const seen = new Set();
const leads = [];

for (const query of QUERIES) {
  console.log(`\n🔍 "${query}"...`);
  let pageToken = null;
  let page = 0;

  do {
    if (pageToken) await new Promise(r => setTimeout(r, 2000)); // required delay
    const res = await textSearch(query, pageToken);
    if (res.status !== 'OK' && res.status !== 'ZERO_RESULTS') {
      console.log(`  ❌ ${res.status}: ${res.error_message || ''}`);
      break;
    }

    for (const place of (res.results || [])) {
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);

      // Получаем детали (телефон, сайт)
      await new Promise(r => setTimeout(r, 300));
      const det = await getDetails(place.place_id);
      if (!det) continue;

      const lead = {
        name: det.name,
        phone: det.formatted_phone_number || null,
        website: det.website || null,
        address: det.formatted_address || place.formatted_address,
        rating: det.rating || null,
        reviews: det.user_ratings_total || 0,
        gmaps: det.url || null,
        hasPhone: !!det.formatted_phone_number,
        hasWebsite: !!det.website,
        query,
      };
      leads.push(lead);

      const status = [lead.hasPhone ? '📞' : '  ', lead.hasWebsite ? '🌐' : '  '].join('');
      console.log(`  ${status} ${det.name} — ${det.formatted_phone_number || 'нет тел'}`);
    }

    pageToken = res.next_page_token || null;
    page++;
  } while (pageToken && page < 3);

  await new Promise(r => setTimeout(r, 1000));
}

// Сортируем: сначала с телефоном
leads.sort((a, b) => (b.hasPhone ? 1 : 0) - (a.hasPhone ? 1 : 0) || b.reviews - a.reviews);

fs.writeFileSync(OUT_FILE, JSON.stringify(leads, null, 2));

console.log(`\n✅ Готово! Найдено: ${leads.length} заведений`);
console.log(`📞 С телефоном: ${leads.filter(l=>l.hasPhone).length}`);
console.log(`🌐 С сайтом: ${leads.filter(l=>l.hasWebsite).length}`);
console.log(`💾 Сохранено в ${OUT_FILE}`);

// Топ-20 с телефоном
console.log('\n--- Топ с телефоном (для cold outreach) ---');
leads.filter(l => l.hasPhone).slice(0, 20).forEach(l => {
  console.log(`${l.name} | ${l.phone} | ⭐${l.rating} (${l.reviews}) | ${l.website || 'нет сайта'}`);
});
