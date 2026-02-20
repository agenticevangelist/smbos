import axios from 'axios';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'skills', 'restaurant-scraper', 'data');

// Georgian cities with coordinates
const CITIES = {
  tbilisi: { lat: 41.7151, lon: 44.8271 },
  batumi: { lat: 41.6168, lon: 41.6367 },
  kutaisi: { lat: 42.2679, lon: 42.6946 },
  rustavi: { lat: 41.5495, lon: 44.9927 },
  gori: { lat: 41.9816, lon: 44.1127 },
  zugdidi: { lat: 42.5088, lon: 41.8709 },
  poti: { lat: 42.1461, lon: 41.6719 },
  kobuleti: { lat: 41.8214, lon: 41.7819 },
  telavi: { lat: 41.9198, lon: 45.4731 },
  mtskheta: { lat: 41.8443, lon: 44.7187 },
};

// Glovo-specific city codes
const GLOVO_CITIES: Record<string, { lat: number; lon: number; cityCode: string }> = {
  tbilisi: { lat: 41.7151, lon: 44.8271, cityCode: 'TBI' },
  batumi: { lat: 41.6168, lon: 41.6367, cityCode: 'BUS' },
  kutaisi: { lat: 42.2679, lon: 42.6946, cityCode: 'KUT' },
};

const PHONE_REGEX = /(?:\+?995)[0-9]{9,10}/g;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

interface Restaurant {
  id: string;
  name: string;
  city: string;
  rating: number | string;
  phone: string;
  address: string;
  deliveryTime: string;
  deliveryPrice: string;
  coordinates: { lat: number | null; lon: number | null };
  imageUrl: string | null;
  slug: string;
  tags: string[];
  platform: string;
}

// ========== WOLT SCRAPER ==========
async function scrapeWolt(cities: string[], maxPerCity: number, fetchPhones: boolean): Promise<Restaurant[]> {
  const all: Restaurant[] = [];
  const seenIds = new Set<string>();

  for (const cityName of cities) {
    const coords = CITIES[cityName as keyof typeof CITIES];
    if (!coords) continue;

    try {
      const url = `https://consumer-api.wolt.com/v1/pages/restaurants?lat=${coords.lat}&lon=${coords.lon}`;
      const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const sections = resp.data?.sections || [];

      for (const section of sections) {
        const items = section?.items || [];
        for (const item of items) {
          const venue = item?.venue || item;
          const id = venue?.id || venue?.slug || `wolt-${all.length}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          all.push({
            id,
            name: venue?.name?.[0]?.value || venue?.name || 'Unknown',
            city: cityName,
            rating: venue?.rating?.score ? Math.round(venue.rating.score * 10) / 10 : 0,
            phone: '',
            address: venue?.address || venue?.short_description?.[0]?.value || '',
            deliveryTime: venue?.estimate_range ? `${venue.estimate_range.min}-${venue.estimate_range.max} min` : venue?.delivery_time || '',
            deliveryPrice: venue?.delivery_price_int != null ? `${(venue.delivery_price_int / 100).toFixed(2)} GEL` : '',
            coordinates: { lat: venue?.location?.coordinates?.[1] || coords.lat, lon: venue?.location?.coordinates?.[0] || coords.lon },
            imageUrl: venue?.listimage || venue?.mainimage || null,
            slug: venue?.slug || '',
            tags: venue?.tags || [],
            platform: 'wolt',
          });

          if (all.length >= maxPerCity * cities.length) break;
        }
      }

      // Phone enrichment
      if (fetchPhones) {
        const needPhones = all.filter(r => r.platform === 'wolt' && r.city === cityName && !r.phone && r.slug);
        for (const r of needPhones.slice(0, 50)) {
          try {
            const pageResp = await axios.get(`https://wolt.com/en/geo/${r.slug}`, { headers: { ...HEADERS, Accept: 'text/html' }, timeout: 10000 });
            const phones = pageResp.data.match(PHONE_REGEX);
            if (phones?.length) r.phone = phones[0].startsWith('+') ? phones[0] : `+${phones[0]}`;
            await new Promise(res => setTimeout(res, 3000));
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      console.error(`Wolt scrape error for ${cityName}:`, err.message);
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  return all;
}

// ========== BOLT SCRAPER ==========
async function scrapeBolt(cities: string[], maxPerCity: number): Promise<Restaurant[]> {
  const all: Restaurant[] = [];
  const seenIds = new Set<string>();

  const endpoints = [
    (lat: number, lon: number) => ({ url: `https://food.bolt.eu/v2/stores?lat=${lat}&lng=${lon}&country=ge`, method: 'get' as const }),
    (lat: number, lon: number) => ({ url: `https://food.bolt.eu/bff/stores?lat=${lat}&lng=${lon}`, method: 'get' as const }),
  ];

  for (const cityName of cities) {
    const coords = CITIES[cityName as keyof typeof CITIES];
    if (!coords) continue;

    for (const makeEndpoint of endpoints) {
      try {
        const { url } = makeEndpoint(coords.lat, coords.lon);
        const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const stores = resp.data?.data?.stores || resp.data?.stores || resp.data?.data || [];

        if (!Array.isArray(stores) || stores.length === 0) continue;

        for (const store of stores) {
          const id = store?.id || store?.slug || `bolt-${all.length}`;
          if (seenIds.has(String(id))) continue;
          seenIds.add(String(id));

          const rating5 = store?.rating || store?.score || 0;

          all.push({
            id: String(id),
            name: store?.name || 'Unknown',
            city: cityName,
            rating: Math.round(rating5 * 2 * 10) / 10, // 0-5 → 0-10
            phone: store?.phone || '',
            address: store?.address || '',
            deliveryTime: store?.delivery_time ? `${store.delivery_time} min` : store?.estimated_delivery_time || '',
            deliveryPrice: store?.delivery_fee != null ? `${store.delivery_fee} GEL` : '',
            coordinates: { lat: store?.latitude || store?.lat || null, lon: store?.longitude || store?.lng || null },
            imageUrl: store?.image_url || store?.hero_image || null,
            slug: store?.slug || '',
            tags: store?.tags || store?.categories?.map((c: any) => c.name) || [],
            platform: 'bolt',
          });
        }

        break; // Success with this endpoint
      } catch { /* try next endpoint */ }
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  return all;
}

// ========== GLOVO SCRAPER ==========
async function scrapeGlovo(cities: string[], maxPerCity: number): Promise<Restaurant[]> {
  const all: Restaurant[] = [];
  const seenIds = new Set<string>();

  for (const cityName of cities) {
    const cityData = GLOVO_CITIES[cityName];
    if (!cityData) continue;

    try {
      const resp = await axios.get('https://api.glovoapp.com/v3/stores', {
        headers: {
          ...HEADERS,
          'glovo-delivery-location-latitude': String(cityData.lat),
          'glovo-delivery-location-longitude': String(cityData.lon),
          'glovo-location-city-code': cityData.cityCode,
          'glovo-language-code': 'en',
          'glovo-api-version': '14',
          'glovo-app-platform': 'web',
          'glovo-app-type': 'customer',
        },
        timeout: 15000,
      });

      const stores = resp.data?.data || resp.data?.elements || resp.data || [];
      const storeArray = Array.isArray(stores) ? stores : [];

      for (const store of storeArray) {
        const id = store?.id || store?.storeId || `glovo-${all.length}`;
        if (seenIds.has(String(id))) continue;
        seenIds.add(String(id));

        all.push({
          id: String(id),
          name: store?.name || store?.storeName || 'Unknown',
          city: cityName,
          rating: store?.ratingInfo?.text || store?.rating || '0',
          phone: store?.phone || '',
          address: store?.address?.text || store?.address || '',
          deliveryTime: store?.estimatedDeliveryTime || store?.deliveryTimeMinutes ? `${store.deliveryTimeMinutes} min` : '',
          deliveryPrice: store?.deliveryFee?.amount != null ? `${store.deliveryFee.amount} GEL` : store?.serviceFee || '',
          coordinates: { lat: store?.location?.lat || null, lon: store?.location?.lng || null },
          imageUrl: store?.imageId ? `https://res.cloudinary.com/glovoapp/image/fetch/${store.imageId}` : store?.imageUrl || null,
          slug: store?.slug || '',
          tags: store?.filters?.map((f: any) => f.name) || [],
          platform: 'glovo',
        });
      }
    } catch (err: any) {
      console.error(`Glovo scrape error for ${cityName}:`, err.message);
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  return all;
}

// ========== YANDEX FOOD SCRAPER ==========
async function scrapeYandexFood(cities: string[], maxPerCity: number): Promise<Restaurant[]> {
  const all: Restaurant[] = [];
  const seenIds = new Set<string>();

  const endpoints = [
    (lat: number, lon: number) => `https://eda.yandex/api/v2/catalog?latitude=${lat}&longitude=${lon}`,
    (lat: number, lon: number) => `https://eda.yandex/api/v2/places?latitude=${lat}&longitude=${lon}`,
  ];

  for (const cityName of cities) {
    const coords = CITIES[cityName as keyof typeof CITIES];
    if (!coords) continue;

    for (const makeUrl of endpoints) {
      try {
        const url = makeUrl(coords.lat, coords.lon);
        const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const payload = resp.data?.payload || resp.data;
        let places: any[] = [];

        if (payload?.foundPlaces) {
          places = payload.foundPlaces.map((fp: any) => fp.place || fp);
        } else if (payload?.blocks) {
          for (const block of payload.blocks) {
            if (block?.payload?.places) places.push(...block.payload.places);
          }
        } else if (Array.isArray(payload)) {
          places = payload;
        }

        for (const place of places) {
          const id = place?.id || place?.slug || `yandex-${all.length}`;
          if (seenIds.has(String(id))) continue;
          seenIds.add(String(id));

          const rating5 = place?.rating || 0;

          all.push({
            id: String(id),
            name: place?.name || 'Unknown',
            city: cityName,
            rating: typeof rating5 === 'number' && rating5 <= 5 ? Math.round(rating5 * 2 * 10) / 10 : rating5,
            phone: place?.phone || '',
            address: place?.address?.short || place?.address || '',
            deliveryTime: place?.delivery?.time ? `${place.delivery.time} min` : '',
            deliveryPrice: place?.delivery?.fee ? `${place.delivery.fee} GEL` : '',
            coordinates: { lat: place?.location?.latitude || null, lon: place?.location?.longitude || null },
            imageUrl: place?.picture?.uri || place?.image || null,
            slug: place?.slug || '',
            tags: place?.cuisine?.map((c: any) => c.name) || [],
            platform: 'yandex',
          });
        }

        if (places.length > 0) break;
      } catch { /* try next endpoint */ }
    }

    await new Promise(res => setTimeout(res, 1000));
  }

  return all;
}

// ========== DATA PERSISTENCE ==========
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveData(platform: string, data: Restaurant[]) {
  ensureDataDir();
  fs.writeFileSync(path.join(DATA_DIR, `${platform}_restaurants.json`), JSON.stringify(data, null, 2));
}

function loadData(platform: string): Restaurant[] {
  const filePath = path.join(DATA_DIR, `${platform}_restaurants.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ========== MAIN EXECUTE ==========
export async function execute(params: any) {
  const { platform, city = 'all', fetchPhones = false, maxResults = 100, viewPlatform, viewCity, limit = 100 } = params;

  // View tab: load saved data
  if (viewPlatform) {
    let data = loadData(viewPlatform);
    if (viewCity) data = data.filter(r => r.city.toLowerCase() === viewCity.toLowerCase());
    return {
      restaurants: data.slice(0, limit),
      total: data.length,
      platform: viewPlatform,
    };
  }

  // Scrape tab
  if (!platform) throw new Error('Platform is required');

  const targetCities = city === 'all'
    ? Object.keys(platform === 'glovo' ? GLOVO_CITIES : CITIES)
    : [city];

  let restaurants: Restaurant[] = [];

  switch (platform) {
    case 'wolt':
      restaurants = await scrapeWolt(targetCities, maxResults, fetchPhones);
      break;
    case 'bolt':
      restaurants = await scrapeBolt(targetCities, maxResults);
      break;
    case 'glovo':
      restaurants = await scrapeGlovo(targetCities, maxResults);
      break;
    case 'yandex':
      restaurants = await scrapeYandexFood(targetCities, maxResults);
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }

  // Save scraped data
  saveData(platform, restaurants);

  return {
    restaurants,
    total: restaurants.length,
    platform,
    cities: targetCities,
    scrapedAt: new Date().toISOString(),
  };
}
