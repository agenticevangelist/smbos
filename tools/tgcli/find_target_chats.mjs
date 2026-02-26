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

// Targeted usernames to check
const targets = [
  // HoReCa / рестораны
  "restoratorclub", "horeca_chat", "horeca_russia", "horeca_pro",
  "restoran_biznes", "restorator_chat", "cafe_business", "food_business_ru",
  "restorannyj_biznes", "restorany_rf", "horeca_georgia", "horeca_tbilisi",
  "foodbiznes", "food_startup", "catering_chat",
  // Доставка / агрегаторы
  "wolt_partners", "wolt_couriers", "delivery_business", "food_delivery_ru",
  "aggregator_food", "dostavka_biznes", "wolt_georgia", "bolt_food_partners",
  "glovo_partners", "yandex_eda_partners", "delivery_partners",
  // Предприниматели
  "biznes_chat", "predprinimateli", "entrepreneur_ru", "biznes_ru_chat",
  "startup_russia", "biznes_gruziya", "predprinimateli_georgia",
  "biznes_tbilisi", "entrepreneur_georgia", "business_georgia",
  "maliy_biznes", "biznes_online", "predprin_chat",
  // Разработка / заказчики
  "freelance_ru", "zakazat_sajt", "freelance_dev", "web_zakazchiki",
  "it_freelance_ru", "freelance_georgia", "razrabotka_chat",
  "need_developer", "zakazchiki_ru", "web_studio_chat",
  // AI / автоматизация
  "ai_business", "ai_automation_ru", "chatgpt_biznes", "ai_tools_ru",
  "automation_chat", "no_code_ru", "nocode_chat",
];

const found = [];

for (const username of targets) {
  try {
    const entity = await client.getEntity(username);
    const info = {
      username,
      title: entity.title || entity.firstName,
      type: entity.className,
      members: entity.participantsCount || '?',
    };
    found.push(info);
    process.stderr.write(`✓ @${username} — "${info.title}" (${info.members} участников)\n`);
  } catch(e) {
    process.stderr.write(`✗ @${username}\n`);
  }
}

console.log(JSON.stringify(found));
await client.disconnect();
