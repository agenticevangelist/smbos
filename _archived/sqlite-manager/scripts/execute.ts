import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'skills', 'sqlite-manager', 'data');

function sanitizeDbName(name: string): string {
  // Prevent path traversal
  const sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '');
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new Error('Invalid database name');
  }
  return sanitized.endsWith('.db') ? sanitized : sanitized + '.db';
}

function getDb(dbName: string): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const dbPath = path.join(DATA_DIR, sanitizeDbName(dbName));
  return new Database(dbPath);
}

export async function execute(params: any) {
  const { database = 'smbos.db', query, action, tableName } = params;

  // Table operations mode
  if (action && action !== 'query') {
    const db = getDb(database);
    try {
      if (action === 'list_tables') {
        const tables = db.prepare("SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name").all();
        return {
          rows: tables,
          columns: [{ key: 'name', header: 'Table Name' }, { key: 'type', header: 'Type' }],
          rowCount: tables.length,
        };
      }

      if (action === 'describe_table') {
        if (!tableName) throw new Error('Table name is required for describe');
        const columns = db.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all();
        return {
          rows: columns,
          columns: [
            { key: 'name', header: 'Column' },
            { key: 'type', header: 'Type' },
            { key: 'notnull', header: 'Not Null' },
            { key: 'dflt_value', header: 'Default' },
            { key: 'pk', header: 'Primary Key' },
          ],
          rowCount: columns.length,
        };
      }
    } finally {
      db.close();
    }
  }

  // Query mode
  if (!query) {
    throw new Error('SQL query is required');
  }

  const db = getDb(database);
  try {
    const trimmed = query.trim();
    const isSelect = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);

    if (isSelect) {
      const rows = db.prepare(trimmed).all();
      return {
        rows,
        rowCount: rows.length,
      };
    } else {
      const result = db.prepare(trimmed).run();
      return {
        rows: [{
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid),
          message: `Query executed successfully. ${result.changes} row(s) affected.`,
        }],
        rowCount: 1,
      };
    }
  } finally {
    db.close();
  }
}
