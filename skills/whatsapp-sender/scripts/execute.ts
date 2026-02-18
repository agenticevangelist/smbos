import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(process.cwd(), 'skills', 'whatsapp-sender', '.auth');

export async function execute(params: any) {
  const { phone, message, mode = 'single', delay = 3 } = params;

  if (!phone) throw new Error('Phone number is required');
  if (!message) throw new Error('Message is required');

  // Check if baileys is available
  let makeWASocket: any;
  let useMultiFileAuthState: any;
  let DisconnectReason: any;

  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
  } catch {
    throw new Error('WhatsApp library not available. Make sure @whiskeysockets/baileys is installed.');
  }

  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Check if we have existing auth
  const hasAuth = fs.existsSync(path.join(AUTH_DIR, 'creds.json'));

  if (!hasAuth) {
    return {
      status: 'needs_auth',
      message: 'WhatsApp authentication required. Please run the WhatsApp authentication setup first by connecting via QR code. Run the following command in your terminal:\n\ncd skills/whatsapp-sender && npx ts-node auth-setup.ts',
      instructions: [
        '1. Open a terminal in the project root',
        '2. Authentication will be saved for future use',
        '3. Once authenticated, try sending the message again',
      ],
    };
  }

  // Parse phone numbers
  const phones = mode === 'broadcast'
    ? phone.split(',').map((p: string) => p.trim().replace(/[^0-9+]/g, ''))
    : [phone.trim().replace(/[^0-9+]/g, '')];

  const results: Array<{ phone: string; status: string; error?: string }> = [];

  // Connect to WhatsApp
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
    sock.ev.on('connection.update', (update: any) => {
      if (update.connection === 'open') {
        clearTimeout(timeout);
        resolve();
      }
      if (update.connection === 'close') {
        clearTimeout(timeout);
        reject(new Error('Connection closed. You may need to re-authenticate.'));
      }
    });
  });

  try {
    for (const phoneNum of phones) {
      const cleanNum = phoneNum.replace('+', '');
      const jid = `${cleanNum}@s.whatsapp.net`;

      try {
        await sock.sendMessage(jid, { text: message });
        results.push({ phone: phoneNum, status: 'sent' });
      } catch (err: any) {
        results.push({ phone: phoneNum, status: 'failed', error: err.message });
      }

      // Delay between messages in broadcast mode
      if (mode === 'broadcast' && phones.indexOf(phoneNum) < phones.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }
  } finally {
    sock.end(undefined);
  }

  const successCount = results.filter(r => r.status === 'sent').length;
  const failCount = results.filter(r => r.status === 'failed').length;

  return {
    results,
    successCount,
    failCount,
    totalSent: phones.length,
    message: `Sent ${successCount}/${phones.length} messages successfully.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
  };
}
