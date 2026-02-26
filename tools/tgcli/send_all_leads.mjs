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
const dialogs = await client.getDialogs({ limit: 400 });

// Базовый оффер
const BASE = `Привет! Меня зовут Давид, занимаюсь ростом delivery под ключ.

Помогаю кафе и ресторанам: аудит + анализ конкурентов, оптимизация меню, продвижение на Wolt/Glovo/Bolt (реклама, промо, видимость), настройка CRM и программы лояльности.

Работаю разово или помесячно. Если актуально — расскажу подробнее!`;

// Для dark kitchen / новых точек
const MSG_DARK = `Привет! Меня зовут Давид, занимаюсь запуском и ведением delivery под ключ.

Видел что открываете новую точку — как раз вовремя. Помогаю с нуля: регистрация на Wolt/Glovo/Bolt, меню, фото, продвижение, CRM и лояльность. Запускаем правильно с первого дня.

Если интересно — пообщаемся!`;

// Для уже работающих кафе/ресторанов
const MSG_ACTIVE = `Привет! Меня зовут Давид, помогаю кафе и ресторанам расти на агрегаторах доставки.

Делаю: аудит меню и конкурентов, оптимизацию на Wolt/Glovo/Bolt, рекламу и промо, настройку CRM и программы лояльности.

Работаю разово или помесячно. Если актуально — расскажу подробнее!`;

// Лиды с username — отправляем напрямую
const USERNAME_LEADS = [
  // Тбилиси
  { username: "pause_ge",        msg: MSG_ACTIVE, label: "Pause.ge" },
  { username: "AndeiKrut",       msg: MSG_DARK,   label: "Андрей (новое кафе Ваке)" },
  { username: "iamamst",         msg: MSG_ACTIVE, label: "Ресторан грузинской кухни Тбилиси" },
  { username: "lida_may",        msg: MSG_ACTIVE, label: "Dessert Ballet" },
  { username: "alex_work_tbi",   msg: MSG_ACTIVE, label: "Кофейня Сабуртало" },
  { username: "MaryUvar",        msg: MSG_ACTIVE, label: "Спешелти кофейни" },
  { username: "askensenko",      msg: MSG_ACTIVE, label: "Рюмочная Старый город" },
  // Батуми
  { username: "FBzzzz22",        msg: MSG_ACTIVE, label: "2 паба Батуми" },
  { username: "smirnovskayaa",   msg: MSG_ACTIVE, label: "CloudSpace lounge bar" },
  { username: "MagariFoodBatumi",msg: MSG_ACTIVE, label: "МАГАРИ шашлычная" },
  { username: "KazakOlga",       msg: MSG_ACTIVE, label: "Ресторан Patelnya" },
  { username: "nikkagogua",      msg: MSG_ACTIVE, label: "Кафе Батуми" },
  { username: "evgeIla",         msg: MSG_ACTIVE, label: "Кафе Батуми evgella" },
  { username: "Il026lI",         msg: MSG_ACTIVE, label: "Ресторан Батуми круглый год" },
  { username: "nastya_solod",    msg: MSG_ACTIVE, label: "Кофейня SAGE Батуми" },
  { username: "Zaramea123",      msg: MSG_ACTIVE, label: "Суши-бар Батуми" },
  { username: "ArtGeo1",         msg: MSG_ACTIVE, label: "Кафе Олива Батуми" },
  { username: "yula_shwkvch",    msg: MSG_ACTIVE, label: "Кафе Tangerine Батуми" },
  // Гудаури
  { username: "gudauri_express", msg: MSG_ACTIVE, label: "GudauriExpress доставка" },
  // Москва
  { username: "nikita3666",      msg: MSG_DARK,   label: "Dark kitchen Москва" },
  { username: "dashtahir",       msg: MSG_ACTIVE, label: "Гастробар Виновные" },
  { username: "dshaizer",        msg: MSG_ACTIVE, label: "Кафе вьетнамской кухни ВДНХ" },
  { username: "MMmmarine",       msg: MSG_ACTIVE, label: "Кафе-лофт Сингулярность" },
];

// Лиды без username — ищем через группу ВАКАНСИИ Грузия
const GROUP_LEADS = [
  { groupId: "-1001519678828", senderId: "7388766648",  msg: MSG_ACTIVE, label: "Точка доставки Тбилиси (SMM)" },
  { groupId: "-1001519678828", senderId: "8230401233",  msg: MSG_DARK,   label: "Новый ресторан у вокзала Тбилиси" },
  { groupId: "-1001519678828", senderId: "751197728",   msg: MSG_DARK,   label: "Новая кофейня Тбилиси" },
  { groupId: "-1001519678828", senderId: "6475861087",  msg: MSG_ACTIVE, label: "Babá bakery Тбилиси" },
  { groupId: "-1001519678828", senderId: "273732713",   msg: MSG_ACTIVE, label: "Итальянский ресторан Тбилиси" },
  { groupId: "-1001519678828", senderId: "8011460560",  msg: MSG_ACTIVE, label: "Beernest Тбилиси" },
];

const results = [];

// --- Отправка по username ---
for (const lead of USERNAME_LEADS) {
  try {
    const entity = await client.getEntity(lead.username);
    await client.sendMessage(entity, { message: lead.msg });
    results.push({ ok: true, label: lead.label, username: lead.username });
    console.log(JSON.stringify({ ok: true, label: lead.label, to: "@" + lead.username }));
  } catch(e) {
    results.push({ ok: false, label: lead.label, error: e.message.slice(0, 80) });
    console.log(JSON.stringify({ error: e.message.slice(0, 80), label: lead.label }));
  }
  await new Promise(r => setTimeout(r, 1500));
}

// --- Отправка через группу ---
const groups = {};
for (const lead of GROUP_LEADS) {
  if (!groups[lead.groupId]) {
    const g = dialogs.find(d => '-100' + d.entity?.id?.toString() === lead.groupId);
    if (g) {
      groups[lead.groupId] = await client.getMessages(g.entity, { limit: 500 });
    }
  }

  const msgs = groups[lead.groupId];
  if (!msgs) { console.log(JSON.stringify({ error: "group not found", label: lead.label })); continue; }

  const msg = msgs.find(m => m.senderId?.toString() === lead.senderId);
  if (!msg) { console.log(JSON.stringify({ error: "sender not found in group", label: lead.label })); continue; }

  try {
    const sender = await client.getEntity(msg.senderId);
    await client.sendMessage(msg.senderId, { message: lead.msg });
    const name = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
    results.push({ ok: true, label: lead.label, name });
    console.log(JSON.stringify({ ok: true, label: lead.label, to: name, username: sender.username }));
  } catch(e) {
    results.push({ ok: false, label: lead.label, error: e.message.slice(0, 80) });
    console.log(JSON.stringify({ error: e.message.slice(0, 80), label: lead.label }));
  }
  await new Promise(r => setTimeout(r, 1500));
}

const sent = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(JSON.stringify({ summary: true, sent, failed, total: results.length }));

await client.disconnect();
