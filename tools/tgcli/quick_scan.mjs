import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionFile = path.join(__dirname, 'store/session.txt');
const session = new StringSession(fs.readFileSync(sessionFile, 'utf8').trim());

const API_ID = 33887530;
const API_HASH = 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4';

const cache = JSON.parse(fs.readFileSync('/tmp/cs_entity_cache.json', 'utf8'));
const sent = JSON.parse(fs.readFileSync('store/sent.json', 'utf8').trim() || '{}');
const seen = fs.existsSync('/tmp/cs_seen.json') ? JSON.parse(fs.readFileSync('/tmp/cs_seen.json', 'utf8').trim() || '{}') : {};

// Keywords for scoring
const DEV_KEYWORDS = ['бот', 'telegram bot', 'сайт', 'автоматизация', 'crm', 'интеграция', 'разработчик', 'программист', 'лендинг', 'парсер', 'api', 'приложение', 'веб', 'python', 'javascript', 'react', 'fastapi', 'django'];
const DELIVERY_KEYWORDS = ['wolt', 'bolt', 'glovo', 'яндекс еда', 'yandex food', 'агрегатор', 'доставка', 'ресторан', 'кафе', 'меню', 'заказы', 'рейтинг', 'партнер wolt', 'подключить'];
const SPAM_RE = /предлагаю|мои услуги|портфолио|ищу заказы|делаю сайты|разрабатываю|оказываю услуги|принимаю заказы|беру проекты/i;
const VACANCY_WRONG_STACK = /\.net|c#|java\b|kotlin|swift|ruby|rust|golang|\bgo\b.*разраб|wordpress|php-разраб/i;

function scoreMsg(text, senderIsBot) {
  if (!text || senderIsBot) return 0;
  if (SPAM_RE.test(text)) return 0;
  
  const lower = text.toLowerCase();
  let score = 0;
  let type = null;
  
  // Check if it's a vacancy post with wrong stack
  const isVacancy = /ищем|нужен разработчик|требуется|вакансия|ищу разработчика|hire|hiring|developer wanted/i.test(text);
  if (isVacancy && VACANCY_WRONG_STACK.test(text)) return 0;
  
  // Dev scoring
  let devHits = 0;
  for (const kw of DEV_KEYWORDS) {
    if (lower.includes(kw)) devHits++;
  }
  
  // Delivery scoring
  let delHits = 0;
  for (const kw of DELIVERY_KEYWORDS) {
    if (lower.includes(kw)) delHits++;
  }
  
  if (devHits >= 2) { score = Math.min(8 + devHits - 2, 10); type = 'dev'; }
  else if (devHits === 1) { score = 6; type = 'dev'; }
  
  if (delHits >= 2) { const s2 = Math.min(8 + delHits - 2, 10); if (s2 > score) { score = s2; type = 'delivery'; } }
  else if (delHits === 1) { if (6 > score) { score = 6; type = 'delivery'; } }
  
  return score;
}

async function main() {
  const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3 });
  await client.connect();
  
  const leads = [];
  
  for (const [username, info] of Object.entries(cache)) {
    try {
      const peer = new Api.InputPeerChannel({
        channelId: BigInt(info.id),
        accessHash: BigInt(info.accessHash)
      });
      
      console.log(`Сканирую @${username}...`);
      
      const result = await client.invoke(new Api.messages.GetHistory({
        peer,
        limit: 50,
        offsetId: 0,
        offsetDate: 0,
        addOffset: 0,
        maxId: 0,
        minId: 0,
        hash: BigInt(0)
      }));
      
      const messages = result.messages || [];
      const users = {};
      (result.users || []).forEach(u => { users[u.id.toString()] = u; });
      
      for (const msg of messages) {
        if (!msg.message || !msg.fromId) continue;
        const msgId = `${username}_${msg.id}`;
        if (seen[msgId]) continue;
        
        const fromId = msg.fromId.userId?.toString();
        if (!fromId) continue;
        
        const user = users[fromId];
        if (!user) continue;
        if (user.bot) continue;
        
        const score = scoreMsg(msg.message, false);
        if (score >= 7) {
          const sentKey = user.username || fromId;
          if (sent[sentKey]) continue;
          
          leads.push({
            score,
            username: user.username || null,
            id: fromId,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            group: username,
            text: msg.message.slice(0, 300),
            msgId
          });
        }
        
        seen[msgId] = 1;
      }
      
      await new Promise(r => setTimeout(r, 1500));
    } catch(e) {
      console.error(`Ошибка @${username}:`, e.message);
    }
  }
  
  // Save seen
  fs.writeFileSync('/tmp/cs_seen.json', JSON.stringify(seen));
  
  await client.disconnect();
  
  // Sort by score desc
  leads.sort((a,b) => b.score - a.score);
  
  console.log(`\n=== НАЙДЕНО ${leads.length} ЛИДОВ ===\n`);
  for (const l of leads) {
    console.log(`[${l.score}/10] @${l.username || l.id} (${l.firstName} ${l.lastName}) — @${l.group}`);
    console.log(`  "${l.text.replace(/\n/g,' ').slice(0,150)}"`);
    console.log();
  }
  
  // Save results
  fs.writeFileSync('/tmp/quick_scan_results.json', JSON.stringify(leads, null, 2));
  console.log('Сохранено в /tmp/quick_scan_results.json');
}

main().catch(console.error);
