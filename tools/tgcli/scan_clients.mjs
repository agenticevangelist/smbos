// Ищем КЛИЕНТОВ — тех кто ищет разработчика, а не тех кто предлагает
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import fs from 'fs';

const client = new TelegramClient(
  new StringSession(fs.readFileSync('store/session.txt','utf8').trim()),
  33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4',
  { connectionRetries: 3 }
);

// Паттерны КЛИЕНТА (ищет услугу)
const CLIENT_PATTERNS = [
  /нужен\s+(разработчик|программист|разраб)/i,
  /ищу\s+(разработчик|программист|фрилансер|подрядчик)/i,
  /нужно\s+(сделать|разработать|написать)\s+.*(бот|сайт|приложение|crm)/i,
  /нужен\s+(бот|чат.?бот|telegram.?bot)/i,
  /хочу\s+заказать\s+(бот|сайт|приложение)/i,
  /кто\s+(делает|разрабатывает|может сделать)/i,
  /порекомендуйте\s+(разработчик|программист)/i,
  /ищем\s+(разработчик|программист|подрядчик)/i,
  /нужна\s+(crm|автоматизация|интеграция)/i,
  /помогите\s+найти\s+разработчик/i,
  /есть\s+кто.*делает\s+(сайт|бот|приложение)/i,
  /реклама\s+в\s+telegram|telegram\s+канал.*продвиж/i,
];

// Исключаем — это не клиенты
const SKIP_PATTERNS = [
  /^#помогу/i, /^#ищу_работу/i, /^#вакансия/i, /^#vacancy/i,
  /меня зовут.*я .{0,50}(делаю|создаю|разрабатываю)/i,
  /наша команда делает/i, /предлагаем услуги/i,
  /принимаю заказы/i, /беру проекты/i,
];

const SENT = JSON.parse(fs.existsSync('/tmp/cs_sent.json') ? fs.readFileSync('/tmp/cs_sent.json','utf8') : '{}');
const SEEN = JSON.parse(fs.existsSync('/tmp/scan_seen2.json') ? fs.readFileSync('/tmp/scan_seen2.json','utf8') : '{}');

await client.connect();
const dialogs = await client.getDialogs({ limit: 300 });
const groups = dialogs.filter(d => d.isGroup || (d.isChannel && d.entity?.megagroup));

console.log(`Групп в диалогах: ${groups.length}`);

const leads = [];
const since = Math.floor(Date.now()/1000) - 48 * 3600; // 48 часов

for (const g of groups) {
  const title = g.title || g.name || '';
  try {
    const msgs = await client.getMessages(g.entity, { limit: 50 });
    for (const m of msgs) {
      if (!m.message || m.date < since) continue;
      const txt = m.message;
      
      // Пропускаем если это оффер-фрилансера
      if (SKIP_PATTERNS.some(r => r.test(txt))) continue;
      
      // Ищем клиентский запрос
      if (!CLIENT_PATTERNS.some(r => r.test(txt))) continue;
      
      const sender = m.fromId?.userId?.toString() || '';
      if (!sender) continue;
      if (SENT[sender] || SENT['@'+sender]) continue;
      
      const key = `${sender}_${m.id}`;
      if (SEEN[key]) continue;
      SEEN[key] = 1;
      
      leads.push({
        group: title,
        text: txt.slice(0, 300),
        sender_id: sender,
        date: new Date(m.date * 1000).toLocaleString('ru-RU', {timeZone:'Asia/Tbilisi'})
      });
    }
    await new Promise(r => setTimeout(r, 300));
  } catch(e) {
    // skip
  }
}

fs.writeFileSync('/tmp/scan_seen2.json', JSON.stringify(SEEN));
console.log(`\n=== Найдено клиентов: ${leads.length} ===\n`);
for (const l of leads) {
  console.log(`📍 ${l.group} | ${l.date}`);
  console.log(`👤 ID: ${l.sender_id}`);
  console.log(l.text);
  console.log('---');
}
process.exit(0);
