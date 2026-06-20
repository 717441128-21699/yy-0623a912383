import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export interface MaterialBatch {
  id?: number;
  material_type: '钢筋原材' | '混凝土试块' | '防水材料';
  batch_no: string;
  quantity: number;
  furnace_no?: string;
  represent_quantity: number;
  sampling_location: string;
  entry_date: string;
  status: '待取样' | '已取样待送检' | '已送检待报告' | '可用' | '待处置' | '禁止使用';
  created_at?: string;
}

export interface SamplingRecord {
  id?: number;
  batch_id: number;
  sample_no: string;
  witness_supervisor: string;
  sealing_photo?: string;
  testing_agency: string;
  sampling_date: string;
  is_sent: number;
  sent_date?: string;
  deadline_date: string;
  created_at?: string;
}

export interface TestReport {
  id?: number;
  batch_id: number;
  sampling_id: number;
  report_no: string;
  conclusion: '合格' | '不合格';
  unqualified_items?: string;
  report_date: string;
  created_at?: string;
}

let db: Database;
let SQL: initSqlJs.SqlJsStatic;
let dbFilePath: string;

function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (e) {
    console.error('保存数据库失败:', e);
  }
}

export async function initDatabase() {
  SQL = await initSqlJs();
  const userDataPath = app.getPath('userData');
  dbFilePath = path.join(userDataPath, 'material_inspection.db');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    const buf = fs.readFileSync(dbFilePath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS material_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_type TEXT NOT NULL CHECK(material_type IN ('钢筋原材', '混凝土试块', '防水材料')),
      batch_no TEXT NOT NULL,
      quantity REAL NOT NULL,
      furnace_no TEXT,
      represent_quantity REAL NOT NULL,
      sampling_location TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '待取样' CHECK(status IN ('待取样', '已取样待送检', '已送检待报告', '可用', '待处置', '禁止使用')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sampling_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      sample_no TEXT NOT NULL,
      witness_supervisor TEXT NOT NULL,
      sealing_photo TEXT,
      testing_agency TEXT NOT NULL,
      sampling_date TEXT NOT NULL,
      is_sent INTEGER NOT NULL DEFAULT 0,
      sent_date TEXT,
      deadline_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS test_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      sampling_id INTEGER NOT NULL,
      report_no TEXT NOT NULL,
      conclusion TEXT NOT NULL CHECK(conclusion IN ('合格', '不合格')),
      unqualified_items TEXT,
      report_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  saveDb();
  return db;
}

export function getDb() {
  return db;
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as any);
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | null {
  const result = queryAll(sql, params);
  return result.length > 0 ? result[0] : null;
}

function runSql(sql: string, params: any[] = []) {
  db.run(sql, params);
  saveDb();
}

export const batchQueries = {
  getAll: (): MaterialBatch[] => queryAll('SELECT * FROM material_batches ORDER BY created_at DESC') as MaterialBatch[],
  getByStatus: (status: string): MaterialBatch[] =>
    queryAll('SELECT * FROM material_batches WHERE status = ? ORDER BY created_at DESC', [status]) as MaterialBatch[],
  getById: (id: number): MaterialBatch | null =>
    queryOne('SELECT * FROM material_batches WHERE id = ?', [id]) as MaterialBatch | null,
  create: (data: Omit<MaterialBatch, 'id' | 'created_at' | 'status'>): number => {
    const stmt = db.prepare(
      `INSERT INTO material_batches 
      (material_type, batch_no, quantity, furnace_no, represent_quantity, sampling_location, entry_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, '待取样')`
    );
    stmt.run([
      data.material_type,
      data.batch_no,
      data.quantity,
      data.furnace_no || null,
      data.represent_quantity,
      data.sampling_location,
      data.entry_date,
    ]);
    stmt.free();
    saveDb();
    const result = queryOne('SELECT last_insert_rowid() as id') as any;
    return result.id;
  },
  updateStatus: (id: number, status: string) => {
    runSql('UPDATE material_batches SET status = ? WHERE id = ?', [status, id]);
  },
  delete: (id: number) => {
    runSql('DELETE FROM sampling_records WHERE batch_id = ?', [id]);
    runSql('DELETE FROM test_reports WHERE batch_id = ?', [id]);
    runSql('DELETE FROM material_batches WHERE id = ?', [id]);
  },
};

export const samplingQueries = {
  getAll: (): any[] => queryAll(`
    SELECT s.*, m.material_type, m.batch_no, m.sampling_location 
    FROM sampling_records s 
    LEFT JOIN material_batches m ON s.batch_id = m.id
    ORDER BY s.created_at DESC
  `),
  getByBatchId: (batchId: number): SamplingRecord[] =>
    queryAll('SELECT * FROM sampling_records WHERE batch_id = ? ORDER BY created_at DESC', [batchId]) as SamplingRecord[],
  getPendingSend: (): any[] => queryAll(`
    SELECT s.*, m.material_type, m.batch_no, m.sampling_location 
    FROM sampling_records s 
    LEFT JOIN material_batches m ON s.batch_id = m.id
    WHERE s.is_sent = 0
    ORDER BY s.sampling_date DESC
  `),
  getOverdue: (): any[] => queryAll(`
    SELECT s.*, m.material_type, m.batch_no, m.sampling_location 
    FROM sampling_records s 
    LEFT JOIN material_batches m ON s.batch_id = m.id
    WHERE s.is_sent = 0 AND date(s.deadline_date) < date('now', 'localtime')
    ORDER BY s.deadline_date ASC
  `),
  getById: (id: number): SamplingRecord | null =>
    queryOne('SELECT * FROM sampling_records WHERE id = ?', [id]) as SamplingRecord | null,
  create: (data: Omit<SamplingRecord, 'id' | 'created_at'>): number => {
    const stmt = db.prepare(`INSERT INTO sampling_records 
      (batch_id, sample_no, witness_supervisor, sealing_photo, testing_agency, sampling_date, is_sent, sent_date, deadline_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run([
      data.batch_id,
      data.sample_no,
      data.witness_supervisor,
      data.sealing_photo || null,
      data.testing_agency,
      data.sampling_date,
      data.is_sent,
      data.sent_date || null,
      data.deadline_date,
    ]);
    stmt.free();
    saveDb();
    const result = queryOne('SELECT last_insert_rowid() as id') as any;
    return result.id;
  },
  markAsSent: (id: number, sentDate: string) => {
    runSql('UPDATE sampling_records SET is_sent = 1, sent_date = ? WHERE id = ?', [sentDate, id]);
  },
};

export const reportQueries = {
  getAll: (): any[] => queryAll(`
    SELECT r.*, m.material_type, m.batch_no, s.sample_no
    FROM test_reports r
    LEFT JOIN material_batches m ON r.batch_id = m.id
    LEFT JOIN sampling_records s ON r.sampling_id = s.id
    ORDER BY r.created_at DESC
  `),
  getByBatchId: (batchId: number): TestReport[] =>
    queryAll('SELECT * FROM test_reports WHERE batch_id = ? ORDER BY created_at DESC', [batchId]) as TestReport[],
  getById: (id: number): TestReport | null =>
    queryOne('SELECT * FROM test_reports WHERE id = ?', [id]) as TestReport | null,
  create: (data: Omit<TestReport, 'id' | 'created_at'>): number => {
    const stmt = db.prepare(`INSERT INTO test_reports 
      (batch_id, sampling_id, report_no, conclusion, unqualified_items, report_date)
      VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run([
      data.batch_id,
      data.sampling_id,
      data.report_no,
      data.conclusion,
      data.unqualified_items || null,
      data.report_date,
    ]);
    stmt.free();
    saveDb();
    const result = queryOne('SELECT last_insert_rowid() as id') as any;
    return result.id;
  },
};
