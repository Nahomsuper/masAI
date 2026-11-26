import { Router } from 'express';
import { all, get } from '../db/index.js';
import { asyncHandler } from '../lib/http.js';
import { addDays, todayISO } from '../lib/dates.js';
import { buildCropView } from '../services/crops.js';
import { buildFarmAlerts } from '../engine/warnings.js';
import { isGeminiReady } from '../gemini/client.js';

export const dashboardRouter = Router();

const average = (values) =>
  values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = todayISO();
    const cropRows = all(
      'SELECT * FROM crops WHERE farmer_id = :farmerId ORDER BY (status = :active) DESC, planted_at DESC',
      { farmerId: req.farmer.id, active: 'active' },
    );

    const views = cropRows.map((row) => buildCropView(row, { today, includeRecords: false }));
    const active = views.filter((view) => view.crop.status === 'active');
    const alerts = buildFarmAlerts(active, 14);

    const weekAgo = addDays(today, -6);
    const recordsThisWeek = get(
      `SELECT COUNT(*) AS total
         FROM daily_records r
         JOIN crops c ON c.id = r.crop_id
        WHERE c.farmer_id = :farmerId AND r.record_date >= :weekAgo`,
      { farmerId: req.farmer.id, weekAgo },
    );

    const pendingToday = active
      .filter((view) => view.prediction.recordStats.missingToday)
      .map((view) => ({
        cropId: view.crop.id,
        name: view.crop.name,
        fieldName: view.crop.fieldName,
        dayNumber: view.prediction.dayNumber,
        streakMissed: view.prediction.recordStats.streakMissed,
        waterTarget: view.prediction.water.expectedToday,
        stage: view.prediction.stage?.label ?? null,
        healthScore: view.prediction.healthScore,
        topSeverity: view.topSeverity,
      }));

    const scores = active.map((view) => view.prediction.healthScore);
    const atRisk = active.filter((view) => view.prediction.healthScore < 60).length;
    const highestDamage = active.reduce(
      (worst, view) => (view.prediction.damagePercent > worst ? view.prediction.damagePercent : worst),
      0,
    );

    res.json({
      today,
      farmer: req.farmer,
      aiConfigured: isGeminiReady(),
      summary: {
        activeCrops: active.length,
        totalCrops: views.length,
        averageHealth: average(scores),
        atRiskCrops: atRisk,
        highestDamagePercent: highestDamage,
        recordsThisWeek: recordsThisWeek?.total ?? 0,
        pendingRecords: pendingToday.length,
        criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
      },
      alerts,
      pendingToday,
      crops: views,
    });
  }),
);
