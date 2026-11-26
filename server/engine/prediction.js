import { addDays, clamp, daysBetween, round, todayISO } from '../lib/dates.js';
import { expectedWaterForDay, stageForDay } from './plan.js';

/** How many days of records each day of silence costs the health score. */
const MISS_PENALTY_PER_DAY = 2.8;
const STREAK_PENALTY_FACTOR = 2.2;
const MAX_RECORD_PENALTY = 45;
const RECENT_WINDOW_DAYS = 14;

export const HEALTH_STATUSES = [
  { min: 85, key: 'thriving', label: 'Thriving' },
  { min: 70, key: 'healthy', label: 'Healthy' },
  { min: 55, key: 'watch', label: 'Needs watching' },
  { min: 40, key: 'at-risk', label: 'At risk' },
  { min: 0, key: 'critical', label: 'Critical' },
];

export const statusForScore = (score) =>
  HEALTH_STATUSES.find((entry) => score >= entry.min) ?? HEALTH_STATUSES.at(-1);

export const riskForScore = (score) => {
  if (score >= 80) return 'low';
  if (score >= 62) return 'moderate';
  if (score >= 45) return 'high';
  return 'severe';
};

/**
 * Penalty applied for missing daily records.
 * Recent silence and long unbroken streaks are punished hardest, mirroring the
 * idea that undocumented crops hide problems that then compound.
 */
function recordPenalty({ missedRecent, streakMissed, completenessPct }) {
  const streakWeight = Math.pow(Math.max(0, streakMissed - 1), 1.4) * STREAK_PENALTY_FACTOR;
  const gapWeight = missedRecent * MISS_PENALTY_PER_DAY;
  const thinRecordWeight = completenessPct < 60 ? (60 - completenessPct) * 0.18 : 0;
  return Math.min(MAX_RECORD_PENALTY, streakWeight + gapWeight + thinRecordWeight);
}

function scoreAt({ baseHealth, recordsByDate, from, to, cropId: _cropId }) {
  const missedDates = [];
  let missedRecent = 0;
  let streak = 0;
  const days = daysBetween(from, to);
  if (days < 0) return { score: baseHealth, missedDates, streak: 0, missedRecent: 0 };

  for (let offset = 0; offset <= days; offset += 1) {
    const date = addDays(from, offset);
    if (!recordsByDate.has(date)) {
      missedDates.push(date);
      missedRecent += 1;
      streak += 1;
    } else {
      streak = 0;
    }
  }

  const completenessPct = days <= 0 ? 100 : round(((days + 1 - missedRecent) / (days + 1)) * 100);
  const penalty = recordPenalty({ missedRecent, streakMissed: streak, completenessPct });
  return { score: clamp(round(baseHealth - penalty), 5, 100), missedDates, streak, missedRecent };
}

/** Builds a Set of `record_date` values for fast lookups. */
const toDateSet = (records) => new Set(records.map((record) => record.record_date));

/** Health score for a single historical day, used to draw the trend line. */
export function healthOnDate({ crop, plan, records, assessment, date }) {
  const recordsByDate = toDateSet(records.filter((record) => record.record_date <= date));
  const planted = crop.planted_at;
  if (daysBetween(planted, date) < 0) return null;
  const baseHealth = assessment && assessment.created_at.slice(0, 10) <= date ? assessment.health_score : 82;
  const { score } = scoreAt({
    baseHealth,
    recordsByDate,
    from: planted,
    to: date,
    cropId: crop.id,
  });
  return clamp(score, 5, 100);
}

/**
 * The pre-prediction model: combines what the AI last saw with how reliably the
 * farmer has been documenting the field.
 */
export function computePrediction({ crop, plan, records, assessment, today = todayISO() }) {
  const planted = crop.planted_at;
  const expectedDays = Number(crop.expected_days) || plan?.expectedDaysToHarvest || 90;
  const areaSqm = Number(crop.area_sqm) || 1;
  const dayNumber = Math.max(1, daysBetween(planted, today) + 1);
  const recordsByDate = toDateSet(records);

  const observedDays = clamp(dayNumber, 1, expectedDays);
  const windowStart = addDays(planted, Math.max(0, observedDays - RECENT_WINDOW_DAYS));
  const scored = scoreAt({
    baseHealth: assessment ? assessment.health_score : 82,
    recordsByDate,
    from: planted,
    to: today,
    cropId: crop.id,
  });

  const lastRecord = records.length
    ? records.reduce((latest, record) => (record.record_date > latest ? record.record_date : latest), '')
    : null;
  const missingToday = !recordsByDate.has(today);

  // Consecutive missing days up to yesterday — today is still open, so it is
  // reported as "due" rather than as damage.
  let streakMissed = 0;
  for (let offset = 1; offset <= observedDays; offset += 1) {
    const date = addDays(today, -offset);
    if (daysBetween(planted, date) < 0) break;
    if (recordsByDate.has(date)) break;
    streakMissed += 1;
  }

  const logged = records.filter((record) => record.record_date <= today).length;
  const expectedRecords = clamp(dayNumber, 1, expectedDays);
  const completenessPct = clamp(round((logged / expectedRecords) * 100), 0, 100);
  const missedLast14 = addDays(today, -(RECENT_WINDOW_DAYS - 1));
  const missedRecentDates = [];
  for (let offset = RECENT_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    if (daysBetween(planted, date) < 0) continue;
    if (!recordsByDate.has(date)) missedRecentDates.push(date);
  }

  // Staleness: the AI's last observation loses weight as it ages.
  const assessmentDate = assessment ? assessment.created_at.slice(0, 10) : null;
  const daysSinceAssessment = assessmentDate ? daysBetween(assessmentDate, today) : null;
  const staleness = daysSinceAssessment === null ? 0 : clamp((daysSinceAssessment - 3) * 0.7, 0, 12);

  const baseHealth = assessment ? assessment.health_score : 82;
  const healthScore = clamp(round(baseHealth - (baseHealth - scored.score) - staleness), 5, 100);
  const status = statusForScore(healthScore);
  const overdueDays = Math.max(0, dayNumber - expectedDays);
  const damagePercent = clamp(
    round((100 - healthScore) * 0.85 + overdueDays * 1.4 + (assessment?.damage_percent ?? 0) * 0.25),
    0,
    100,
  );

  const harvestDelayDays = clamp(
    round((100 - healthScore) / 10 + streakMissed * 0.9 + (assessment?.category === 'damaged' ? 4 : 0)),
    0,
    28,
  );
  const predictedHarvestDate = addDays(planted, expectedDays + harvestDelayDays);
  const daysToHarvest = daysBetween(today, predictedHarvestDate);

  const required7d = Array.from({ length: 7 }, (_, index) =>
    expectedWaterForDay(plan, Math.max(1, observedDays - index), areaSqm),
  ).reduce((total, value) => total + value, 0);
  const sevenDaysAgo = addDays(today, -6);
  const logged7d = round(
    records
      .filter((record) => record.record_date >= sevenDaysAgo && record.record_date <= today)
      .reduce((total, record) => total + (Number(record.water_liters) || 0), 0),
  );

  const stage = stageForDay(plan, observedDays);
  const nextStage = (plan?.stages ?? []).find((item) => item.startDay > observedDays) ?? null;

  const trend = [];
  for (let offset = 20; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const score = healthOnDate({ crop, plan, records, assessment, date });
    if (score !== null) {
      trend.push({ date, health: score });
    }
  }

  const confidence = clamp(
    round(
      completenessPct * 0.6 +
        (daysSinceAssessment === null ? 0 : Math.max(0, 30 - daysSinceAssessment) * 1) +
        15,
    ),
    20,
    98,
  );

  return {
    today,
    dayNumber,
    expectedDays,
    progressPercent: clamp(round((dayNumber / expectedDays) * 100), 0, 100),
    stage,
    nextStage,
    plantedAt: planted,
    windowStart,
    recordStats: {
      logged,
      expectedRecords,
      completenessPct,
      missingToday,
      streakMissed,
      missedLast14: missedRecentDates.length,
      missedDates: missedRecentDates,
      lastRecordDate: lastRecord || null,
      daysSinceLastRecord: lastRecord ? daysBetween(lastRecord, today) : null,
    },
    water: {
      requiredLast7Days: round(required7d),
      loggedLast7Days: logged7d,
      balancePct: required7d > 0 ? clamp(round((logged7d / required7d) * 100), 0, 300) : 0,
      expectedToday: expectedWaterForDay(plan, observedDays, areaSqm),
    },
    baseHealth,
    recordPenalty: round(baseHealth - healthScore),
    healthScore,
    healthStatus: status.key,
    healthLabel: status.label,
    damagePercent,
    riskLevel: riskForScore(healthScore),
    yieldForecastPct: clamp(round(healthScore - 3 + (assessment?.category === 'healthy' ? 5 : 0)), 10, 100),
    predictedHarvestDate,
    daysToHarvest,
    harvestDelayDays,
    isOverdue: overdueDays > 0,
    overdueDays,
    hasAssessment: Boolean(assessment),
    daysSinceAssessment,
    confidencePct: confidence,
    trend,
  };
}
