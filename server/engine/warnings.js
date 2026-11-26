import { daysBetween, todayISO } from '../lib/dates.js';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Rule-based early warnings. Each rule looks at the crop's record hygiene,
 * water balance and the last AI observation, so problems surface before the
 * farmer can see them in the field.
 */
export function buildWarnings({ crop, plan, prediction, records, assessment, today = todayISO() }) {
  const warnings = [];
  const add = (warning) => warnings.push({ cropId: crop.id, cropName: crop.name, ...warning });
  const { recordStats, water } = prediction;

  if (recordStats.missingToday) {
    add({
      id: `${crop.id}-missing-today`,
      code: 'record_missing_today',
      severity: 'medium',
      title: `No record logged for ${crop.name} today`,
      detail: `The model treats today as unverified. Every blank day lowers the health estimate for this crop.`,
      action: 'Add today’s record',
      dueBy: today,
    });
  }

  if (recordStats.streakMissed >= 2) {
    add({
      id: `${crop.id}-streak`,
      code: 'record_streak',
      severity: recordStats.streakMissed >= 4 ? 'critical' : 'high',
      title: `${recordStats.streakMissed} days without a record`,
      detail: `Unrecorded stress compounds: the predicted health for ${crop.name} has already dropped ${prediction.recordPenalty} points purely from missing data.`,
      action: 'Log a record and re-scan with a photo',
    });
  }

  if (!prediction.hasAssessment) {
    add({
      id: `${crop.id}-never-scanned`,
      code: 'no_baseline',
      severity: 'high',
      title: 'No AI baseline for this crop yet',
      detail: 'Without a photo scan the system is guessing health from records alone. A baseline locks in the real condition.',
      action: 'Scan a photo to create a baseline',
    });
  } else if ((prediction.daysSinceAssessment ?? 0) >= 7) {
    add({
      id: `${crop.id}-stale-scan`,
      code: 'stale_assessment',
      severity: 'low',
      title: `Last AI check was ${prediction.daysSinceAssessment} days ago`,
      detail: 'Visual condition changes faster than records show. A fresh photo keeps the prediction honest.',
      action: 'Scan a fresh photo',
    });
  }

  if (assessment && ['damaged', 'diseased', 'pest'].includes(assessment.category)) {
    add({
      id: `${crop.id}-damaged`,
      code: 'damage_detected',
      severity: 'critical',
      title: `${assessment.condition_label} detected`,
      detail: assessment.summary,
      action: assessment.actions?.length ? 'Follow the treatment steps' : 'Treat immediately',
    });
  }

  if (water.balancePct > 0 && water.balancePct < 70) {
    add({
      id: `${crop.id}-water-low`,
      code: 'water_deficit',
      severity: water.balancePct < 45 ? 'high' : 'medium',
      title: `Water is ${100 - water.balancePct}% below target`,
      detail: `Records show ${water.loggedLast7Days} L against a ${water.requiredLast7Days} L requirement for the last 7 days.`,
      action: `Irrigate about ${water.expectedToday} L today`,
    });
  }

  if (water.balancePct > 145) {
    add({
      id: `${crop.id}-water-high`,
      code: 'water_excess',
      severity: 'medium',
      title: 'Possible over-watering',
      detail: `Records show ${water.loggedLast7Days} L against a ${water.requiredLast7Days} L target. Soggy roots invite rot.`,
      action: 'Skip irrigation today and check drainage',
    });
  }

  if (prediction.isOverdue) {
    add({
      id: `${crop.id}-overdue`,
      code: 'past_harvest_window',
      severity: prediction.overdueDays > 10 ? 'high' : 'medium',
      title: `${prediction.overdueDays} days past the expected harvest`,
      detail: `The plan expected ${crop.name} to be ready around day ${prediction.expectedDays}. Inspect the field for ripeness before quality drops.`,
      action: 'Inspect and harvest what is ready',
    });
  } else if (prediction.daysToHarvest >= 0 && prediction.daysToHarvest <= 5) {
    add({
      id: `${crop.id}-harvest-soon`,
      code: 'harvest_window',
      severity: 'info',
      title: `Harvest window opens in ${prediction.daysToHarvest} day${prediction.daysToHarvest === 1 ? '' : 's'}`,
      detail: (plan?.harvestSigns ?? []).join(' • ') || 'Check ripeness signs daily from now.',
      action: 'Prepare crates and labour',
    });
  }

  if (prediction.healthScore < 60 && !recordStats.missingToday) {
    add({
      id: `${crop.id}-low-health`,
      code: 'low_health',
      severity: prediction.healthScore < 45 ? 'critical' : 'high',
      title: `Predicted health is ${prediction.healthScore}/100`,
      detail: `The model projects ${prediction.damagePercent}% damage and a ${prediction.harvestDelayDays}-day delay if nothing changes.`,
      action: 'Scan a photo and act on the findings',
    });
  }

  const sorted = warnings.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
  return { warnings: sorted, topSeverity: sorted[0]?.severity ?? 'none' };
}

/** Rolls per-crop warnings into a farm-level alert feed. */
export function buildFarmAlerts(cropsWithWarnings, limit = 12) {
  const flat = cropsWithWarnings.flatMap((item) => item.warnings);
  return flat
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, limit);
}

export const severityWeight = (severity) => SEVERITY_ORDER[severity] ?? 9;

/** Days since the crop was planted, exposed for the demo seeder. */
export const cropAge = (crop, today = todayISO()) => daysBetween(crop.planted_at, today) + 1;
