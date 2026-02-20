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
    return NextResponse.json({ tasks: [], runLogs: [] });
  }

  try {
    const tasks = db.prepare(
      'SELECT * FROM scheduled_tasks ORDER BY created_at DESC'
    ).all();

    const runLogs = db.prepare(
      'SELECT * FROM task_run_logs ORDER BY run_at DESC LIMIT 100'
    ).all();

    db.close();
    return NextResponse.json({ tasks, runLogs });
  } catch {
    db.close();
    return NextResponse.json({ tasks: [], runLogs: [] });
  }
}
