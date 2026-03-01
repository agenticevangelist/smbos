import fs from 'fs';

const API_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';
const pain = JSON.parse(fs.readFileSync('/tmp/miami_pain_analysis.json', 'utf8'));

// Все 534 Miami лиды тоже нужны — берём топ боль + СНГ из полного списка
const all = JSON.parse(fs.readFileSync('/tmp/miami_leads.json', 'utf8'));
const chains = /mcdonald|kfc|burger king|subway|domino|papa john|starbucks|wendy|taco bell|pizza hut|popeye|chipotle|shake shack|five guys|little caesar/i;

// Объединяем: pain leads + СНГ-подозрительные из полного списка
const CIS_NAME = /kavkaz|georgian|jonjoli|ararat|oblomoff|matryoshka|kalinka|lavka|moon steakhouse|crystal lounge|rakija|chayhana|pierogi|european delight|sim sim|zoi restaurant|sultan|world market|shashlik|pelmeni|borsch|borscht|samovar|caspian|baku|tbilisi|yerevan|tashkent|bukhara|samarkand/i;

const cisLeads = all.filter(l => l.hasPhone && !chains.test(l.name) && CIS_NAME.test(l.name));
const painLeads = pain.slice(0, 30);

// Уникальные по названию
const allTargets = [...painLeads];
for (const c of cisLeads) {
  if (!allTargets.find(t => t.name === c.name)) {
    allTargets.push({ ...c, painScore: 0, hasDeliveryPain: false, hasMgmtPain: false });
  }
}

console.log(`Обогащаем: ${allTargets.length} заведений\n`);

// Признаки СНГ-владельца
const CIS_LANG_RE = /[а-яёА-ЯЁ]{3,}/; // кириллица на сайте
const CIS_OWNER_RE = /owner|chef|founder|about us|our story|история|владелец|шеф|основатель/i;
const RU_REVIEW_RE = /[а-яёА-ЯЁ]{4,}/;

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
const INSTAGRAM_RE = /instagram\.com\/([a-zA-Z0-9._]+)/gi;
const FACEBOOK_RE = /facebook\.com\/([a-zA-Z0-9._]+)/gi;

async function fetchSite(url) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await r.text();
    return text.slice(0, 15000); // первые 15kb
  } catch { return null; }
}

async function getReviewsForCIS(name, address) {
  try {
    const params = new URLSearchParams({
      input: `${name} ${address}`, inputtype: 'textquery',
      key: API_KEY, fields: 'place_id'
    });
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
    const d = await r.json();
    const placeId = d.candidates?.[0]?.place_id;
    if (!placeId) return [];

    await new Promise(r => setTimeout(r, 300));
    const r2 = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${API_KEY}&language=ru`);
    const d2 = await r2.json();
    return d2.result?.reviews || [];
  } catch { return []; }
}

const results = [];

for (const lead of allTargets) {
  process.stdout.write(`\n🔍 ${lead.name}...`);

  const result = {
    name: lead.name,
    phone: lead.phone,
    website: lead.website || null,
    rating: lead.rating,
    reviews: lead.reviews,
    painScore: lead.painScore || 0,
    hasDeliveryPain: lead.hasDeliveryPain || false,
    painReviews: lead.painReviews || [],
    gmaps: lead.gmaps,
    // enriched
    emails: [],
    instagram: null,
    facebook: null,
    isCIS: false,
    cisSignals: [],
    language: 'en',
    ownerHint: null,
  };

  // Проверяем имя
  if (CIS_NAME.test(lead.name)) {
    result.isCIS = true;
    result.cisSignals.push('name');
  }

  // Парсим сайт
  if (lead.website) {
    await new Promise(r => setTimeout(r, 300));
    const html = await fetchSite(lead.website);
    if (html) {
      // Emails
      const emails = [...new Set([...html.matchAll(EMAIL_RE)].map(m => m[0]))].filter(e =>
        !e.includes('example') && !e.includes('sentry') && !e.includes('schema')
      );
      result.emails = emails.slice(0, 3);

      // Social
      const ig = html.match(INSTAGRAM_RE);
      if (ig) result.instagram = ig[0].replace(/.*instagram\.com\//i,'').replace(/['">\s].*/,'');
      const fb = html.match(FACEBOOK_RE);
      if (fb) result.facebook = fb[0].replace(/.*facebook\.com\//i,'').replace(/['">\s].*/,'');

      // Кириллица на сайте
      if (CIS_LANG_RE.test(html)) {
        result.isCIS = true;
        result.cisSignals.push('cyrillic_on_site');
        result.language = 'ru';
      }
    }
  }

  // Русские отзывы через Google Maps (для подозрительных)
  if (!result.isCIS && CIS_NAME.test(lead.name) || result.name.match(/sultan|world market|chayhana|crystal/i)) {
    await new Promise(r => setTimeout(r, 500));
    const reviews = await getReviewsForCIS(lead.name, lead.address || '');
    const ruReviews = reviews.filter(r => RU_REVIEW_RE.test(r.text || ''));
    if (ruReviews.length >= 2) {
      result.isCIS = true;
      result.cisSignals.push(`${ruReviews.length}_ru_reviews`);
      result.ownerHint = ruReviews[0]?.text?.slice(0, 80);
    }
  }

  const cisTag = result.isCIS ? '🇷🇺' : '🇺🇸';
  const emailTag = result.emails.length ? `📧${result.emails[0]}` : '';
  const igTag = result.instagram ? `📷@${result.instagram}` : '';
  process.stdout.write(` ${cisTag} ${emailTag} ${igTag}\n`);

  results.push(result);
  await new Promise(r => setTimeout(r, 400));
}

// Сортировка: СНГ + боль наверху
results.sort((a,b) => {
  const cisA = a.isCIS ? 100 : 0;
  const cisB = b.isCIS ? 100 : 0;
  return (cisB + b.painScore) - (cisA + a.painScore);
});

fs.writeFileSync('/tmp/miami_enriched.json', JSON.stringify(results, null, 2));

// Красивый CSV
const rows = ['СНГ,Pain,Название,Телефон,Email,Instagram,Рейтинг,Отзывов,Сайт'];
results.forEach(l => {
  rows.push([
    l.isCIS ? 'ДА' : '',
    l.painScore,
    '"'+l.name.replace(/"/g,'""')+'"',
    l.phone,
    l.emails[0]||'',
    l.instagram ? '@'+l.instagram : '',
    l.rating,
    l.reviews,
    l.website||''
  ].join(','));
});
fs.writeFileSync(process.env.HOME+'/Desktop/miami_enriched.csv', rows.join('\n'));

console.log('\n\n=== ИТОГ ===');
const cis = results.filter(r=>r.isCIS);
const withEmail = results.filter(r=>r.emails.length>0);
const withIG = results.filter(r=>r.instagram);
console.log(`СНГ-владельцы: ${cis.length}`);
console.log(`С email: ${withEmail.length}`);
console.log(`С Instagram: ${withIG.length}`);

console.log('\n🇷🇺 СНГ рестораны:');
cis.forEach(l => {
  console.log(`  ${l.name} | ${l.phone} | ⭐${l.rating} | ${l.emails[0]||'нет email'} | ${l.instagram?'@'+l.instagram:''} | ${l.cisSignals.join(',')}`);
});

console.log('\n📧 С email (топ-15):');
results.filter(r=>r.emails.length).slice(0,15).forEach(l => {
  console.log(`  ${l.name} | ${l.phone} | ${l.emails[0]}`);
});
