import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'crypto';

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3001';
const DB_PATH = path.join(process.cwd(), 'skills', 'whatsapp-campaign', 'data', 'campaigns.db');

function getDb(): Database.Database {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      template_name TEXT NOT NULL,
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS campaign_messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      sent_at TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );
    CREATE TABLE IF NOT EXISTS scheduled_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      template_name TEXT NOT NULL,
      recipients TEXT NOT NULL,
      restaurant_names TEXT,
      scheduled_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      campaign_id TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      executed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      variables TEXT,
      category TEXT DEFAULT 'outreach',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Spintax processor: [option1|option2|option3] → randomly picks one
function processSpintax(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, (_, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return processSpintax(rendered);
}

async function sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resp = await axios.post(`${BRIDGE_URL}/send-message`, { to: phone, message }, { timeout: 60000 });
    return { success: resp.data.success, messageId: resp.data.message_id };
  } catch (err: any) {
    return { success: false, error: err.response?.data?.error || err.message };
  }
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min) * 1000;
}

export async function execute(params: any) {
  const db = getDb();

  try {
    // Templates tab
    if (params.templateAction === 'list') {
      const templates = db.prepare('SELECT * FROM templates WHERE is_active = 1 ORDER BY created_at DESC').all();
      return {
        rows: (templates as any[]).map((t: any) => ({
          id: t.id, name: t.name, content: t.content,
          variables: t.variables || '', category: t.category, createdAt: t.created_at,
        })),
      };
    }

    // History tab
    if (params.historyAction) {
      if (params.historyAction === 'list') {
        const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 50').all();
        return {
          rows: (campaigns as any[]).map((c: any) => ({
            id: c.id, name: c.name || '', status: c.status,
            total: c.total_recipients, sent: c.sent_count, failed: c.failed_count,
            template: c.template_name, createdAt: c.created_at, finishedAt: c.finished_at || '',
          })),
        };
      }

      if (params.historyAction === 'messages' && params.campaignId) {
        const messages = db.prepare('SELECT * FROM campaign_messages WHERE campaign_id = ? ORDER BY sent_at DESC').all(params.campaignId);
        return {
          rows: (messages as any[]).map((m: any) => ({
            id: m.id, phone: m.phone, status: m.status,
            error: m.error || '', sentAt: m.sent_at || '',
          })),
        };
      }

      if (params.historyAction === 'cancel' && params.campaignId) {
        db.prepare('UPDATE campaigns SET status = ? WHERE id = ? AND status IN (?, ?)').run('cancelled', params.campaignId, 'pending', 'running');
        return { rows: [{ status: 'success', message: `Campaign ${params.campaignId} cancelled` }] };
      }

      if (params.historyAction === 'list_scheduled') {
        const scheduled = db.prepare('SELECT * FROM scheduled_campaigns ORDER BY scheduled_time DESC LIMIT 50').all();
        return {
          rows: (scheduled as any[]).map((s: any) => ({
            id: s.id, name: s.name || '', status: s.status,
            template: s.template_name, scheduledTime: s.scheduled_time,
            total: JSON.parse(s.recipients || '[]').length,
            createdAt: s.created_at, executedAt: s.executed_at || '',
          })),
        };
      }

      if (params.historyAction === 'cancel_scheduled' && params.campaignId) {
        db.prepare('UPDATE scheduled_campaigns SET status = ? WHERE id = ? AND status = ?').run('cancelled', params.campaignId, 'pending');
        return { rows: [{ status: 'success', message: `Scheduled campaign ${params.campaignId} cancelled` }] };
      }
    }

    // Schedule tab
    if (params.scheduledTime) {
      const schedTime = new Date(params.scheduledTime);
      if (schedTime <= new Date()) throw new Error('Scheduled time must be in the future');

      let recipients: string[];
      try { recipients = typeof params.schedRecipients === 'string' ? JSON.parse(params.schedRecipients) : params.schedRecipients; }
      catch { throw new Error('Invalid recipients JSON'); }
      if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('Recipients array is required');

      const id = generateId();
      db.prepare(`INSERT INTO scheduled_campaigns (id, name, template_name, recipients, restaurant_names, scheduled_time)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        id, params.campaignName || '', params.schedTemplateName,
        JSON.stringify(recipients), params.schedRestaurantNames || '{}', params.scheduledTime
      );

      return {
        rows: [{
          id, name: params.campaignName || '', status: 'pending',
          total: recipients.length, scheduledTime: params.scheduledTime,
          createdAt: new Date().toISOString(),
        }],
      };
    }

    // Send campaign tab (default)
    if (params.templateName || params.recipients) {
      const templateName = params.templateName;
      if (!templateName) throw new Error('Template name is required');

      let recipients: string[];
      try { recipients = typeof params.recipients === 'string' ? JSON.parse(params.recipients) : params.recipients; }
      catch { throw new Error('Invalid recipients JSON'); }
      if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('Recipients array is required');
      if (recipients.length > 1000) throw new Error('Maximum 1000 recipients per campaign');

      let restaurantNames: Record<string, string> = {};
      try { restaurantNames = params.restaurantNames ? (typeof params.restaurantNames === 'string' ? JSON.parse(params.restaurantNames) : params.restaurantNames) : {}; }
      catch { /* ignore */ }

      // Get template
      const template = db.prepare('SELECT * FROM templates WHERE name = ? AND is_active = 1').get(templateName) as any;
      const templateContent = template?.content || `Hello! We'd like to offer our services to {restaurant_name}. Contact us for details.`;

      // Create campaign
      const campaignId = generateId();
      db.prepare('INSERT INTO campaigns (id, name, template_name, total_recipients, status) VALUES (?, ?, ?, ?, ?)').run(
        campaignId, `Campaign ${new Date().toISOString().slice(0, 10)}`, templateName, recipients.length, 'running'
      );

      // Send messages
      const spreadHours = params.spreadOverHours || 0;
      const baseDelay = spreadHours > 0 ? (spreadHours * 3600000) / recipients.length : 0;
      let sentCount = 0, failCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const phone = recipients[i].replace(/[^0-9+]/g, '');
        const restName = restaurantNames[phone.replace('+', '')] || restaurantNames[phone] || '';
        const message = renderTemplate(templateContent, { restaurant_name: restName, phone });

        const result = await sendMessage(phone, message);
        const msgId = generateId();

        db.prepare('INSERT INTO campaign_messages (id, campaign_id, phone, message, status, error, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          msgId, campaignId, phone, message, result.success ? 'sent' : 'failed', result.error || null, new Date().toISOString()
        );

        if (result.success) sentCount++; else failCount++;

        // Rate limiting
        if (i < recipients.length - 1) {
          const delay = baseDelay > 0 ? baseDelay * (0.8 + Math.random() * 0.4) : randomDelay(12, 18);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      db.prepare('UPDATE campaigns SET sent_count = ?, failed_count = ?, status = ?, finished_at = ? WHERE id = ?').run(
        sentCount, failCount, 'completed', new Date().toISOString(), campaignId
      );

      return {
        rows: [{
          id: campaignId, name: `Campaign ${new Date().toISOString().slice(0, 10)}`,
          status: 'completed', total: recipients.length, sent: sentCount, failed: failCount,
          createdAt: new Date().toISOString(),
        }],
      };
    }

    // Default: show campaign list
    const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 20').all();
    return {
      rows: (campaigns as any[]).map((c: any) => ({
        id: c.id, name: c.name || '', status: c.status,
        total: c.total_recipients, sent: c.sent_count, failed: c.failed_count,
        createdAt: c.created_at,
      })),
    };
  } finally {
    db.close();
  }
}
