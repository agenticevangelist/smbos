import fs from 'fs';

const API_KEY = 'AIzaSyD1JjbtcAEmOrRLKL--LlWyZlOcjJZlV7g';
const leads = JSON.parse(fs.readFileSync('/tmp/miami_leads.json', 'utf8'));
const chains = /mcdonald|kfc|burger king|subway|domino|papa john|starbucks|wendy|taco bell|pizza hut|popeye|chipotle|shake shack|five guys|little caesar/i;

// Целевой коридор: рейтинг 3.3-4.3, отзывов > 200
// Именно тут боль — бизнес живой, но проблемы есть
const targets = leads.filter(l =>
  l.hasPhone &&
  !chains.test(l.name) &&
  l.rating >= 3.3 && l.rating <= 4.3 &&
  (l.reviews || 0) >= 200
);

console.log(`Кандидатов для глубокого анализа: ${targets.length}`);

// Ключевые слова проблем с доставкой в отзывах
const DELIVERY_PAIN = /delivery|doordash|uber eats|grubhub|wait(ing|ed)?|took (forever|too long|long)|late|cold food|wrong order|never arrived|missing|driver|courier|never delivered|slow|hours? wait/i;
const MGMT_PAIN = /rude|unprofessional|ignored|no response|bad service|worst|horrible|terrible|disgusting|avoid|never again|scam/i;
const POSITIVE_DELIVERY = /fast delivery|quick delivery|great delivery|on time|delivered quickly|fresh and hot/i;

async function getReviews(placeId) {
  const fields = 'reviews,rating,user_ratings_total,price_level';
  const params = new URLSearchParams({ place_id: placeId, key: API_KEY, language: 'en', fields });
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const d = await r.json();
  return d.result || null;
}

// Для каждого кандидата — грузим отзывы
const results = [];

// Берём топ-60 по количеству отзывов (самые активные)
const sorted = targets.sort((a,b) => (b.reviews||0)-(a.reviews||0)).slice(0, 60);

for (const lead of sorted) {
  try {
    await new Promise(r => setTimeout(r, 400));
    const det = await getReviews(lead.gmaps?.match(/place_id=([^&]+)/)?.[1] ||
      // извлекаем place_id из gmaps URL
      '');

    if (!det) continue;

    const reviews = det.reviews || [];
    const reviewText = reviews.map(r => r.text || '').join(' ');

    const hasDeliveryPain = DELIVERY_PAIN.test(reviewText);
    const hasMgmtPain = MGMT_PAIN.test(reviewText);
    const hasPositiveDelivery = POSITIVE_DELIVERY.test(reviewText);

    // Находим конкретные отзывы с болью
    const painReviews = reviews.filter(r =>
      DELIVERY_PAIN.test(r.text) || (r.rating <= 2 && MGMT_PAIN.test(r.text))
    ).map(r => ({
      rating: r.rating,
      text: r.text?.slice(0, 150),
      time: r.relative_time_description
    }));

    // Скор боли: чем больше проблем, тем горячее лид
    let painScore = 0;
    if (hasDeliveryPain) painScore += 40;
    if (hasMgmtPain) painScore += 20;
    if (!hasPositiveDelivery) painScore += 15;
    if (lead.rating <= 3.8) painScore += 25;
    if (lead.rating <= 3.5) painScore += 25;
    painScore += Math.min((lead.reviews||0) / 100, 20); // популярность

    results.push({
      name: lead.name,
      phone: lead.phone,
      website: lead.website,
      rating: lead.rating,
      reviews: lead.reviews,
      gmaps: lead.gmaps,
      painScore: Math.round(painScore),
      hasDeliveryPain,
      hasMgmtPain,
      painReviews: painReviews.slice(0, 2),
    });

    const flag = hasDeliveryPain ? '🚨' : hasMgmtPain ? '⚠️' : '✅';
    console.log(`${flag} [pain:${Math.round(painScore)}] ${lead.name} | ⭐${lead.rating} (${lead.reviews})`);
    if (painReviews[0]) console.log(`   "${painReviews[0].text}"`);

  } catch(e) {
    console.log(`skip ${lead.name}: ${e.message}`);
  }
}

// Сортируем по болевому скору
results.sort((a,b) => b.painScore - a.painScore);
fs.writeFileSync('/tmp/miami_pain_analysis.json', JSON.stringify(results, null, 2));

// CSV
const rows = ['Pain Score,Название,Телефон,Рейтинг,Отзывов,Проблемы доставки,Управление,Сайт'];
results.forEach(l => {
  rows.push([
    l.painScore,
    '"'+l.name.replace(/"/g,'""')+'"',
    l.phone,
    l.rating,
    l.reviews,
    l.hasDeliveryPain ? 'ДА' : 'нет',
    l.hasMgmtPain ? 'ДА' : 'нет',
    l.website || ''
  ].join(','));
});
fs.writeFileSync(process.env.HOME+'/Desktop/miami_pain_leads.csv', rows.join('\n'));

console.log(`\n✅ Готово. Топ болевых лидов: ${results.filter(r=>r.hasDeliveryPain).length} с проблемами доставки`);
console.log('📄 ~/Desktop/miami_pain_leads.csv');
