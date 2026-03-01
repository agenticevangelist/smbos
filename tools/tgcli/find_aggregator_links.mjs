// Node 22 has built-in fetch

const restaurants = [
  { name: 'Sultan Mediterranean', city: 'Miami' },
  { name: 'Chayhana Oasis', city: 'Miami' },
  { name: 'Kavkaz Restaurant', city: 'Miami' },
  { name: 'LAVKA Gourmet Cafe', city: 'Miami' },
  { name: 'Matryoshka Deli', city: 'Miami' },
  { name: 'Jonjoli Georgian Cafe', city: 'Miami' },
  { name: 'Baku Asian Fusion', city: 'Miami' },
  { name: 'Crystal Lounge', city: 'Miami' },
  { name: 'Ararat Grill Bar', city: 'Miami' },
  { name: 'Kalinka Euro Deli', city: 'Miami' },
  { name: 'Pierogi One', city: 'Miami' },
  { name: 'OBLOMOFF', city: 'Sunny Isles Beach' },
];

const hdrs = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function searchYelp(name, city) {
  try {
    const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(city + ', FL')}`;
    const r = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    const match = text.match(/href="(\/biz\/[a-z0-9-]+)"/i);
    return match ? `https://www.yelp.com${match[1]}` : null;
  } catch { return null; }
}

async function searchUberEats(name, city) {
  try {
    // UberEats has an internal search API
    const url = `https://www.ubereats.com/api/getFeedV1?locationType=HOME&pageInfo=eyJvZmZzZXQiOjAsInBhZ2VTaXplIjo4MH0%3D&userQuery=${encodeURIComponent(name + ' ' + city)}`;
    const r = await fetch(url, { 
      headers: { ...hdrs, 'x-csrf-token': 'x', 'Accept': 'application/json' }, 
      signal: AbortSignal.timeout(8000) 
    });
    if (!r.ok) return null;
    const j = await r.json();
    return JSON.stringify(j).slice(0, 200);
  } catch { return null; }
}

const results = [];

for (const { name, city } of restaurants) {
  process.stdout.write(`${name}... `);
  const yelp = await searchYelp(name, city);
  console.log(yelp || 'нет');
  results.push({ name, city, yelp });
  await new Promise(r => setTimeout(r, 1500));
}

console.log('\n=== ИТОГ ===');
results.forEach(r => {
  if (r.yelp) console.log(`✅ ${r.name}: ${r.yelp}`);
  else console.log(`❌ ${r.name}: не найдено`);
});
