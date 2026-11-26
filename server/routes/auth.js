import { Router } from 'express';
import { get, run } from '../db/index.js';
import { asyncHandler, badRequest, optionalString, requireString } from '../lib/http.js';
import { createSession, hashPin, requireAuth, verifyPin } from '../lib/auth.js';
import { nowISO } from '../lib/dates.js';

export const authRouter = Router();

const normalizePhone = (value) => value.replace(/[^\d+]/g, '');

function validatePin(pin) {
  if (!/^\d{4,8}$/.test(pin)) throw badRequest('PIN must be 4 to 8 digits', { field: 'pin' });
  return pin;
}

const publicFarmer = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  region: row.region,
  createdAt: row.created_at,
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = requireString(req.body, 'name', { max: 80 });
    const phone = normalizePhone(requireString(req.body, 'phone', { max: 20 }));
    const pin = validatePin(requireString(req.body, 'pin', { max: 8 }));
    const region = optionalString(req.body, 'region', 80);

    if (phone.length < 7) throw badRequest('Enter a valid phone number', { field: 'phone' });

    const existing = get('SELECT id FROM farmers WHERE phone = :phone', { phone });
    if (existing) throw badRequest('That phone number is already registered', { field: 'phone' });

    const result = run(
      `INSERT INTO farmers (name, phone, pin_hash, region, created_at)
       VALUES (:name, :phone, :pinHash, :region, :createdAt)`,
      { name, phone, pinHash: hashPin(pin), region, createdAt: nowISO() },
    );

    const farmer = get('SELECT * FROM farmers WHERE id = :id', { id: Number(result.lastInsertRowid) });
    const token = createSession(farmer.id);
    res.status(201).json({ token, farmer: publicFarmer(farmer) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(requireString(req.body, 'phone', { max: 20 }));
    const pin = requireString(req.body, 'pin', { max: 8 });

    const farmer = get('SELECT * FROM farmers WHERE phone = :phone', { phone });
    if (!farmer || !verifyPin(pin, farmer.pin_hash)) {
      throw badRequest('Phone number or PIN is incorrect', { field: 'pin' });
    }

    const token = createSession(farmer.id);
    res.json({ token, farmer: publicFarmer(farmer) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const farmer = get('SELECT * FROM farmers WHERE id = :id', { id: req.farmer.id });
    res.json({ farmer: publicFarmer(farmer) });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    run('DELETE FROM sessions WHERE token = :token', { token: req.token });
    res.json({ ok: true });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const name = optionalString(req.body, 'name', 80) ?? req.farmer.name;
    const region = optionalString(req.body, 'region', 80) ?? req.farmer.region;
    run('UPDATE farmers SET name = :name, region = :region WHERE id = :id', {
      name,
      region,
      id: req.farmer.id,
    });
    const farmer = get('SELECT * FROM farmers WHERE id = :id', { id: req.farmer.id });
    res.json({ farmer: publicFarmer(farmer) });
  }),
);
