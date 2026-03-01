import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const restaurants = [
  'Sultan Mediterranean Miami',
  'Chayhana Oasis Miami',
  'Kavkaz Restaurant Miami',
  'LAVKA Gourmet Cafe Miami',
  'Matryoshka Deli Miami',
  'Jonjoli Georgian Cafe Miami',
  'Baku Asian Fusion Miami',
  'Pierogi One Miami',
  'OBLOMOFF Sunny Isles Beach',
  'Ararat Grill Bar Miami',
  'Kalinka Euro Deli Miami',
  'Crystal Lounge Miami',
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

const results = [];

for (const name of restaurants) {
  console.log(`\n${name}:`);
  const result = { name, doordash: null, ubereats: null, grubhub: null };

  // Google search for DoorDash link
  try {
    const query = encodeURIComponent(`${name} site:doordash.com`);
    await page.goto(`https://www.google.com/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 12000
    });
    await new Promise(r => setTimeout(r, 1500));

    const links = await page.$$eval('a[href]', els =>
      els.map(e => e.href).filter(h => h.includes('doordash.com/store/'))
    );
    if (links[0]) {
      // Extract clean URL
      const clean = links[0].replace(/\/url\?q=/, '').split('&')[0];
      result.doordash = decodeURIComponent(clean);
      console.log('  DD:', result.doordash);
    } else {
      console.log('  DD: нет');
    }
  } catch (e) {
    console.log('  DD err:', e.message.slice(0, 60));
  }

  await new Promise(r => setTimeout(r, 1000));

  // Google search for Uber Eats link
  try {
    const query = encodeURIComponent(`${name} site:ubereats.com`);
    await page.goto(`https://www.google.com/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 12000
    });
    await new Promise(r => setTimeout(r, 1500));

    const links = await page.$$eval('a[href]', els =>
      els.map(e => e.href).filter(h => h.includes('ubereats.com') && h.includes('/store/'))
    );
    if (links[0]) {
      const clean = links[0].replace(/.*url=/, '').split('&')[0];
      result.ubereats = decodeURIComponent(clean);
      console.log('  UE:', result.ubereats);
    } else {
      console.log('  UE: нет');
    }
  } catch (e) {
    console.log('  UE err:', e.message.slice(0, 60));
  }

  await new Promise(r => setTimeout(r, 800));

  // Google search for Grubhub link
  try {
    const query = encodeURIComponent(`${name} site:grubhub.com`);
    await page.goto(`https://www.google.com/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 12000
    });
    await new Promise(r => setTimeout(r, 1500));

    const links = await page.$$eval('a[href]', els =>
      els.map(e => e.href).filter(h => h.includes('grubhub.com/restaurant/'))
    );
    if (links[0]) {
      const clean = links[0].replace(/.*url=/, '').split('&')[0];
      result.grubhub = decodeURIComponent(clean);
      console.log('  GH:', result.grubhub);
    } else {
      console.log('  GH: нет');
    }
  } catch (e) {
    console.log('  GH err:', e.message.slice(0, 60));
  }

  results.push(result);
  await new Promise(r => setTimeout(r, 1000));
}

await browser.close();
writeFileSync('/tmp/agg_links.json', JSON.stringify(results, null, 2));

console.log('\n\n========== ИТОГ ==========');
for (const r of results) {
  const links = [r.doordash, r.ubereats, r.grubhub].filter(Boolean);
  console.log(`\n${links.length ? '✅' : '❌'} ${r.name}:`);
  if (r.doordash) console.log(`   DD: ${r.doordash}`);
  if (r.ubereats) console.log(`   UE: ${r.ubereats}`);
  if (r.grubhub) console.log(`   GH: ${r.grubhub}`);
  if (!links.length) console.log('   Не найдено');
}
