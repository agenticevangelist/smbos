// Ищем юзеров в истории групп по username, затем шлём без ResolveUsername
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const session = new StringSession(fs.readFileSync(path.join(__dirname,'store/session.txt'),'utf8').trim());
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

const TARGETS = {
  'topersmm1': {
    msg: `Добрый день! Видел ваш запрос по сайтам и лендингам. Я Full-Stack разработчик, делаю сайты, лендинги, Telegram боты и автоматизацию для бизнеса. Есть портфолио. Если актуально, расскажите подробнее что нужно?`,
    group: 'biznes_club_russia'
  },
  'AI_Artm': {
    msg: `Добрый день! Видел ваш вопрос про AI агента продавца. Как раз занимаюсь разработкой таких решений на базе LangChain + OpenAI. Обработку возражений можно выстроить через RAG по базе знаний или fine-tuned модель. Если интересно обсудить подробнее, напишите!`,
    group: 'chat_biznes1'
  }
};

const SENT_FILE = '/tmp/cs_sent.json';
const sent = JSON.parse(fs.readFileSync(SENT_FILE,'utf8').trim()||'{}');
const entityCache = JSON.parse(fs.readFileSync('/tmp/cs_entity_cache.json','utf8'));

const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3 });
await client.connect();

const userCache = {}; // username -> { id, accessHash }

// Сканируем нужные группы
const groupsToScan = [...new Set(Object.values(TARGETS).map(t => t.group))];

for (const grpKey of groupsToScan) {
  const info = entityCache[grpKey];
  if (!info) { console.log(`нет кеша для ${grpKey}`); continue; }
  console.log(`Сканирую @${grpKey}...`);
  try {
    const peer = new Api.InputPeerChannel({
      channelId: BigInt(info.id),
      accessHash: BigInt(info.accessHash)
    });
    // Берём последние 200 сообщений
    const res = await client.invoke(new Api.messages.GetHistory({
      peer, limit: 200, offsetId:0, offsetDate:0, addOffset:0, maxId:0, minId:0, hash: BigInt(0)
    }));
    for (const u of (res.users||[])) {
      if (!u.username) continue;
      const uname = u.username.toLowerCase();
      for (const target of Object.keys(TARGETS)) {
        if (uname === target.toLowerCase() && !userCache[target]) {
          userCache[target] = { id: u.id, accessHash: u.accessHash };
          console.log(`✓ Нашёл @${target} (ID: ${u.id})`);
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  } catch(e) {
    console.log(`❌ Ошибка ${grpKey}: ${e.message}`);
  }
}

// Отправляем
for (const [username, target] of Object.entries(TARGETS)) {
  if (sent[username]) {
    console.log(`skip @${username} (уже отправлено)`);
    continue;
  }
  const uc = userCache[username];
  if (!uc) {
    console.log(`⚠️ @${username} — не найден в истории группы ${target.group}`);
    continue;
  }
  try {
    const peer = new Api.InputPeerUser({ userId: uc.id, accessHash: uc.accessHash });
    await client.invoke(new Api.messages.SendMessage({
      peer,
      message: target.msg,
      randomId: BigInt(Math.floor(Math.random() * 1e15))
    }));
    sent[username] = { ts: Date.now(), msg: target.msg.slice(0,80) };
    fs.writeFileSync(SENT_FILE, JSON.stringify(sent,null,2));
    console.log(`✅ Отправлено @${username}`);
    await new Promise(r => setTimeout(r, 3000));
  } catch(e) {
    console.log(`❌ @${username}: ${e.message}`);
  }
}

await client.disconnect();
console.log('Готово');
