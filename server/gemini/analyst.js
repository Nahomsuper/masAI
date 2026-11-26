import { normalizeAssessment } from '../engine/report.js';
import { stageForDay } from '../engine/plan.js';
import { languageRule } from '../lib/language.js';
import { generateJson } from './client.js';

const ANALYST_SYSTEM = `You are MasAI, an agronomist watching a smallholder field in East Africa.
You receive the crop plan, the stage the plant is in, the farmer's daily record and the
recent history. Judge the crop's real condition from the evidence, and be blunt when the
evidence points to damage. Never invent observations the farmer did not report.
Answer with JSON only.`;

const PHOTO_SYSTEM = `You are MasAI's vision agronomist. You look at a photo of a crop in an East
African smallholder field and describe exactly what is visible: leaf colour, lesions, wilting,
holes, insects, fruit condition, soil condition. Identify diseases and pests only when the visual
evidence supports it, and give a calibrated confidence. If the photo does not show a plant,
say so instead of guessing. Answer with JSON only.`;

const RECORD_SCHEMA = `Return JSON:
{
  "healthScore": integer 1-100,
  "damagePercent": integer 0-100,
  "category": one of ["healthy","stressed","needs_attention","recovering","damaged","diseased","pest"],
  "conditionLabel": short verdict, e.g. "Mild water stress" (max 60 chars),
  "summary": 2-3 sentences explaining the verdict from the record (max 400 chars),
  "stageNote": one sentence about whether this is normal for the stage (max 200 chars),
  "findings": [string] (2-5 concrete observations drawn from the record),
  "actions": [string] (2-4 ordered things to do today or in the next 2 days),
  "urgency": "immediate" | "this week" | "routine",
  "expectedRecoveryDays": integer,
  "diagnosis": [{ "name": string, "confidence": number 0-1, "treatment": string }]
}`;

const PHOTO_SCHEMA = `Return JSON:
{
  "detectedCrop": string (what plant you actually see, or "not a crop"),
  "healthScore": integer 1-100,
  "damagePercent": integer 0-100,
  "category": one of ["healthy","stressed","needs_attention","recovering","damaged","diseased","pest"],
  "conditionLabel": short verdict, e.g. "Early blight on lower leaves" (max 60 chars),
  "summary": 2-3 sentences on what you see and what it means for the harvest (max 400 chars),
  "stageNote": one sentence on whether this condition is expected at this stage (max 200 chars),
  "findings": [string] (3-6 concrete visual observations, say where on the plant),
  "actions": [string] (3-5 ordered treatments or checks),
  "urgency": "immediate" | "this week" | "routine",
  "expectedRecoveryDays": integer,
  "diagnosis": [{ "name": string, "confidence": number 0-1, "treatment": string }] (max 4)
}`;

const historyLines = (history) =>
  history.length
    ? history
        .map(
          (item) =>
            `  ${item.record_date}: water ${item.water_liters ?? '-'}L, leaves ${item.leaf_colour ?? '-'}, soil ${item.soil_moisture ?? '-'}, pests ${item.pests_seen ?? '-'}${item.notes ? `, notes "${item.notes}"` : ''}`,
        )
        .join('\n')
    : '  no earlier records';

function recordPrompt({ crop, plan, record, prediction, history }) {
  const stage = stageForDay(plan, prediction.dayNumber);
  return `CROP: ${crop.name}${crop.variety ? ` (${crop.variety})` : ''}
PLANTED: ${crop.planted_at} - today is growth day ${prediction.dayNumber} of ${prediction.expectedDays}
CURRENT STAGE: ${stage?.label ?? 'unknown'} - ${stage?.focus ?? ''}
WATER TARGET TODAY: about ${prediction.water.expectedToday} litres for the whole field

FARMER RECORD FOR ${record.record_date}
  water given: ${record.water_liters ?? 'not recorded'} L
  plant height: ${record.growth_cm ?? 'not recorded'} cm
  leaf colour: ${record.leaf_colour ?? 'not recorded'}
  soil moisture: ${record.soil_moisture ?? 'not recorded'}
  pests seen: ${record.pests_seen ?? 'none reported'}
  free notes: ${record.notes ?? 'none'}

MODEL STATE BEFORE THIS RECORD
  predicted health ${prediction.healthScore}/100, record completeness ${prediction.recordStats.completenessPct}%,
  ${prediction.recordStats.streakMissed} consecutive days missing, water balance ${prediction.water.balancePct}% of target

LAST 7 RECORDS
${historyLines(history)}

${RECORD_SCHEMA}`;
}

function photoPrompt({ crop, plan, prediction, note, dayNumber }) {
  const stage = stageForDay(plan, dayNumber);
  return `CROP: ${crop.name}${crop.variety ? ` (${crop.variety})` : ''}, growth day ${dayNumber} of ${prediction.expectedDays}
STAGE: ${stage?.label ?? 'unknown'} - normal signs to watch at this stage: ${(stage?.watchFor ?? []).join('; ') || 'none listed'}
FIELD: ${crop.area_sqm ? `${crop.area_sqm} m2` : 'size unknown'}, ${crop.field_name || 'unnamed field'}
MODEL STATE BEFORE THIS PHOTO: predicted health ${prediction.healthScore}/100, damage ${prediction.damagePercent}%, ${prediction.recordStats.streakMissed} days without a record
FARMER NOTE: ${note || 'none'}

Look at the attached photo, then answer.
${PHOTO_SCHEMA}`;
}
/**
 * Deterministic assessment built from the values the farmer typed.
 * Used when Gemini is not configured so the daily loop still closes, and labelled
 * `local-rules` so nobody mistakes it for a vision model.
 */
function localRecordAssessment({ plan, record, prediction }) {
  const findings = [];
  const actions = [];
  let score = 84;

  const leaf = String(record.leaf_colour ?? '').toLowerCase();
  if (/yellow|pale/.test(leaf)) {
    score -= 14;
    findings.push('Leaves reported as yellow or pale, a classic sign of nitrogen or water stress.');
    actions.push('Side-dress with nitrogen and check the irrigation line for blockages.');
  } else if (/brown|dry|scorch|wilt/.test(leaf)) {
    score -= 24;
    findings.push('Leaves reported brown, dry or wilting, which points to water stress or root damage.');
    actions.push('Water deeply this evening and shade the plants if the heat continues.');
  } else if (/dark green|healthy/.test(leaf)) {
    score += 4;
    findings.push('Leaf colour reported as healthy and even.');
  }

  const pests = String(record.pests_seen ?? '').toLowerCase();
  if (pests && !/^(none|no|nothing|0)?$/.test(pests)) {
    score -= 20;
    findings.push(`Pests reported: ${record.pests_seen}.`);
    actions.push('Scout the field at dusk, remove what you can by hand and treat the rest.');
  }

  const moisture = String(record.soil_moisture ?? '').toLowerCase();
  if (/dry|cracked/.test(moisture)) {
    score -= 12;
    findings.push('Soil moisture reported dry.');
    actions.push(`Irrigate about ${prediction.water.expectedToday} L today, then re-check at midday tomorrow.`);
  } else if (/wet|waterlog|soggy/.test(moisture)) {
    score -= 10;
    findings.push('Soil reported wet or waterlogged.');
    actions.push('Skip irrigation and open a drainage channel away from the beds.');
  }

  const water = Number(record.water_liters);
  if (Number.isFinite(water) && water > 0) {
    const ratio = water / Math.max(1, prediction.water.expectedToday);
    if (ratio < 0.6) {
      score -= 8;
      findings.push(`Water given (${water} L) is below the ${prediction.water.expectedToday} L target.`);
    } else if (ratio > 1.8) {
      score -= 6;
      findings.push(`Water given (${water} L) is well above the ${prediction.water.expectedToday} L target.`);
    } else {
      score += 4;
      findings.push('Water given matches the plan for this stage.');
    }
  }

  const healthScore = Math.max(5, Math.min(100, Math.round(score)));
  const category =
    healthScore >= 82 ? 'healthy' : healthScore >= 66 ? 'stressed' : healthScore >= 50 ? 'needs_attention' : 'damaged';

  if (!actions.length) {
    actions.push(`Keep the daily record going and water about ${prediction.water.expectedToday} L tomorrow.`);
  }
  if (!findings.length) {
    findings.push('All reported indicators look normal for this stage.');
  }

  const stage = stageForDay(plan, prediction.dayNumber);

  return normalizeAssessment(
    {
      healthScore,
      damagePercent: Math.max(0, 100 - healthScore - 12),
      category,
      conditionLabel:
        category === 'healthy'
          ? 'Steady and on plan'
          : category === 'stressed'
            ? 'Mild stress reported'
            : 'Needs intervention',
      summary: `Checked against the ${stage?.label ?? 'current'} stage plan using the numbers entered. Record completeness is ${prediction.recordStats.completenessPct}%.`,
      stageNote: stage?.focus ?? '',
      findings,
      actions,
      urgency: healthScore < 55 ? 'immediate' : healthScore < 72 ? 'this week' : 'routine',
      expectedRecoveryDays: category === 'healthy' ? 0 : 5,
      diagnosis: [],
    },
    { fallbackScore: healthScore, fallbackLabel: 'Steady and on plan' },
  );
}

/**
 * Assesses a submitted daily record. Falls back to the deterministic rules engine
 * when Gemini is not configured, so the daily loop still closes.
 */
export async function analyzeRecord({ crop, plan, record, prediction, history }, language = 'en') {
  try {
    const raw = await generateJson({
      system: `${ANALYST_SYSTEM}${languageRule(language)}`,
      parts: [{ text: recordPrompt({ crop, plan, record, prediction, history }) }],
      temperature: 0.3,
      maxOutputTokens: 1600,
    });
    return {
      assessment: normalizeAssessment(raw, { fallbackScore: prediction.healthScore }),
      source: 'gemini',
      warning: null,
    };
  } catch (error) {
    return {
      assessment: localRecordAssessment({ plan, record, prediction }),
      source: 'local-rules',
      warning: error.message,
      warningCode: error.code,
    };
  }
}

/** Vision diagnosis for a crop the farmer already logged. Throws when Gemini is unavailable. */
export async function diagnosePhoto({ crop, plan, prediction, imageBase64, mimeType, note, dayNumber }, language = 'en') {
  const raw = await generateJson({
    system: `${PHOTO_SYSTEM}${languageRule(language)}`,
    parts: [
      { text: photoPrompt({ crop, plan, prediction, note, dayNumber }) },
      { inlineData: { mimeType, data: imageBase64 } },
    ],
    temperature: 0.2,
    maxOutputTokens: 2000,
  });
  return {
    detectedCrop: String(raw?.detectedCrop ?? crop.name).slice(0, 80),
    assessment: normalizeAssessment(raw, { fallbackScore: 60, fallbackLabel: 'Photo diagnosis' }),
    source: 'gemini',
  };
}

/** Standalone photo diagnosis with no crop attached (the AI scan page). */
export async function diagnoseStandalonePhoto({ imageBase64, mimeType, note, cropHint }, language = 'en') {
  const raw = await generateJson({
    system: `${PHOTO_SYSTEM}${languageRule(language)}`,
    parts: [
      {
        text: `No crop record is attached to this photo. Identify what is visible and judge its condition.
${cropHint ? `The farmer says this is: ${cropHint}` : 'The farmer did not say which crop this is.'}
FARMER NOTE: ${note || 'none'}

${PHOTO_SCHEMA}`,
      },
      { inlineData: { mimeType, data: imageBase64 } },
    ],
    temperature: 0.2,
    maxOutputTokens: 2000,
  });

  return {
    detectedCrop: String(raw?.detectedCrop ?? cropHint ?? 'Unknown').slice(0, 80),
    assessment: normalizeAssessment(raw, { fallbackScore: 60, fallbackLabel: 'Photo diagnosis' }),
    source: 'gemini',
  };
}
