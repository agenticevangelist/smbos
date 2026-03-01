// Проверяем 10 СНГ-ресторанов Miami на агрегаторах
// Запускать когда будет подключён Chrome relay

const restaurants = [
  { name: 'Matryoshka Deli', area: 'Sunny Isles Beach', lat: 25.9312, lng: -80.1230 },
  { name: 'Chayhana Oasis', area: 'Sunny Isles Beach', lat: 25.9312, lng: -80.1230 },
  { name: 'Kavkaz Restaurant', area: 'North Miami', lat: 25.9012, lng: -80.1618 },
  { name: 'OBLOMOFF', area: 'Sunny Isles Beach', lat: 25.9312, lng: -80.1230 },
  { name: 'Jonjoli Georgian Cafe', area: 'North Miami Beach', lat: 25.9012, lng: -80.1618 },
  { name: 'LAVKA Gourmet Cafe', area: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Kalinka Euro Deli', area: 'Sunny Isles Beach', lat: 25.9312, lng: -80.1230 },
  { name: 'Ararat Grill Bar', area: 'Sunny Isles Beach', lat: 25.9312, lng: -80.1230 },
  { name: 'Tbilisi cafe', area: 'Delray Beach', lat: 26.4615, lng: -80.1255 },
  { name: 'Baku Asian Fusion', area: 'Doral', lat: 25.8198, lng: -80.3499 },
];

const results = {};

// Uber Eats search — inject into browser page
const checkUE = async (name, lat, lng) => {
  const pl = btoa(JSON.stringify({ address: name, latitude: lat, longitude: lng }));
  const url = `https://www.ubereats.com/search?q=${encodeURIComponent(name)}&pl=${encodeURIComponent(pl)}`;
  // Return URL for browser to navigate to
  return url;
};

// Slice search
const checkSlice = async (name) => {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `https://slicelife.com/search?query=${encodeURIComponent(name)}&address=Miami+Beach%2C+FL`;
};

console.log('=== URLs для проверки ===\n');

for (const r of restaurants) {
  const ueUrl = `https://www.ubereats.com/search?q=${encodeURIComponent(r.name)}`;
  const sliceUrl = `https://slicelife.com/search?query=${encodeURIComponent(r.name)}&address=Miami+FL`;
  console.log(`\n${r.name} (${r.area}):`);
  console.log(`  UE: ${ueUrl}`);
  console.log(`  Slice: ${sliceUrl}`);
}

export { restaurants };
