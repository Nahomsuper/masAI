import { buildLocalPlan, normalizePlan } from '../engine/plan.js';
import { config } from '../config.js';
import { languageRule } from '../lib/language.js';
import { generateJson } from './client.js';

const SYSTEM = `You are MasAI's agronomist. You turn a farmer's crop declaration into a precise
care plan for that specific crop grown in East Africa (Ethiopia, Kenya, Uganda, Tanzania).
Be practical, quantitative and specific: litres, centimetres, days, pH ranges.
Never invent pests that do not attack the crop. Answer with JSON only.`;

const schemaPrompt = (input, local) => `Crop: ${input.name}
Variety: ${input.variety || 'unspecified'}
Field area: ${input.areaSqm ? `${input.areaSqm} m2` : 'not given'}
Planted on: ${input.plantedAt}
Region: ${input.region || 'highland Ethiopia'}
Farmer notes: ${input.notes || 'none'}

Reference values from our agronomy database (treat as a sanity floor, refine them for this
variety and region, do not drift more than 25% without a reason):
${JSON.stringify(
  {
    expectedDaysToHarvest: local.expectedDaysToHarvest,
    waterLitresPerSqmPerDay: local.waterLitresPerSqmPerDay,
    spacingCm: local.spacingCm,
    ph: [local.soil.phLow, local.soil.phHigh],
    stages: local.stages.map((stage) => `${stage.label}: day ${stage.startDay}-${stage.endDay}`),
  },
  null,
  2,
)}

Return JSON with exactly this shape:
{
  "cropName": string,
  "expectedDaysToHarvest": integer,
  "waterLitresPerSqmPerDay": number,
  "waterLitresPerDay": number,
  "wateringNote": string (max 200 chars, when and how to water),
  "sunlightHours": string like "6-8",
  "spacingCm": number,
  "soil": { "phLow": number, "phHigh": number, "texture": string, "note": string },
  "feedSchedule": [{ "day": integer, "task": string }] (4-8 entries across the cycle),
  "stages": [{
    "key": string snake_case,
    "label": string,
    "startDay": integer,
    "endDay": integer,
    "waterMultiplier": number (0.5-1.4),
    "waterLitresPerSqmPerDay": number,
    "focus": string,
    "watchFor": [string] (3-5 concrete warning signs for THIS stage)
  }] (3-6 stages, contiguous, must cover day 0 to expectedDaysToHarvest),
  "commonPests": [{ "name": string, "signs": string, "treatment": string }] (3-5),
  "harvestSigns": [string] (2-4),
  "riskNotes": [string] (2-4)
}`;

/**
 * Asks Gemini for a crop plan, falling back to the local knowledge base.
 * Returns `{ plan, source, warning }` and never throws.
 */
export async function createCropPlan(input, language = 'en') {
  const local = buildLocalPlan(input);
  try {
    const raw = await generateJson({
      system: `${SYSTEM}${languageRule(language, { keepCropName: true })}`,
      parts: [{ text: schemaPrompt(input, local) }],
      temperature: 0.3,
      maxOutputTokens: 2800,
    });
    const plan = normalizePlan({ ...raw, source: 'gemini' }, local);
    if (plan.source !== 'gemini') {
      return { plan: local, source: 'local', warning: 'Gemini reply was unusable, using the built-in plan' };
    }
    return { plan, source: 'gemini', model: config.gemini.model, warning: null };
  } catch (error) {
    return { plan: local, source: 'local', warning: error.message, warningCode: error.code };
  }
}
