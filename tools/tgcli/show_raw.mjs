// Показывает сырые сообщения из GlobalSearch — без фильтрации
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const client = new TelegramClient(
  new StringSession(fs.readFileSync('store/session.txt','utf8').trim()),
  33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 }
);

const QUERIES = [
  'нужен разработчик',
  'нужен бот',
  'ищу разработчика',
  'кто делает сайт',
  'хочу заказать бот',
  'посоветуйте разработчика',
  'есть задача разработка',
  'помогите с ботом',
  'telegram bot нужен',
  'mini app нужен',
];

const SKIP_RE = /меня зовут|я занимаюсь|ищу клиентов|ищу заказы|предлагаю|наша команда|портфолио|беру проекты|мои услуги|ищу работу|ищу партнёра|ищу инвестора/i;

await client.connect();

for (const q of QUERIES) {
  try {
    const res = await client.invoke(new Api.messages.SearchGlobal({
      q, filter: new Api.InputMessagesFilterEmpty(),
      minDate: Math.floor(Date.now()/1000) - 3*24*3600, // последние 3 дня
      maxDate: 0, offsetRate: 0, offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0, limit: 20,
    }));

    const msgs = (res.messages || []).filter(m => m.message?.length > 20);
    if (!msgs.length) { console.log(`"${q}": пусто`); continue; }

    console.log(`\n=== "${q}" — ${msgs.length} сообщений ===`);
    for (const m of msgs.slice(0, 5)) {
      const isOffer = SKIP_RE.test(m.message);
      const flag = isOffer ? '🚫' : '👀';
      console.log(`${flag} ${m.message.slice(0, 150).replace(/\n/g,' ')}`);
    }
  } catch(e) {
    console.log(`"${q}": ошибка ${e.message?.slice(0,50)}`);
  }
  await new Promise(r => setTimeout(r, 2000));
}

await client.disconnect();
