import { addDays, clamp, round } from '../lib/dates.js';

/** The canonical verdict categories the UI and the model both understand. */
export const CATEGORIES = ['healthy', 'stressed', 'needs_attention', 'recovering', 'damaged', 'diseased', 'pest'];

export const CATEGORY_LABELS = {
  healthy: 'Healthy',
  stressed: 'Stressed',
  needs_attention: 'Needs attention',
  recovering: 'Recovering',
  damaged: 'Damaged',
  diseased: 'Diseased',
  pest: 'Pest attack',
};

/** Maps a free-form label from the model onto a category. */
export function normalizeCategory(value) {
  const key = String(value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (CATEGORIES.includes(key)) return key;
  if (/disease|fung|blight|rot|mildew|rust|spot/.test(key)) return 'diseased';
  if (/pest|insect|worm|aphid|borer|mite|fly/.test(key)) return 'pest';
  if (/damag|dead|broken|withered|scorched|burnt/.test(key)) return 'damaged';
  if (/recover|healing|improv/.test(key)) return 'recovering';
  if (/stress|wilt|yellow|pale|dry|thirst/.test(key)) return 'stressed';
  if (/need|attention|watch|concern/.test(key)) return 'needs_attention';
  return 'needs_attention';
}

/** Health score implied by a category when the model does not supply one. */
const CATEGORY_BASE_SCORE = {
  healthy: 90,
  recovering: 72,
  stressed: 60,
  needs_attention: 55,
  pest: 45,
  diseased: 40,
  damaged: 32,
};

/** Coerces a raw assessment from Gemini into the stored shape. */
export function normalizeAssessment(raw, { fallbackScore = 70, fallbackLabel = 'Unverified' } = {}) {
  const category = normalizeCategory(raw?.category ?? raw?.condition);
  const score = clamp(
    round(Number(raw?.healthScore ?? raw?.health_score ?? CATEGORY_BASE_SCORE[category] ?? fallbackScore)),
    1,
    100,
  );
  const damage = clamp(
    round(Number(raw?.damagePercent ?? raw?.damage_percent ?? Math.max(0, 100 - score - 10))),
    0,
    100,
  );

  const asList = (value, max = 8) =>
    Array.isArray(value)
      ? value.map((item) => String(item).slice(0, 300)).filter(Boolean).slice(0, max)
      : [];

  return {
    healthScore: score,
    damagePercent: damage,
    category,
    conditionLabel: String(raw?.conditionLabel ?? raw?.condition ?? fallbackLabel).slice(0, 120),
    summary: String(raw?.summary ?? 'No summary returned.').slice(0, 700),
    findings: asList(raw?.findings) || [],
    actions: asList(raw?.actions ?? raw?.recommendedActions),
    diagnosis: Array.isArray(raw?.diagnosis)
      ? raw.diagnosis
          .map((item) => ({
            name: String(item?.name ?? '').slice(0, 120),
            confidence: clamp(round((Number(item?.confidence) || 0) * (Number(item?.confidence) <= 1 ? 100 : 1)), 0, 100),
            treatment: String(item?.treatment ?? '').slice(0, 300),
          }))
          .filter((item) => item.name)
          .slice(0, 6)
      : [],
    riskLevel: score >= 80 ? 'low' : score >= 62 ? 'moderate' : score >= 45 ? 'high' : 'severe',
    urgency: String(raw?.urgency ?? (score < 45 ? 'immediate' : score < 65 ? 'this week' : 'routine')).slice(0, 40),
    expectedRecoveryDays: Number.isFinite(Number(raw?.expectedRecoveryDays)) ? clamp(round(Number(raw.expectedRecoveryDays)), 0, 120) : null,
    stageNote: String(raw?.stageNote ?? '').slice(0, 300),
  };
}

/**
 * Turns an assessment into the specific edits the dashboard should apply —
 * this is how a photo flips a crop from "healthy" to "damaged" in the report.
 */
export function buildReportUpdates({ crop, plan, assessment, previous, today }) {
  const updates = [];
  const push = (field, label, from, to) => updates.push({ field, label, from, to });

  if (previous) {
    if (previous.category !== assessment.category) {
      push('condition', 'Condition', CATEGORY_LABELS[previous.category] ?? previous.category, CATEGORY_LABELS[assessment.category] ?? assessment.category);
    }
    if (Math.abs(previous.health_score - assessment.healthScore) >= 3) {
      push('health', 'Health score', `${previous.health_score}/100`, `${assessment.healthScore}/100`);
    }
    if (Math.abs(previous.damage_percent - assessment.damagePercent) >= 3) {
      push('damage', 'Damage', `${previous.damage_percent}%`, `${assessment.damagePercent}%`);
    }
  } else {
    push('condition', 'Condition baseline', 'unknown', CATEGORY_LABELS[assessment.category] ?? assessment.category);
    push('health', 'Health score', 'untracked', `${assessment.healthScore}/100`);
    push('damage', 'Damage', 'untracked', `${assessment.damagePercent}%`);
  }

  // A damage verdict pushes the harvest window out; a clean verdict can pull it back.
  const expectedDays = Number(crop.expected_days) || plan?.expectedDaysToHarvest || 90;
  const delay = clamp(round((100 - assessment.healthScore) / 12 + (assessment.expectedRecoveryDays ?? 0) * 0.4), 0, 21);
  const harvestFrom = addDays(crop.planted_at, expectedDays);
  const harvestTo = addDays(crop.planted_at, expectedDays + delay);
  if (delay > 0) {
    push('harvest_window', 'Harvest window', harvestFrom, harvestTo);
  }

  if (assessment.category === 'damaged' || assessment.category === 'diseased' || assessment.category === 'pest') {
    push('crop_status', 'Field status', 'on track', 'under treatment');
  } else if (assessment.category === 'healthy' && previous && previous.category !== 'healthy') {
    push('crop_status', 'Field status', 'under treatment', 'on track');
  }

  return { updates, harvestTo, today };
}
