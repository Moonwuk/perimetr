import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {chmodSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

type Row = Record<string, unknown>;
type Result<T> = {success: true; results: T[]; meta: {changes: number; last_row_id: number; duration: number}};

/** The D1 subset used by the shared production room and metrics routes. */
class SqliteStatement {
 readonly owner: SqliteDatabase;
 readonly sql: string;
 readonly values: SQLInputValue[];
 constructor(owner: SqliteDatabase, sql: string, values: SQLInputValue[] = []) { this.owner = owner; this.sql = sql; this.values = values; }
 bind(...values: unknown[]): SqliteStatement {
  const bound = values.map(value => {
   if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || value instanceof Uint8Array) return value;
   if (value instanceof ArrayBuffer) return new Uint8Array(value);
   throw new TypeError('Unsupported database binding');
  });
  return new SqliteStatement(this.owner, this.sql, bound);
 }
 async first<T = Row>(column?: string): Promise<T | null> {
  const row = this.owner.connection.prepare(this.sql).get(...this.values);
  if (!row) return null;
  if (column !== undefined) {
   if (!Object.hasOwn(row, column)) throw new Error('Unknown result column');
   return row[column] as T;
  }
  return {...row} as T;
 }
 async all<T = Row>(): Promise<Result<T>> { return this.execute<T>('all'); }
 async run<T = Row>(): Promise<Result<T>> { return this.execute<T>('run'); }
 execute<T>(mode: 'all' | 'run' | 'batch'): Result<T> {
  const started = performance.now(), statement = this.owner.connection.prepare(this.sql);
  const rows = mode === 'all' || (mode === 'batch' && statement.columns().length > 0);
  if (rows) return {success: true, results: statement.all(...this.values).map(row => ({...row}) as T), meta: {changes: 0, last_row_id: 0, duration: performance.now() - started}};
  const result = statement.run(...this.values);
  return {success: true, results: [], meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid), duration: performance.now() - started}};
 }
}

export class SqliteDatabase {
 readonly connection: DatabaseSync;
 constructor(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  this.connection = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  this.connection.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
 }
 prepare(sql: string): SqliteStatement { return new SqliteStatement(this, sql); }
 /** There is deliberately no await between BEGIN and COMMIT. Requests cannot interleave. */
 async batch<T = Row>(statements: SqliteStatement[]): Promise<Result<T>[]> {
  if (statements.some(statement => !(statement instanceof SqliteStatement) || statement.owner !== this)) throw new TypeError('Batch statements must belong to this database');
  this.connection.exec('BEGIN IMMEDIATE');
  try {
   const results = statements.map(statement => statement.execute<T>('batch'));
   this.connection.exec('COMMIT');
   return results;
  } catch (error) {
   this.connection.exec('ROLLBACK');
   throw error;
  }
 }
 migrate(directory: string): string[] {
  const files = readdirSync(directory).filter(file => /^\d+_[\w-]+\.sql$/.test(file)).sort();
  if (!files.length) throw new Error('No database migrations found');
  this.connection.exec('CREATE TABLE IF NOT EXISTS _perimeter_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const applied: string[] = [];
  // All pending migrations are committed together. Failed startup leaves no partial schema.
  this.connection.exec('BEGIN IMMEDIATE');
  try {
   for (const file of files) {
    const sql = readFileSync(join(directory, file), 'utf8'), checksum = createHash('sha256').update(sql).digest('hex');
    const previous = this.connection.prepare('SELECT checksum FROM _perimeter_migrations WHERE name = ?').get(file);
    if (previous) {
     if (previous.checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
     continue;
    }
    this.connection.exec(sql);
    this.connection.prepare('INSERT INTO _perimeter_migrations (name, checksum, applied_at) VALUES (?, ?, ?)').run(file, checksum, Date.now());
    applied.push(file);
   }
   this.connection.exec('COMMIT');
   return applied;
  } catch (error) {
   this.connection.exec('ROLLBACK');
   throw error;
  }
 }
 close(): void { this.connection.close(); }
}
