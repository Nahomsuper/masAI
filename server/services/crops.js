import { all, fromJson, get, run, toJson } from '../db/index.js';
import { nowISO, todayISO } from '../lib/dates.js';
import { computePrediction } from '../engine/prediction.js';
import { buildWarnings } from '../engine/warnings.js';
import { notFound } from '../lib/http.js';

/** Maps a `crops` row into the API shape. */
export function mapCrop(row) {
  return {
    id: row.id,
    name: row.name,
    variety: row.variety,
    fieldName: row.field_name,
    areaSqm: row.area_sqm,
    plantedAt: row.planted_at,
    expectedDays: row.expected_days,
    notes: row.planting_notes,
    status: row.status,
    plan: fromJson(row.plan_json, {}),
    planSource: row.plan_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Maps a `daily_records` row into the API shape. */
export function mapRecord(row) {
  return {
    id: row.id,
    cropId: row.crop_id,
    recordDate: row.record_date,
    waterLiters: row.water_liters,
    growthCm: row.growth_cm,
    leafColour: row.leaf_colour,
    soilMoisture: row.soil_moisture,
    pestsSeen: row.pests_seen,
    notes: row.notes,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  };
}

/** Maps an `assessments` row into the API shape. */
export function mapAssessment(row) {
  if (!row) return null;
  return {
    id: row.id,
    cropId: row.crop_id,
    source: row.source,
    createdAt: row.created_at,
    healthScore: row.health_score,
    conditionLabel: row.condition_label,
    category: row.category,
    damagePercent: row.damage_percent,
    riskLevel: row.risk_level,
    summary: row.summary,
    findings: fromJson(row.findings_json, []),
    actions: fromJson(row.actions_json, []),
    diagnosis: fromJson(row.diagnosis_json, []),
    predictedHarvest: row.predicted_harvest,
    reportUpdates: fromJson(row.report_updates_json, []),
    model: row.model,
    photoUrl: row.photo_url,
  };
}

export const getCropRow = (cropId, farmerId) => {
  const row = get('SELECT * FROM crops WHERE id = :id AND farmer_id = :farmerId', {
    id: cropId,
    farmerId,
  });
  if (!row) throw notFound('That crop was not found on your farm');
  return row;
};

export const getRecords = (cropId, { limit = 400 } = {}) =>
  all(
    'SELECT * FROM daily_records WHERE crop_id = :cropId ORDER BY record_date DESC LIMIT :limit',
    { cropId, limit },
  );

export const getAssessments = (cropId, { limit = 40 } = {}) =>
  all('SELECT * FROM assessments WHERE crop_id = :cropId ORDER BY created_at DESC LIMIT :limit', {
    cropId,
    limit,
  });

/** Builds the full per-crop view: crop, records, assessments, prediction and warnings. */
export function buildCropView(cropRow, { today = todayISO(), includeRecords = true } = {}) {
  const records = getRecords(cropRow.id).reverse();
  const assessmentRows = getAssessments(cropRow.id);
  const latest = assessmentRows[0] ?? null;
  const plan = fromJson(cropRow.plan_json, {});
  const prediction = computePrediction({
    crop: cropRow,
    plan,
    records,
    assessment: latest,
    today,
  });
  const { warnings, topSeverity } = buildWarnings({
    crop: cropRow,
    plan,
    prediction,
    records,
    assessment: latest,
    today,
  });

  return {
    crop: mapCrop(cropRow),
    prediction,
    warnings,
    topSeverity,
    latestAssessment: mapAssessment(latest),
    assessments: assessmentRows.slice(0, 12).map(mapAssessment),
    records: includeRecords ? records.slice(-45).map(mapRecord).reverse() : [],
  };
}

/** Inserts an assessment row and returns it. */
export function insertAssessment({
  cropId,
  source,
  assessment,
  reportUpdates,
  predictedHarvest,
  model,
  photoUrl,
  createdAt = nowISO(),
}) {
  const result = run(
    `INSERT INTO assessments (
       crop_id, source, created_at, health_score, condition_label, category, damage_percent,
       risk_level, summary, findings_json, actions_json, diagnosis_json, predicted_harvest,
       report_updates_json, model, photo_url
     ) VALUES (
       :cropId, :source, :createdAt, :healthScore, :conditionLabel, :category, :damagePercent,
       :riskLevel, :summary, :findings, :actions, :diagnosis, :predictedHarvest,
       :reportUpdates, :model, :photoUrl
     )`,
    {
      cropId,
      source,
      createdAt,
      healthScore: assessment.healthScore,
      conditionLabel: assessment.conditionLabel,
      category: assessment.category,
      damagePercent: assessment.damagePercent,
      riskLevel: assessment.riskLevel,
      summary: assessment.summary,
      findings: toJson(assessment.findings),
      actions: toJson(assessment.actions),
      diagnosis: toJson(assessment.diagnosis),
      predictedHarvest: predictedHarvest ?? null,
      reportUpdates: toJson(reportUpdates ?? []),
      model: model ?? source,
      photoUrl: photoUrl ?? null,
    },
  );
  return get('SELECT * FROM assessments WHERE id = :id', { id: Number(result.lastInsertRowid) });
}
