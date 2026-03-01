// Try fetching each restaurant's website and looking for ordering links
// Also try fetching DoorDash search via their text search API

const GMAPS_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';

const restaurants = [
  { name: 'Sultan Mediterranean', placeId: null, gmapsCid: '16694389912574410079' },
  { name: 'Chayhana Oasis', placeId: null, gmapsCid: '947145746594322156' },
  { name: 'Kavkaz Restaurant', placeId: null, gmapsCid: '17889780781354977893' },
  { name: 'LAVKA Gourmet Cafe', placeId: null, gmapsCid: '7654755854684916729' },
  { name: 'Matryoshka Deli', placeId: null, gmapsCid: '9522987128717445346' },
  { name: 'Jonjoli Georgian Cafe', placeId: null, gmapsCid: '5632886576839878894' },
  { name: 'Baku Asian Fusion', placeId: null, gmapsCid: '1559484484054416760' },
  { name: 'Pierogi One', placeId: null, gmapsCid: '7083714444730148022' },
  { name: 'OBLOMOFF', placeId: null, gmapsCid: '2867239600506532419' },
];

// Use Places API with "order" field
async function getOrderLinks(name, city) {
  // First find place_id
  const q = encodeURIComponent(`${name} ${city}`);
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,name&key=${GMAPS_KEY}`;
  const findR = await fetch(findUrl, { signal: AbortSignal.timeout(8000) });
  const findJ = await findR.json();
  const placeId = findJ?.candidates?.[0]?.place_id;
  if (!placeId) return null;

  // Get details with reservations/website
  const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,url,formatted_phone_number,reservations,delivery,dine_in,takeout&key=${GMAPS_KEY}`;
  const detR = await fetch(detUrl, { signal: AbortSignal.timeout(8000) });
  const detJ = await detR.json();
  return detJ?.result;
}

// Try DoorDash store search API (unofficial)
async function searchDoorDash(query) {
  try {
    const url = `https://www.doordash.com/api/v1/feed/?offset=0&limit=5&lat=25.7617&lng=-80.1918&query=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000)
    });
    const text = await r.text();
    // Try to find store URLs in response
    const urls = [...text.matchAll(/\/store\/[a-z0-9-]+\/\d+\//gi)].map(m => `https://www.doordash.com${m[0]}`);
    return urls.slice(0, 2);
  } catch { return []; }
}

// Try Uber Eats via their web API
async function searchUberEats(query) {
  try {
    const url = `https://www.ubereats.com/api/getSearchSuggestionsV1?query=${encodeURIComponent(query)}&lat=25.7617&lng=-80.1918`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'x-csrf-token': 'x',
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return [];
    const j = await r.json();
    return JSON.stringify(j).slice(0, 300);
  } catch { return []; }
}

for (const rest of restaurants) {
  console.log(`\n--- ${rest.name} ---`);
  
  // DoorDash search
  const ddUrls = await searchDoorDash(rest.name + ' Miami');
  if (ddUrls.length) console.log('DoorDash:', ddUrls.join(', '));
  else console.log('DoorDash: не найдено');
  
  await new Promise(r => setTimeout(r, 500));
}
