import crypto from 'node:crypto';
import { get, run } from '../db/index.js';
import { unauthorized } from './http.js';
import { config } from '../config.js';
import { nowISO } from './dates.js';

const SCRYPT_KEY_LENGTH = 64;

/** Hashes a PIN with a per-user random salt. */
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/** Verifies a PIN against a stored `scrypt:salt:hash` string. */
export function verifyPin(pin, stored) {
  const [scheme, salt, digest] = String(stored ?? '').split(':');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const derived = crypto.scryptSync(pin, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(digest, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/** Creates a session row and returns its bearer token. */
export function createSession(farmerId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + config.sessionDays);
  run(
    'INSERT INTO sessions (token, farmer_id, created_at, expires_at) VALUES (:token, :farmerId, :createdAt, :expiresAt)',
    { token, farmerId, createdAt: nowISO(), expiresAt: expires.toISOString() },
  );
  return token;
}

/** Authenticates a request from the `Authorization: Bearer <token>` header. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return next(unauthorized());

  const row = get(
    `SELECT s.token, s.expires_at, f.id, f.name, f.phone, f.region
       FROM sessions s
       JOIN farmers f ON f.id = s.farmer_id
      WHERE s.token = :token`,
    { token },
  );

  if (!row) return next(unauthorized('Your session has expired'));
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token = :token', { token });
    return next(unauthorized('Your session has expired'));
  }

  req.farmer = { id: row.id, name: row.name, phone: row.phone, region: row.region };
  req.token = token;
  return next();
}
