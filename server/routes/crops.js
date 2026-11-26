import { Router } from 'express';
import { all, fromJson, get, run, toJson } from '../db/index.js';
import {
  asyncHandler,
  badRequest,
  notFound,
  optionalNumber,
  optionalString,
  requireString,
} from '../lib/http.js';
import { daysBetween, nowISO, todayISO } from '../lib/dates.js';
import { requestLanguage } from '../lib/language.js';
import { buildCropView, getCropRow } from '../services/crops.js';
import { createCropPlan } from '../gemini/planner.js';
import { matchCrop, listCrops } from '../engine/crops.data.js';

export const cropsRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireDate(body, field) {
  const value = requireString(body, field, { max: 10 });
  if (!ISO_DATE.test(value)) throw badRequest(`${field} must be a YYYY-MM-DD date`, { field });
  const today = todayISO();
  if (daysBetween(value, today) < 0) throw badRequest('The planting date cannot be in the future', { field });
  if (daysBetween(value, today) > 730) throw badRequest('That planting date is more than two years ago', { field });
  return value;
}

cropsRouter.get(
  '/library',
  asyncHandler(async (_req, res) => {
    res.json({ crops: listCrops() });
  }),
);

cropsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = all(
      'SELECT * FROM crops WHERE farmer_id = :farmerId ORDER BY (status = :active) DESC, planted_at DESC',
      { farmerId: req.farmer.id, active: 'active' },
    );
    const views = rows.map((row) => buildCropView(row, { includeRecords: false }));
    res.json({ crops: views });
  }),
);

cropsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = requireString(req.body, 'name', { max: 60 });
    const plantedAt = requireDate(req.body, 'plantedAt');
    const variety = optionalString(req.body, 'variety', 60);
    const fieldName = optionalString(req.body, 'fieldName', 60);
    const notes = optionalString(req.body, 'notes', 600);
    const areaSqm = optionalNumber(req.body, 'areaSqm');
    if (areaSqm !== null && (areaSqm <= 0 || areaSqm > 100000)) {
      throw badRequest('Field area must be between 0 and 100000 m²', { field: 'areaSqm' });
    }

    const { plan, source, warning } = await createCropPlan({
      name,
      variety,
      areaSqm,
      plantedAt,
      notes,
      region: req.farmer.region,
    }, requestLanguage(req));

    const expectedDays =
      Number(plan.expectedDaysToHarvest) || matchCrop(name).entry.days || 90;
    const timestamp = nowISO();
    const result = run(
      `INSERT INTO crops (
         farmer_id, name, variety, field_name, area_sqm, planted_at, expected_days,
         planting_notes, status, plan_json, plan_source, created_at, updated_at
       ) VALUES (
         :farmerId, :name, :variety, :fieldName, :areaSqm, :plantedAt, :expectedDays,
         :notes, 'active', :plan, :planSource, :createdAt, :updatedAt
       )`,
      {
        farmerId: req.farmer.id,
        name: plan.cropName || name,
        variety,
        fieldName,
        areaSqm,
        plantedAt,
        expectedDays,
        notes,
        plan: toJson(plan),
        planSource: source,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );

    const row = getCropRow(Number(result.lastInsertRowid), req.farmer.id);
    const view = buildCropView(row);
    res.status(201).json({ ...view, aiWarning: warning ?? null });
  }),
);

cropsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getCropRow(Number(req.params.id), req.farmer.id);
    res.json(buildCropView(row));
  }),
);

cropsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getCropRow(Number(req.params.id), req.farmer.id);
    const fieldName = optionalString(req.body, 'fieldName', 60) ?? row.field_name;
    const variety = optionalString(req.body, 'variety', 60) ?? row.variety;
    const notes = optionalString(req.body, 'notes', 600) ?? row.planting_notes;
    const status = optionalString(req.body, 'status', 20) ?? row.status;
    if (!['active', 'harvested', 'failed'].includes(status)) {
      throw badRequest('Status must be active, harvested or failed', { field: 'status' });
    }

    run(
      `UPDATE crops
          SET field_name = :fieldName, variety = :variety, planting_notes = :notes,
              status = :status, updated_at = :updatedAt
        WHERE id = :id AND farmer_id = :farmerId`,
      { fieldName, variety, notes, status, updatedAt: nowISO(), id: row.id, farmerId: req.farmer.id },
    );

    res.json(buildCropView(getCropRow(row.id, req.farmer.id)));
  }),
);

cropsRouter.post(
  '/:id/replan',
  asyncHandler(async (req, res) => {
    const row = getCropRow(Number(req.params.id), req.farmer.id);
    const { plan, source, warning } = await createCropPlan({
      name: row.name,
      variety: row.variety,
      areaSqm: row.area_sqm,
      plantedAt: row.planted_at,
      notes: row.planting_notes,
      region: req.farmer.region,
    }, requestLanguage(req));

    run(
      `UPDATE crops SET plan_json = :plan, plan_source = :source,
              expected_days = :expectedDays, updated_at = :updatedAt
        WHERE id = :id`,
      {
        plan: toJson(plan),
        source,
        expectedDays: Number(plan.expectedDaysToHarvest) || row.expected_days,
        updatedAt: nowISO(),
        id: row.id,
      },
    );

    res.json({ ...buildCropView(getCropRow(row.id, req.farmer.id)), aiWarning: warning ?? null });
  }),
);

cropsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getCropRow(Number(req.params.id), req.farmer.id);
    run('DELETE FROM crops WHERE id = :id', { id: row.id });
    res.json({ ok: true });
  }),
);

/** The plan sent by the browser when it wants to preview before saving. */
cropsRouter.post(
  '/plan-preview',
  asyncHandler(async (req, res) => {
    const name = requireString(req.body, 'name', { max: 60 });
    const plantedAt = optionalString(req.body, 'plantedAt', 10) ?? todayISO();
    const areaSqm = optionalNumber(req.body, 'areaSqm');
    const { plan, source, warning } = await createCropPlan({
      name,
      variety: optionalString(req.body, 'variety', 60),
      areaSqm,
      plantedAt,
      notes: optionalString(req.body, 'notes', 600),
      region: req.farmer.region,
    }, requestLanguage(req));
    res.json({ plan, source, warning: warning ?? null });
  }),
);

cropsRouter.use((_req, _res, next) => next(notFound('Unknown crop endpoint')));
