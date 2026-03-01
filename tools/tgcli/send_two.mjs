import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const session = new StringSession(fs.readFileSync(path.join(__dirname,'store/session2.txt'),'utf8').trim());
const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;

const TARGETS = [
  {
    username: 'topersmm1',
    msg: `Добрый день! Видел ваш запрос по сайтам и лендингам. Я Full-Stack разработчик, делаю сайты, лендинги, Telegram боты и автоматизацию для бизнеса. Есть портфолио. Если актуально, расскажите подробнее что нужно?`
  },
  {
    username: 'AI_Artm',
    msg: `Добрый день! Видел ваш вопрос про AI агента продавца. Как раз занимаюсь разработкой таких решений на базе LangChain + OpenAI. Обработку возражений можно выстроить через RAG по базе знаний или fine-tuned модель. Если интересно обсудить подробнее, напишите!`
  }
];

const SENT_FILE = '/tmp/cs_sent.json';
const sent = JSON.parse(fs.readFileSync(SENT_FILE,'utf8').trim()||'{}');

const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3 });
await client.connect();

for (const t of TARGETS) {
  if (sent[t.username]) {
    console.log(`skip @${t.username} (уже отправлено)`);
    continue;
  }
  try {
    const entity = await client.getInputEntity(t.username);
    await client.invoke(new Api.messages.SendMessage({
      peer: entity,
      message: t.msg,
      randomId: BigInt(Math.floor(Math.random() * 1e15))
    }));
    sent[t.username] = { ts: Date.now(), msg: t.msg.slice(0,80) };
    fs.writeFileSync(SENT_FILE, JSON.stringify(sent,null,2));
    console.log(`✅ Отправлено @${t.username}`);
    await new Promise(r => setTimeout(r, 3000));
  } catch(e) {
    console.log(`❌ @${t.username}: ${e.message}`);
  }
}

await client.disconnect();
console.log('Готово');
