const GMAPS_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';

const restaurants = [
  { name: 'Sultan Mediterranean', city: 'Miami, FL' },
  { name: 'Chayhana Oasis', city: 'Miami, FL' },
  { name: 'Kavkaz Restaurant', city: 'Miami, FL' },
  { name: 'LAVKA Gourmet Cafe', city: 'Miami, FL' },
  { name: 'Matryoshka Deli', city: 'Miami, FL' },
  { name: 'Jonjoli Georgian Cafe', city: 'Miami, FL' },
  { name: 'Baku Asian Fusion', city: 'Miami, FL' },
  { name: 'Crystal Lounge', city: 'Miami, FL' },
  { name: 'Ararat Grill Bar', city: 'Miami, FL' },
  { name: 'Kalinka Euro Deli', city: 'Miami, FL' },
  { name: 'Pierogi One', city: 'Miami, FL' },
  { name: 'OBLOMOFF', city: 'Sunny Isles Beach, FL' },
];

const DELIVERY_RE = /doordash\.com|ubereats\.com|grubhub\.com|seamless\.com|order\.online|olo\.com|toast\.me|slice\.com|trycaviar\.com/i;

async function findPlaceId(name, city) {
  const q = encodeURIComponent(`${name} ${city}`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,name&key=${GMAPS_KEY}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  return j?.candidates?.[0]?.place_id;
}

async function getPlaceDetails(placeId) {
  const fields = 'name,website,formatted_phone_number,url';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GMAPS_KEY}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  return j?.result;
}

async function checkWebsiteForDelivery(siteUrl) {
  if (!siteUrl) return [];
  try {
    const r = await fetch(siteUrl, { 
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const text = await r.text();
    const links = [];
    const matches = text.matchAll(/https?:\/\/(?:www\.)?(doordash|ubereats|grubhub)\.com\/[^\s"'<>]+/gi);
    for (const m of matches) {
      const link = m[0].replace(/['"<>)]+$/, '');
      if (!links.includes(link)) links.push(link);
    }
    return links.slice(0, 3);
  } catch { return []; }
}

const results = [];

for (const { name, city } of restaurants) {
  process.stdout.write(`${name}... `);
  try {
    const placeId = await findPlaceId(name, city);
    if (!placeId) { console.log('не найден в GMaps'); results.push({ name, links: [] }); continue; }
    
    const details = await getPlaceDetails(placeId);
    const website = details?.website;
    
    const deliveryLinks = await checkWebsiteForDelivery(website);
    
    console.log(deliveryLinks.length ? deliveryLinks.join(' | ') : `сайт: ${website || 'нет'}`);
    results.push({ name, website, deliveryLinks });
  } catch (e) {
    console.log(`ошибка: ${e.message}`);
    results.push({ name, links: [] });
  }
  await new Promise(r => setTimeout(r, 800));
}

console.log('\n=== ИТОГ ===');
for (const r of results) {
  if (r.deliveryLinks?.length) {
    console.log(`\n✅ ${r.name}:`);
    r.deliveryLinks.forEach(l => console.log(`   ${l}`));
  } else {
    console.log(`❌ ${r.name}: нет ссылок на агрегаторы${r.website ? ` (сайт: ${r.website})` : ''}`);
  }
}
