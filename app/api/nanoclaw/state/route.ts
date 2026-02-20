import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.cwd(), 'nanoclaw', 'store', 'messages.db');

function openDb(): Database.Database | null {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    return new Database(DB_PATH, { readonly: true });
  } catch {
    return null;
  }
}

export async function GET() {
  const db = openDb();
  if (!db) {
    return NextResponse.json({
      dbExists: false,
      sessions: 0,
      groups: [],
      taskStats: { total: 0, active: 0, paused: 0, completed: 0 },
    });
  }

  try {
    const sessionsCount = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }).count;

    const groups = db.prepare('SELECT jid, name, folder, trigger_pattern, added_at FROM registered_groups').all();

    const taskStats = {
      total: (db.prepare('SELECT COUNT(*) as count FROM scheduled_tasks').get() as { count: number }).count,
      active: (db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks WHERE status = 'active'").get() as { count: number }).count,
      paused: (db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks WHERE status = 'paused'").get() as { count: number }).count,
      completed: (db.prepare("SELECT COUNT(*) as count FROM scheduled_tasks WHERE status = 'completed'").get() as { count: number }).count,
    };

    db.close();
    return NextResponse.json({
      dbExists: true,
      sessions: sessionsCount,
      groups,
      taskStats,
    });
  } catch {
    db.close();
    return NextResponse.json({
      dbExists: true,
      sessions: 0,
      groups: [],
      taskStats: { total: 0, active: 0, paused: 0, completed: 0 },
    });
  }
}
