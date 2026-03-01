import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import fs from 'fs';

const session = new StringSession(fs.readFileSync('store/session2.txt','utf8').trim());
const client = new TelegramClient(session, 33887530, 'fc51f19b4b6ff9f0b8cbd5c4005e9ee4', { connectionRetries: 3 });
await client.connect();
const me = await client.getMe();
console.log(`ID: ${me.id}, username: @${me.username}, name: ${me.firstName} ${me.lastName||''}, phone: ${me.phone}`);
await client.disconnect();
