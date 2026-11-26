import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, ensureRuntimeDirs } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

ensureRuntimeDirs();

export const db = new DatabaseSync(config.databaseFile);
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

/** Runs a statement and returns every row. */
export function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

/** Runs a statement and returns the first row (or undefined). */
export function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

/** Runs a write statement. */
export function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

/** Wraps a set of writes in a transaction. */
export function transaction(work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Serialises a value for a TEXT column. */
export const toJson = (value) => JSON.stringify(value ?? null);

/** Parses a TEXT column, falling back when the value is empty or corrupt. */
export function fromJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
