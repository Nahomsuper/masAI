import { Router } from 'express';
import { get, run } from '../db/index.js';
import {
  asyncHandler,
  badRequest,
  notFound,
  optionalNumber,
  optionalString,
} from '../lib/http.js';
import { daysBetween, nowISO, todayISO } from '../lib/dates.js';
import { requestLanguage } from '../lib/language.js';
import {
  buildCropView,
  getCropRow,
  getRecords,
  insertAssessment,
  mapAssessment,
  mapRecord,
} from '../services/crops.js';
import { parseDataUrl, saveImage } from '../services/uploads.js';
import { analyzeRecord } from '../gemini/analyst.js';
import { buildReportUpdates } from '../engine/report.js';

export const recordsRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readRecordDate(body, cropRow) {
  const recordDate = optionalString(body, 'recordDate', 10) ?? todayISO();
  if (!ISO_DATE.test(recordDate)) {
    throw badRequest('Record date must be a YYYY-MM-DD date', { field: 'recordDate' });
  }
  if (daysBetween(recordDate, todayISO()) < 0) {
    throw badRequest('You cannot log a record in the future', { field: 'recordDate' });
  }
  if (daysBetween(cropRow.planted_at, recordDate) < 0) {
    throw badRequest('That date is before this crop was planted', { field: 'recordDate' });
  }
  return recordDate;
}

function readMeasurements(body) {
  const waterLiters = optionalNumber(body, 'waterLiters');
  const growthCm = optionalNumber(body, 'growthCm');
  if (waterLiters !== null && (waterLiters < 0 || waterLiters > 100000)) {
    throw badRequest('Water must be between 0 and 100000 litres', { field: 'waterLiters' });
  }
  if (growthCm !== null && (growthCm < 0 || growthCm > 2000)) {
    throw badRequest('Plant height must be between 0 and 2000 cm', { field: 'growthCm' });
  }
  return { waterLiters, growthCm };
}

function upsertRecord(cropId, payload, photoUrl) {
  const existing = get(
    'SELECT id, photo_url FROM daily_records WHERE crop_id = :cropId AND record_date = :recordDate',
    { cropId, recordDate: payload.recordDate },
  );

  if (existing) {
    run(
      `UPDATE daily_records
          SET water_liters = :waterLiters, growth_cm = :growthCm, leaf_colour = :leafColour,
              soil_moisture = :soilMoisture, pests_seen = :pestsSeen, notes = :notes,
              photo_url = :photoUrl
        WHERE id = :id`,
      {
        waterLiters: payload.waterLiters,
        growthCm: payload.growthCm,
        leafColour: payload.leafColour,
        soilMoisture: payload.soilMoisture,
        pestsSeen: payload.pestsSeen,
        notes: payload.notes,
        photoUrl: photoUrl ?? existing.photo_url,
        id: existing.id,
      },
    );
    return { id: existing.id, created: false, photoUrl: photoUrl ?? existing.photo_url };
  }

  run(
    `INSERT INTO daily_records (
       crop_id, record_date, water_liters, growth_cm, leaf_colour, soil_moisture,
       pests_seen, notes, photo_url, created_at
     ) VALUES (
       :cropId, :recordDate, :waterLiters, :growthCm, :leafColour, :soilMoisture,
       :pestsSeen, :notes, :photoUrl, :createdAt
     )`,
    { ...payload, cropId, photoUrl },
  );

  const created = get(
    'SELECT id FROM daily_records WHERE crop_id = :cropId AND record_date = :recordDate',
    { cropId, recordDate: payload.recordDate },
  );
  return { id: created.id, created: true, photoUrl };
}
recordsRouter.post(
  '/crops/:id/records',
  asyncHandler(async (req, res) => {
    const cropRow = getCropRow(Number(req.params.id), req.farmer.id);
    const recordDate = readRecordDate(req.body, cropRow);
    const { waterLiters, growthCm } = readMeasurements(req.body);
    const image = parseDataUrl(req.body?.image);
    const photoUrl = saveImage(image);

    const payload = {
      recordDate,
      waterLiters,
      growthCm,
      leafColour: optionalString(req.body, 'leafColour', 40),
      soilMoisture: optionalString(req.body, 'soilMoisture', 40),
      pestsSeen: optionalString(req.body, 'pestsSeen', 200),
      notes: optionalString(req.body, 'notes', 1000),
      createdAt: nowISO(),
    };

    const before = buildCropView(cropRow, { includeRecords: false });
    const history = getRecords(cropRow.id, { limit: 7 });
    const saved = upsertRecord(cropRow.id, payload, photoUrl);

    const { assessment, source, warning } = await analyzeRecord({
      crop: cropRow,
      plan: before.crop.plan,
      record: { ...payload, id: saved.id },
      prediction: before.prediction,
      history,
    }, requestLanguage(req));

    const { updates, harvestTo } = buildReportUpdates({
      crop: cropRow,
      plan: before.crop.plan,
      assessment,
      previous: before.latestAssessment,
      today: todayISO(),
    });

    const inserted = insertAssessment({
      cropId: cropRow.id,
      source,
      assessment,
      reportUpdates: updates,
      predictedHarvest: harvestTo,
      model: source === 'gemini' ? 'gemini' : 'local-rules',
      photoUrl,
    });

    const freshRow = getCropRow(cropRow.id, req.farmer.id);
    const after = buildCropView(freshRow);
    const storedRecord = get(
      'SELECT * FROM daily_records WHERE crop_id = :cropId AND record_date = :recordDate',
      { cropId: cropRow.id, recordDate },
    );

    res.status(saved.created ? 201 : 200).json({
      ...after,
      record: mapRecord(storedRecord),
      assessment: mapAssessment(inserted),
      reportUpdates: updates,
      aiSource: source,
      aiWarning: warning ?? null,
    });
  }),
);

recordsRouter.get(
  '/crops/:id/records',
  asyncHandler(async (req, res) => {
    const cropRow = getCropRow(Number(req.params.id), req.farmer.id);
    const view = buildCropView(cropRow);
    res.json({ records: view.records, prediction: view.prediction });
  }),
);

recordsRouter.delete(
  '/crops/:cropId/records/:recordId',
  asyncHandler(async (req, res) => {
    const cropRow = getCropRow(Number(req.params.cropId), req.farmer.id);
    const record = get('SELECT * FROM daily_records WHERE id = :id AND crop_id = :cropId', {
      id: Number(req.params.recordId),
      cropId: cropRow.id,
    });
    if (!record) throw notFound('That record was not found');
    run('DELETE FROM daily_records WHERE id = :id', { id: record.id });
    res.json(buildCropView(getCropRow(cropRow.id, req.farmer.id)));
  }),
);
