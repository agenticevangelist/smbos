// Вступаем в новые группы чтобы попасть в entity cache
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 });

const GROUPS_FILE = '/tmp/cs_groups_v3.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Фильтр: пропускаем явно нерелевантные (маркетплейсы, курьеры, доставка сервисы)
const SKIP_KEYWORDS = ['wb_', 'wildberries', 'ozon', 'kurier', 'galaktika_eda', 'goa_eda', 
  'dostavka_eda', 'edanayradly', 'eda_dostavk', 'tojikon_wb', 'ml_market',
  'marketplace_ozon', 'rr_market', 'bukhonin', 'kalmykia', 'maykop',
  'churchil', 'doterrа', 'terra', 'doterra', 'investbzkz', 'investicii',
  'impact_usa', 'finansist', 'usbiznetwork', 'mmdocprep', 'miaminet',
  'sociallogiq', 'Marketing_Blog', 'biznesdvigusa', 'biznesdvizh',
  'podslushka_kur', 'glovo_krakow', 'kurierwroclaw', 'kurierkrakow',
  'blogmorozova', 'olga_bizness', 'langea', 'online_business_falcon',
  'tadjiyeva', 'onlayn_biznes', 'onlayn_biznesh', 'onlayn_biznesh'];

async function main() {
  const groups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  
  // Загружаем entity cache чтобы знать что уже вступили
  let entityCache = {};
  try { entityCache = JSON.parse(fs.readFileSync('/tmp/cs_entity_cache.json', 'utf8')); } catch {}
  const cached = new Set(Object.keys(entityCache).map(k => k.toLowerCase()));
  
  const toJoin = groups.filter(g => {
    const u = g.u?.toLowerCase() || '';
    if (cached.has(u)) return false; // уже есть
    if (SKIP_KEYWORDS.some(k => u.includes(k.toLowerCase()))) return false; // нерелевантные
    return true;
  });
  
  console.log(`Нужно вступить: ${toJoin.length} групп (из ${groups.length} всего)`);
  console.log('Начинаю (пауза 3 сек между каждой)...\n');
  
  await client.connect();
  let joined = 0, failed = 0;
  
  for (const grp of toJoin.slice(0, 100)) { // максимум 100 за раз
    try {
      await client.invoke(new Api.channels.JoinChannel({
        channel: grp.u
      }));
      joined++;
      console.log(`✅ @${grp.u} (${grp.members} чел)`);
    } catch(e) {
      if (e.message?.includes('FLOOD_WAIT')) {
        const w = parseInt(e.message.match(/\d+/)?.[0] || '60');
        console.log(`⏳ FLOOD_WAIT ${w}s — жду...`);
        await sleep(w * 1000 + 1000);
        // повторяем
        try {
          await client.invoke(new Api.channels.JoinChannel({ channel: grp.u }));
          joined++;
          console.log(`✅ @${grp.u} (retry OK)`);
        } catch { failed++; }
      } else if (e.message?.includes('USER_ALREADY_PARTICIPANT')) {
        joined++; // уже там
      } else if (e.message?.includes('INVITE_REQUEST_SENT')) {
        console.log(`📬 @${grp.u} — запрос отправлен (закрытая группа)`);
      } else {
        failed++;
        console.log(`❌ @${grp.u} — ${e.message?.slice(0, 50)}`);
      }
    }
    await sleep(3000); // 3 сек между вступлениями
  }
  
  console.log(`\nИтог: вступил ${joined}, ошибок ${failed}`);
  console.log('Перезапусти continuous_search чтобы обновить entity cache');
  
  await client.disconnect();
}

main().catch(console.error);
