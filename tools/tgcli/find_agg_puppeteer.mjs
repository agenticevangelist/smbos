import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const restaurants = [
  'Sultan Mediterranean',
  'Chayhana Oasis',
  'Kavkaz Restaurant',
  'LAVKA Gourmet Cafe',
  'Matryoshka Deli',
  'Jonjoli Georgian Cafe',
  'Baku Asian Fusion',
  'Pierogi One',
  'OBLOMOFF',
  'Ararat Grill Bar',
  'Kalinka Euro Deli',
  'Crystal Lounge',
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
});

const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

const results = [];

// --- DoorDash: set Miami address first ---
console.log('Открываю DoorDash, выставляю Miami...');
try {
  await page.goto('https://www.doordash.com/', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));

  // Try to find address input and type Miami address
  const addressInput = await page.$('input[placeholder*="address" i], input[placeholder*="deliver" i], input[data-anchor-id*="address" i]');
  if (addressInput) {
    await addressInput.click();
    await addressInput.type('1 SW 1st St, Miami, FL 33130', { delay: 50 });
    await new Promise(r => setTimeout(r, 2000));
    // Press Enter or click first suggestion
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
  }
} catch (e) {
  console.log('Адрес DoorDash:', e.message.slice(0, 80));
}

for (const name of restaurants) {
  console.log(`\nИщу: ${name}`);
  const result = { name, doordash: null, ubereats: null };

  // --- DoorDash search ---
  try {
    await page.goto(`https://www.doordash.com/search/store/${encodeURIComponent(name)}/`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    });
    await new Promise(r => setTimeout(r, 4000));

    const links = await page.$$eval('a[href]', els =>
      els
        .map(e => ({ href: e.href, text: e.textContent?.trim()?.slice(0, 60) }))
        .filter(({ href }) => href.match(/doordash\.com\/store\/[a-z0-9-]+-\d+/))
    );

    if (links[0]) {
      result.doordash = links[0].href;
      console.log('  DD:', links[0].href, '|', links[0].text);
    } else {
      // Try getting page title to confirm we have results
      const title = await page.title();
      console.log('  DD: нет (title:', title.slice(0, 60), ')');
    }
  } catch (e) {
    console.log('  DD ошибка:', e.message.slice(0, 80));
  }

  await new Promise(r => setTimeout(r, 1000));

  // --- Uber Eats: use their address-based URL ---
  try {
    // Miami, FL encoded address for UE
    const ueSearch = `https://www.ubereats.com/search?q=${encodeURIComponent(name)}&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjElMjBTVyUyMDFzdCUyMFN0JTJDJTIwTWlhbWklMkMlMjBGTCUyMDMzMTMwJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0EyNS43NzMxNDIlMkMlMjJsb25naXR1ZGUlMjIlM0EtODAuMTkzNjM3JTdE`;
    await page.goto(ueSearch, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000));

    const links = await page.$$eval('a[href]', els =>
      els
        .map(e => e.href)
        .filter(h => h.match(/ubereats\.com\/[a-z]{2}\/store\//))
    );

    if (links[0]) {
      result.ubereats = links[0];
      console.log('  UE:', links[0]);
    } else {
      const title = await page.title();
      console.log('  UE: нет (title:', title.slice(0, 60), ')');
    }
  } catch (e) {
    console.log('  UE ошибка:', e.message.slice(0, 80));
  }

  results.push(result);
  await new Promise(r => setTimeout(r, 1500));
}

await browser.close();

writeFileSync('/tmp/agg_links.json', JSON.stringify(results, null, 2));

console.log('\n\n========== ИТОГ ==========');
for (const r of results) {
  const hasSomething = r.doordash || r.ubereats;
  console.log(`\n${hasSomething ? '✅' : '❌'} ${r.name}:`);
  if (r.doordash) console.log(`   DoorDash: ${r.doordash}`);
  if (r.ubereats) console.log(`   Uber Eats: ${r.ubereats}`);
  if (!hasSomething) console.log('   Нет на агрегаторах');
}
