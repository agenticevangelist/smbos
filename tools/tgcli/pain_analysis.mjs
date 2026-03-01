import fs from 'fs';

const API_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';
const leads = JSON.parse(fs.readFileSync('/tmp/miami_leads.json', 'utf8'));
const chains = /mcdonald|kfc|burger king|subway|domino|papa john|starbucks|wendy|taco bell|pizza hut|popeye|chipotle|shake shack|five guys|little caesar/i;

// Целевой коридор: рейтинг 3.3-4.3, отзывов > 200
const targets = leads
  .filter(l => l.hasPhone && !chains.test(l.name) && l.rating >= 3.3 && l.rating <= 4.3 && (l.reviews||0) >= 200)
  .sort((a,b) => (b.reviews||0) - (a.reviews||0))
  .slice(0, 60);

console.log(`Кандидатов: ${targets.length}`);

const DELIVERY_PAIN = /delivery|doordash|uber eats|grubhub|wait(ing|ed)?|took (forever|too long|long)|late|cold food|wrong order|never arrived|missing|slow service|hours? wait|never came/i;
const MGMT_PAIN = /rude|unprofessional|ignored|no response|worst|horrible|terrible|disgusting|avoid|never again|scam|overpriced/i;
const POSITIVE_DELIVERY = /fast delivery|quick delivery|great delivery|on time|delivered quickly|fresh and hot/i;

async function findPlaceId(name, address) {
  const input = `${name} ${address}`;
  const params = new URLSearchParams({
    input,
    inputtype: 'textquery',
    key: API_KEY,
    fields: 'place_id,rating,user_ratings_total'
  });
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`);
  const d = await r.json();
  return d.candidates?.[0]?.place_id || null;
}

async function getReviews(placeId) {
  const fields = 'reviews,name';
  const params = new URLSearchParams({ place_id: placeId, key: API_KEY, language: 'en', fields });
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const d = await r.json();
  return d.result?.reviews || [];
}

const results = [];

for (const lead of targets) {
  try {
    await new Promise(r => setTimeout(r, 600));

    const placeId = await findPlaceId(lead.name, lead.address);
    if (!placeId) {
      console.log(`⚠️ Не нашёл place_id: ${lead.name}`);
      continue;
    }

    await new Promise(r => setTimeout(r, 400));
    const reviews = await getReviews(placeId);
    const reviewText = reviews.map(r => r.text || '').join(' ');

    const hasDeliveryPain = DELIVERY_PAIN.test(reviewText);
    const hasMgmtPain = MGMT_PAIN.test(reviewText);
    const hasPositiveDel = POSITIVE_DELIVERY.test(reviewText);

    const painReviews = reviews
      .filter(r => (DELIVERY_PAIN.test(r.text) && r.rating <= 3) || (r.rating <= 2))
      .map(r => ({ stars: r.rating, text: r.text?.slice(0, 200), ago: r.relative_time_description }));

    let painScore = 0;
    if (hasDeliveryPain) painScore += 45;
    if (hasMgmtPain) painScore += 20;
    if (!hasPositiveDel) painScore += 10;
    if (lead.rating <= 3.8) painScore += 30;
    if (lead.rating <= 3.5) painScore += 20;
    painScore += Math.min((lead.reviews || 0) / 80, 25);

    const icon = hasDeliveryPain ? '🚨' : hasMgmtPain ? '⚠️' : '📊';
    console.log(`${icon} [${Math.round(painScore)}] ${lead.name} | ⭐${lead.rating} (${lead.reviews})`);
    if (painReviews[0]) console.log(`   ★${painReviews[0].stars} "${painReviews[0].text?.slice(0,120)}" (${painReviews[0].ago})`);

    results.push({
      name: lead.name,
      phone: lead.phone,
      website: lead.website || null,
      rating: lead.rating,
      reviews: lead.reviews,
      gmaps: lead.gmaps,
      painScore: Math.round(painScore),
      hasDeliveryPain,
      hasMgmtPain,
      painReviews: painReviews.slice(0, 3),
    });

  } catch(e) {
    console.log(`skip ${lead.name}: ${e.message}`);
  }
}

results.sort((a,b) => b.painScore - a.painScore);
fs.writeFileSync('/tmp/miami_pain_analysis.json', JSON.stringify(results, null, 2));

// CSV
const rows = ['Pain,Название,Телефон,Рейтинг,Отзывов,Delivery боль,Mgmt боль,Сайт,Google Maps'];
results.forEach(l => {
  rows.push([
    l.painScore,
    '"'+l.name.replace(/"/g,'""')+'"',
    l.phone,
    l.rating,
    l.reviews,
    l.hasDeliveryPain ? 'ДА' : '',
    l.hasMgmtPain ? 'ДА' : '',
    l.website||'',
    l.gmaps||''
  ].join(','));
});
fs.writeFileSync(process.env.HOME+'/Desktop/miami_pain_leads.csv', rows.join('\n'));

const hot = results.filter(r => r.hasDeliveryPain);
console.log(`\n✅ Готово! Проблемы с доставкой: ${hot.length} из ${results.length}`);
console.log('\n🔥 ТОП БОЛЕВЫХ ЛИДОВ:');
hot.slice(0,10).forEach(l => {
  console.log(`  [${l.painScore}] ${l.name} | ${l.phone} | ⭐${l.rating} (${l.reviews})`);
  l.painReviews.slice(0,1).forEach(r => console.log(`    ★${r.stars}: "${r.text?.slice(0,100)}"`));
});
