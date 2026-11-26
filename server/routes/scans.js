import { Router } from 'express';
import { all, fromJson, get, run, toJson } from '../db/index.js';
import { ApiError, asyncHandler, badRequest, notFound } from '../lib/http.js';
import { nowISO, todayISO } from '../lib/dates.js';
import { requestLanguage } from '../lib/language.js';
import { buildCropView, getCropRow, insertAssessment } from '../services/crops.js';
import { parseDataUrl, saveImage } from '../services/uploads.js';
import { diagnosePhoto, diagnoseStandalonePhoto } from '../gemini/analyst.js';
import { GeminiError, GeminiUnavailableError } from '../gemini/client.js';
import { buildReportUpdates } from '../engine/report.js';

export const scansRouter = Router();

const GEMINI_HELP = 'Add a GEMINI_API_KEY to the .env file in the project root, then restart the server.';

/** Turns a Gemini failure into an HTTP error the UI can explain. */
function toApiError(error) {
  if (error instanceof GeminiUnavailableError) {
    return new ApiError(503, `Photo diagnosis needs Gemini. ${GEMINI_HELP}`, 'gemini_unavailable');
  }
  if (error instanceof GeminiError) {
    if (error.code === 'invalid_api_key') {
      return new ApiError(502, `Gemini rejected the API key. ${GEMINI_HELP}`, 'gemini_invalid_key');
    }
    if (error.code === 'timeout') {
      return new ApiError(504, 'Gemini took too long to look at the photo. Try a smaller image.', 'gemini_timeout');
    }
    return new ApiError(502, `Gemini could not analyse that photo: ${error.message}`, 'gemini_error');
  }
  return error;
}

function mapScan(row) {
  return {
    id: row.id,
    cropId: row.crop_id,
    createdAt: row.created_at,
    detectedCrop: row.detected_crop,
    healthScore: row.health_score,
    damagePercent: row.damage_percent,
    category: row.category,
    conditionLabel: row.condition_label,
    summary: row.summary,
    stageNote: row.stage_note,
    urgency: row.urgency,
    findings: fromJson(row.findings_json, []),
    actions: fromJson(row.actions_json, []),
    diagnosis: fromJson(row.diagnosis_json, []),
    photoUrl: row.photo_url,
    model: row.model,
  };
}

function saveScan({ farmerId, cropId, detectedCrop, assessment, photoUrl, model }) {
  const result = run(
    `INSERT INTO scans (
       farmer_id, crop_id, created_at, detected_crop, health_score, damage_percent, category,
       condition_label, summary, stage_note, urgency, findings_json, actions_json,
       diagnosis_json, photo_url, model
     ) VALUES (
       :farmerId, :cropId, :createdAt, :detectedCrop, :healthScore, :damagePercent, :category,
       :conditionLabel, :summary, :stageNote, :urgency, :findings, :actions,
       :diagnosis, :photoUrl, :model
     )`,
    {
      farmerId,
      cropId: cropId ?? null,
      createdAt: nowISO(),
      detectedCrop,
      healthScore: assessment.healthScore,
      damagePercent: assessment.damagePercent,
      category: assessment.category,
      conditionLabel: assessment.conditionLabel,
      summary: assessment.summary,
      stageNote: assessment.stageNote,
      urgency: assessment.urgency,
      findings: toJson(assessment.findings),
      actions: toJson(assessment.actions),
      diagnosis: toJson(assessment.diagnosis),
      photoUrl,
      model,
    },
  );
  return get('SELECT * FROM scans WHERE id = :id', { id: Number(result.lastInsertRowid) });
}

/** Applies a verdict to a crop: stores an assessment and reports what changed. */
export function applyAssessmentToCrop({ cropRow, assessment, photoUrl, source, model }) {
  const before = buildCropView(cropRow, { includeRecords: false });
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
    model,
    photoUrl,
  });

  return { updates, assessment: inserted, before };
}

scansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const image = parseDataUrl(req.body?.image);
    if (!image) throw badRequest('Attach a photo to scan', { field: 'image' });

    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null;
    const cropHint = typeof req.body?.cropHint === 'string' ? req.body.cropHint.slice(0, 60) : null;
    const cropId = req.body?.cropId ? Number(req.body.cropId) : null;
    const photoUrl = saveImage(image);

    try {
      if (cropId) {
        const cropRow = getCropRow(cropId, req.farmer.id);
        const before = buildCropView(cropRow, { includeRecords: false });
        const { detectedCrop, assessment } = await diagnosePhoto({
          crop: cropRow,
          plan: before.crop.plan,
          prediction: before.prediction,
          imageBase64: image.base64,
          mimeType: image.mimeType,
          note,
          dayNumber: before.prediction.dayNumber,
        }, requestLanguage(req));

        const applied = applyAssessmentToCrop({
          cropRow,
          assessment,
          photoUrl,
          source: 'photo',
          model: 'gemini',
        });

        const scanRow = saveScan({
          farmerId: req.farmer.id,
          cropId: cropRow.id,
          detectedCrop,
          assessment,
          photoUrl,
          model: 'gemini',
        });

        const view = buildCropView(getCropRow(cropRow.id, req.farmer.id));
        return res.status(201).json({
          scan: mapScan(scanRow),
          detectedCrop,
          reportUpdates: applied.updates,
          crop: view.crop,
          prediction: view.prediction,
          warnings: view.warnings,
          latestAssessment: view.latestAssessment,
        });
      }

      const { detectedCrop, assessment } = await diagnoseStandalonePhoto({
        imageBase64: image.base64,
        mimeType: image.mimeType,
        note,
        cropHint,
      }, requestLanguage(req));

      const scanRow = saveScan({
        farmerId: req.farmer.id,
        cropId: null,
        detectedCrop,
        assessment,
        photoUrl,
        model: 'gemini',
      });

      return res.status(201).json({ scan: mapScan(scanRow), detectedCrop, reportUpdates: [] });
    } catch (error) {
      throw toApiError(error);
    }
  }),
);

scansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = all(
      'SELECT * FROM scans WHERE farmer_id = :farmerId ORDER BY created_at DESC LIMIT 30',
      { farmerId: req.farmer.id },
    );
    res.json({ scans: rows.map(mapScan) });
  }),
);

scansRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = get('SELECT * FROM scans WHERE id = :id AND farmer_id = :farmerId', {
      id: Number(req.params.id),
      farmerId: req.farmer.id,
    });
    if (!row) throw notFound('That scan was not found');
    run('DELETE FROM scans WHERE id = :id', { id: row.id });
    res.json({ ok: true });
  }),
);

/** Attaches an earlier standalone scan to a crop, which pushes the verdict into the report. */
scansRouter.post(
  '/:id/attach',
  asyncHandler(async (req, res) => {
    const scanRow = get('SELECT * FROM scans WHERE id = :id AND farmer_id = :farmerId', {
      id: Number(req.params.id),
      farmerId: req.farmer.id,
    });
    if (!scanRow) throw notFound('That scan was not found');
    if (scanRow.crop_id) throw badRequest('That scan is already attached to a crop');

    const cropRow = getCropRow(Number(req.body?.cropId), req.farmer.id);
    const scan = mapScan(scanRow);

    const assessment = {
      healthScore: scan.healthScore,
      damagePercent: scan.damagePercent,
      category: scan.category,
      conditionLabel: scan.conditionLabel,
      summary: scan.summary,
      stageNote: scan.stageNote ?? '',
      findings: scan.findings,
      actions: scan.actions,
      diagnosis: scan.diagnosis,
      riskLevel: scan.healthScore >= 80 ? 'low' : scan.healthScore >= 62 ? 'moderate' : scan.healthScore >= 45 ? 'high' : 'severe',
      urgency: scan.urgency ?? 'routine',
      expectedRecoveryDays: null,
    };

    const applied = applyAssessmentToCrop({
      cropRow,
      assessment,
      photoUrl: scan.photoUrl,
      source: 'photo',
      model: scan.model,
    });

    run('UPDATE scans SET crop_id = :cropId WHERE id = :id', { cropId: cropRow.id, id: scanRow.id });

    const view = buildCropView(getCropRow(cropRow.id, req.farmer.id));
    res.json({
      ...view,
      reportUpdates: applied.updates,
      scan: { ...scan, cropId: cropRow.id },
    });
  }),
);
