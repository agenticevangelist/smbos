import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionStr = fs.readFileSync(path.join(__dirname, "store/session.txt"), "utf8").trim();

const client = new TelegramClient(
  new StringSession(sessionStr),
  parseInt(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 3 }
);

await client.connect();
await client.getDialogs({ limit: 10 });

const leads = [
  {
    chatUsername: "biznes_chat",
    senderId: "807519336",
    msg: "Привет видел Ваш запрос про голосовых ИИ агентов для ресторанной сферы. Занимаюсь как раз этим разрабатываю AI ботов и автоматизацию под HoReCa. Расскажите подробнее про задачу?",
    label: "AI-агент для ресторана"
  },
  {
    chatUsername: "BiznesKontakti",
    senderId: "415793010",
    msg: "Привет видел что ищете разработчика для одностраничника по открытию компаний в ОАЭ. Делаю сайты на русском и английском есть опыт с международными проектами. Могу взяться обсудим?",
    label: "Лендинг ОАЭ"
  },
  {
    chatUsername: "biznes_club_russia",
    senderId: "8405185496",
    msg: "Привет видел что ищете фрилансеров по сайтам. Я Full Stack разработчик занимаюсь сайтами ботами и AI автоматизацией. Если нужен надёжный исполнитель готов обсудить.",
    label: "Фрилансеры"
  },
];

for (const lead of leads) {
  try {
    const chat = await client.getEntity(lead.chatUsername);
    const msgs = await client.getMessages(chat, { limit: 500 });
    const msg = msgs.find(m => m.senderId?.toString() === lead.senderId);
    if (!msg) {
      console.log(JSON.stringify({ error: "msg not found", label: lead.label }));
      continue;
    }
    const sender = await client.getEntity(msg.senderId);
    await client.sendMessage(sender, { message: lead.msg });
    console.log(JSON.stringify({
      ok: true,
      label: lead.label,
      to: `${sender.firstName || ''} ${sender.lastName || ''}`.trim(),
      username: sender.username
    }));
  } catch(e) {
    console.log(JSON.stringify({ error: e.message.slice(0, 100), label: lead.label }));
  }
  await new Promise(r => setTimeout(r, 1500));
}

await client.disconnect();
