import fs from 'fs';

const API_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';

// Miami lat/lon
const LAT = 25.7617;
const LON = -80.1918;

const QUERIES = [
  'restaurant Miami',
  'cafe Miami Florida',
  'pizza Miami',
  'sushi Miami',
  'burger Miami',
  'food delivery Miami',
  'dark kitchen Miami',
  'Georgian restaurant Miami',
  'Russian restaurant Miami',
  'Armenian restaurant Miami',
  'Cuban restaurant Miami',
  'Latin restaurant Miami',
  'seafood restaurant Miami',
  'bar restaurant Miami Beach',
];

async function textSearch(query, pageToken = null) {
  const params = new URLSearchParams({ query, key: API_KEY, language: 'en', location: `${LAT},${LON}`, radius: 20000 });
  if (pageToken) params.set('pagetoken', pageToken);
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  return r.json();
}

async function getDetails(placeId) {
  const fields = 'name,formatted_phone_number,website,formatted_address,rating,user_ratings_total,url,types';
  const params = new URLSearchParams({ place_id: placeId, key: API_KEY, language: 'en', fields });
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
    if (pageToken) await new Promise(r => setTimeout(r, 2000));
    const res = await textSearch(query, pageToken);
    if (res.status !== 'OK' && res.status !== 'ZERO_RESULTS') {
      console.log(`  ❌ ${res.status}: ${res.error_message || ''}`);
      break;
    }

    for (const place of (res.results || [])) {
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);

      await new Promise(r => setTimeout(r, 300));
      const det = await getDetails(place.place_id);
      if (!det) continue;

      const lead = {
        name: det.name,
        phone: det.formatted_phone_number || null,
        website: det.website || null,
        address: det.formatted_address || '',
        rating: det.rating || null,
        reviews: det.user_ratings_total || 0,
        gmaps: det.url || null,
        hasPhone: !!det.formatted_phone_number,
        hasWebsite: !!det.website,
        query,
      };
      leads.push(lead);

      const status = [lead.hasPhone ? '📞' : '  ', lead.hasWebsite ? '🌐' : '  '].join('');
      console.log(`  ${status} ${det.name} — ${det.formatted_phone_number || 'no phone'}`);
    }

    pageToken = res.next_page_token || null;
    page++;
  } while (pageToken && page < 3);

  await new Promise(r => setTimeout(r, 1000));
}

leads.sort((a, b) => (b.hasPhone ? 1 : 0) - (a.hasPhone ? 1 : 0) || b.reviews - a.reviews);
fs.writeFileSync('/tmp/miami_leads.json', JSON.stringify(leads, null, 2));

console.log(`\n✅ Найдено: ${leads.length} заведений`);
console.log(`📞 С телефоном: ${leads.filter(l=>l.hasPhone).length}`);
console.log(`🌐 С сайтом: ${leads.filter(l=>l.hasWebsite).length}`);
