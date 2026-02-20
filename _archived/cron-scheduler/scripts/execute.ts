import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'skills', 'sqlite-manager', 'data');
const DB_PATH = path.join(DATA_DIR, 'smbos.db');

function getDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      skillId TEXT NOT NULL,
      params TEXT DEFAULT '{}',
      cronExpression TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      lastRun TEXT,
      nextRun TEXT
    )
  `);
  return db;
}

function calculateNextRun(cronExpr: string): string {
  try {
    // Dynamic import for cron-parser
    const cronParser = require('cron-parser');
    const interval = cronParser.parseExpression(cronExpr);
    return interval.next().toISOString();
  } catch {
    return 'Invalid cron expression';
  }
}

export async function execute(params: any) {
  const { action = 'list', skillId, params: skillParams, label, cronExpression, enabled = true, scheduleId } = params;

  const db = getDb();

  try {
    switch (action) {
      case 'list': {
        const schedules = db.prepare('SELECT * FROM cron_schedules ORDER BY createdAt DESC').all() as any[];
        const rows = schedules.map(s => ({
          ...s,
          enabled: s.enabled ? 'Yes' : 'No',
          nextRun: s.enabled ? calculateNextRun(s.cronExpression) : 'Disabled',
        }));
        return { rows, rowCount: rows.length };
      }

      case 'create': {
        if (!skillId) throw new Error('Skill ID is required');
        if (!cronExpression) throw new Error('Cron expression is required');
        if (!label) throw new Error('Schedule name is required');

        // Validate cron expression
        const nextRun = calculateNextRun(cronExpression);
        if (nextRun === 'Invalid cron expression') {
          throw new Error('Invalid cron expression. Format: Minute Hour Day Month Weekday');
        }

        let paramsStr = '{}';
        if (skillParams) {
          try {
            paramsStr = typeof skillParams === 'string' ? skillParams : JSON.stringify(skillParams);
            JSON.parse(paramsStr); // validate
          } catch {
            throw new Error('Invalid parameters JSON');
          }
        }

        const result = db.prepare(
          'INSERT INTO cron_schedules (label, skillId, params, cronExpression, enabled, nextRun) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(label, skillId, paramsStr, cronExpression, enabled ? 1 : 0, nextRun);

        return {
          rows: [{
            id: result.lastInsertRowid,
            label,
            skillId,
            cronExpression,
            enabled: enabled ? 'Yes' : 'No',
            nextRun,
            message: 'Schedule created successfully',
          }],
          rowCount: 1,
        };
      }

      case 'delete': {
        if (!scheduleId) throw new Error('Schedule ID is required for delete');
        const result = db.prepare('DELETE FROM cron_schedules WHERE id = ?').run(scheduleId);
        return {
          rows: [{
            message: result.changes > 0
              ? `Schedule #${scheduleId} deleted successfully`
              : `Schedule #${scheduleId} not found`,
            changes: result.changes,
          }],
          rowCount: 1,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    db.close();
  }
}
