// WhatsApp outreach по Miami DELI лидам
// Запускать ПОСЛЕ wacli auth
import { execSync } from 'child_process';
import fs from 'fs';

const enriched = JSON.parse(fs.readFileSync('/tmp/miami_enriched.json', 'utf8'));
const SENT_FILE = '/tmp/wa_sent.json';
const sent = fs.existsSync(SENT_FILE) ? JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')) : {};

// Очищаем номер телефона до формата +1XXXXXXXXXX
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return null;
}

function buildMessage(lead) {
  if (lead.isCIS) {
    // Русскоязычный питч
    return `Добрый день! Нашёл ваш ресторан ${lead.name} на Google Maps. Занимаюсь управлением доставкой для ресторанов — DoorDash, Uber Eats, Grubhub. Помогаю поднять рейтинг, оптимизировать меню и увеличить выручку с доставки. Работал с 20+ заведениями. Если интересно — напишите, расскажу подробнее.`;
  } else {
    // Английский питч
    return `Hi! I came across ${lead.name} on Google Maps. I specialize in delivery optimization for restaurants — DoorDash, Uber Eats, Grubhub: menu setup, ratings improvement, revenue growth. Worked with 20+ restaurants. Would love to chat if you're open to it!`;
  }
}

// Приоритет: СНГ с болью → просто СНГ → боль без СНГ
const targets = enriched
  .filter(l => l.phone)
  .sort((a, b) => {
    const scoreA = (a.isCIS ? 100 : 0) + (a.hasDeliveryPain ? 50 : 0) + (a.painScore || 0);
    const scoreB = (b.isCIS ? 100 : 0) + (b.hasDeliveryPain ? 50 : 0) + (b.painScore || 0);
    return scoreB - scoreA;
  });

console.log(`Целей: ${targets.length}`);
let sentCount = 0;
let skipCount = 0;
let failCount = 0;

for (const lead of targets) {
  const phone = formatPhone(lead.phone);
  if (!phone) { console.log(`⚠️ Неверный номер: ${lead.phone} (${lead.name})`); continue; }
  if (sent[phone]) { skipCount++; continue; }

  const msg = buildMessage(lead);
  const lang = lead.isCIS ? '🇷🇺' : '🇺🇸';
  const pain = lead.hasDeliveryPain ? '🚨' : '';

  try {
    execSync(`wacli send text --to "${phone}" --message "${msg.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit', timeout: 15000
    });
    sent[phone] = { name: lead.name, ts: Date.now(), msg: msg.slice(0, 60) };
    fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2));
    console.log(`✅ ${lang}${pain} ${lead.name} | ${phone}`);
    sentCount++;
    // Пауза между сообщениями (не спамить)
    await new Promise(r => setTimeout(r, 8000));
  } catch(e) {
    console.log(`❌ ${lead.name} | ${phone}: ${e.message?.slice(0,50)}`);
    failCount++;
  }
}

console.log(`\nГотово: отправлено ${sentCount}, пропущено ${skipCount}, ошибок ${failCount}`);
