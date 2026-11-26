import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

/** Loads .env from the project root, falling back to server/.env. */
function loadEnvFiles() {
  const candidates = [path.join(serverDir, '.env'), path.join(serverDir, '..', '.env')];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}
loadEnvFiles();

/** @type {string} */
const dataDir = process.env.MASAI_DATA_DIR
  ? path.resolve(process.env.MASAI_DATA_DIR)
  : path.join(serverDir, 'data');

/** Absolute path of an env value, defaulting when unset. */
const optional = (value) => (value && value.trim() ? value.trim() : undefined);

export const config = {
  port: Number(process.env.PORT ?? 3001),
  dataDir,
  uploadsDir: path.join(dataDir, 'uploads'),
  databaseFile: path.join(dataDir, 'masai.db'),
  gemini: {
    apiKey: optional(process.env.GEMINI_API_KEY) ?? optional(process.env.VITE_GEMINI_API_KEY),
    model: optional(process.env.GEMINI_MODEL) ?? 'gemini-2.5-flash',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 60000),
  },
  sessionDays: 30,
};

export function ensureRuntimeDirs() {
  for (const dir of [config.dataDir, config.uploadsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const isGeminiConfigured = () => Boolean(config.gemini.apiKey);
