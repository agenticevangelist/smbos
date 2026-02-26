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

const chats = [
  "avstriya_forum","aljir_chat","andorra_chat","forum_england","angola_ru",
  "boliviya_chat","belgiya_chat","forum_beliz","gabon_ru","gaiti_chat",
  "gaiana_chat","gana_chat","gvatemala_chat","gonduras_chat","gonkong_chat",
  "grenada_ru","daniya_chat","djibuti_chat","dominica_chatik","islandiia_chat",
  "irlandiya_chat","iordaniya_chat","urugvai_chat","caboverde_chat",
  "kamerun_chat","Keniya_chatik","forum_cuba","kyveit_chat","kirgiziya_chatik",
  "kostarika_chat","laos_forum","forum_lithuania","liwan_forum",
  "lihtenshtein_chat","luxembourg_chat","mavrikii","macao_chat",
  "makedoniya_chat","forum_madagascar","forum_maldives","malta_forum",
  "mozambic_chat","monacochat","forum_mongolia","moldova_forum",
  "myanmar_forum","namibiya_chat","nauru_chat","nigeriya_chat",
  "nicaragua_chat","niderland_chat","nepal_forum","forum_norway",
  "oman_forum","pacistan_chat","panama_ru","paragvai_chat",
  "papua_novaia_gvineia","peru_forum","pyerto_riko","ruanda_chat",
  "byharest_chat","sanmarino_chat","salwador_chat","forum_slovenia",
  "slovakiya_chat","surinam_chat","seishelu_forum","sentlusiya",
  "siriya_chat","tadjikistan_chatik","taiwan_forum","forum_tunisia",
  "turcmenistan_chat","Trinidad_i_Tobago","fidji_chat","chili_forum",
  "shwecia_chat","forum_switzerland","ethiopia_chat","yamaika_chat",
  "severnaia_koreia","bagam_chat","butan_chat","bangladesh_chatik",
  "bahrein_chat","barbados_chat","brunei_chat","vanuatu_ru",
];

const keywords = [
  // Dev requests
  "нужен разработчик","ищу разработчик","нужен программист",
  "нужен сайт","нужен бот","нужна автоматизация","ищу фрилансер",
  "looking for developer","need developer","need website",
  "нужен веб","сделать сайт","нужен лендинг","telegram bot",
  "телеграм бот","нужен ai","чат-бот","chatbot","ищу подрядчик",
  "кто делает сайт","hire developer","freelancer needed",
  // Cafe / restaurant / delivery
  "кафе","ресторан","доставка","wolt","bolt food","glovo","яндекс еда",
  "агрегатор","delivery","restaurant","food delivery","меню","заведение",
  "общепит","фастфуд","суши","пицца","бар ","кофейня",
  // CRM / business tools
  "crm","срм","учёт клиентов","база клиентов","автоматизация продаж",
  "управление заказами","онлайн-запись","запись клиентов",
  "loyalty","лояльность","программа лояльности",
];

const results = [];
const sixMonthsAgo = Date.now() / 1000 - (180 * 24 * 3600);

for (const username of chats) {
  try {
    const entity = await client.getEntity(username);
    const msgs = await client.getMessages(entity, { limit: 200 });
    for (const msg of msgs) {
      if (!msg.message || msg.date < sixMonthsAgo) continue;
      const text = msg.message.toLowerCase();
      const matched = keywords.find(kw => text.includes(kw));
      if (matched) {
        results.push({
          chat: username,
          senderId: msg.senderId?.toString(),
          text: msg.message.slice(0, 250),
          date: new Date(msg.date * 1000).toISOString().slice(0, 10),
          keyword: matched,
        });
      }
    }
    process.stderr.write(`✓ ${username}\n`);
  } catch(e) {
    process.stderr.write(`✗ ${username}\n`);
  }
}

console.log(JSON.stringify(results));
await client.disconnect();
