import { matchCrop, STAGE_BLUEPRINTS, GENERIC_CROP } from './crops.data.js';
import { clamp } from '../lib/dates.js';

/**
 * Builds a care plan from the local agronomy knowledge base.
 * The shape is identical to what Gemini returns, so downstream code never branches.
 */
export function buildLocalPlan({ name, variety, areaSqm, plantedAt }) {
  const { key, entry } = matchCrop(name);
  const days = entry.days || GENERIC_CROP.days;
  const area = Number(areaSqm) > 0 ? Number(areaSqm) : null;
  const blueprint = STAGE_BLUEPRINTS[entry.type] ?? STAGE_BLUEPRINTS.fruit;

  const stages = blueprint.map((stage) => ({
    key: stage.key,
    label: stage.label,
    startDay: Math.round((stage.from / 100) * days),
    endDay: Math.round((stage.to / 100) * days),
    waterMultiplier: stage.water,
    waterLitresPerSqmPerDay: round1((entry.water || 4) * stage.water),
    focus: stage.focus,
    watchFor: watchForStage(stage.key, entry),
  }));

  return {
    cropName: entry.label === GENERIC_CROP.label ? titleCase(name) : entry.label,
    cropKey: key,
    variety: variety || null,
    expectedDaysToHarvest: days,
    plantedAt: plantedAt ?? null,
    waterLitresPerSqmPerDay: entry.water,
    waterLitresPerDay: area ? round1(entry.water * area) : null,
    wateringNote: wateringNote(entry.type, entry.water),
    sunlightHours: entry.type === 'leafy' ? '4-6' : '6-8',
    soil: {
      phLow: entry.ph[0],
      phHigh: entry.ph[1],
      texture: soilTexture(entry.type),
      note: `Keep pH between ${entry.ph[0]} and ${entry.ph[1]}. Test the soil once before planting and once at flowering.`,
    },
    spacingCm: entry.spacingCm,
    feedSchedule: feedSchedule(entry.type, days),
    stages,
    commonPests: entry.pests.map((pest) => ({ ...pest })),
    harvestSigns: entry.harvestSigns,
    riskNotes: riskNotes(entry.type, days),
    source: 'local',
  };
}

const round1 = (value) => Math.round(value * 10) / 10;

const titleCase = (value) => {
  const text = String(value ?? 'Crop').trim();
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

function watchForStage(stageKey, entry) {
  const base = {
    establishment: ['Wilting transplants', 'Bare patches where seed did not emerge'],
    vegetative: ['Pale or yellowing leaves', 'Weed pressure around the stems'],
    flowering: ['Flower drop', 'Few pollinators visiting in the morning'],
    fruiting: ['Fruit cracking or splitting', 'Sun-scald on exposed fruit'],
    maturity: ['Over-ripening', 'Birds and rodents in the field'],
  }[stageKey] ?? ['Any sudden colour change'];
  const pests = entry.pests.slice(0, 2).map((pest) => `${pest.name}: ${pest.signs}`);
  return [...base, ...pests];
}

function wateringNote(type, water) {
  if (type === 'tree') return `Deep water ${water} L per m² two to three times a week rather than daily sips; let the top 3 cm dry between rounds.`;
  if (type === 'leafy') return `Water ${water} L per m² in the cool of the morning; leaves should be dry by evening to avoid rot.`;
  if (type === 'root') return `Water ${water} L per m² evenly. Uneven watering splits root crops.`;
  return `Water ${water} L per m² early morning. Prefer two smaller rounds over one flood.`;
}

function soilTexture(type) {
  if (type === 'root') return 'Loose sandy loam, free of stones so roots can swell';
  if (type === 'tree') return 'Deep well-drained loam with a thick mulch ring';
  if (type === 'leafy') return 'Rich loam high in organic matter';
  return 'Well-drained loam with compost worked into the top 20 cm';
}

function feedSchedule(type, days) {
  const at = (percent, task) => ({ day: Math.max(1, Math.round((percent / 100) * days)), task });
  const plan = [at(3, 'Compost or manure worked into the bed before planting')];
  if (type === 'leafy') plan.push(at(30, 'Nitrogen side-dress (compost tea or urea at label rate)'));
  if (type === 'fruit') {
    plan.push(at(35, 'Balanced NPK side-dress to push the canopy'));
    plan.push(at(60, 'Potassium-rich feed at flowering for fruit quality'));
  }
  if (type === 'root') plan.push(at(45, 'Low-nitrogen potassium feed while roots bulk up'));
  if (type === 'cereal') plan.push(at(30, 'Nitrogen top-dress at tillering'));
  if (type === 'legume') plan.push(at(40, 'Phosphate and a light potassium feed; legumes fix their own nitrogen'));
  if (type === 'tree') plan.push(at(50, 'Ring of compost plus mulch, kept 15 cm away from the trunk'));
  plan.push(at(85, 'Stop heavy feeding; the plant should ripen, not grow'));
  return plan;
}

function riskNotes(type, days) {
  const notes = [`The harvest window is around ${days} days; plan labour and crates a week early.`];
  if (type === 'tree') notes.push('Young trees need protection from livestock and strong wind for the first two seasons.');
  if (type === 'leafy') notes.push('Leafy crops bolt in heat; harvest before the stem elongates.');
  if (type === 'root') notes.push('Stop watering 7 to 10 days before harvest so roots harden for storage.');
  if (type === 'cereal') notes.push('Dry grain below 13% moisture before storage to prevent mould.');
  return notes;
}

/** The stage a crop is in on a given growth day. */
export function stageForDay(plan, dayNumber) {
  const stages = plan?.stages ?? [];
  if (!stages.length) return null;
  const day = clamp(dayNumber, 0, Number.MAX_SAFE_INTEGER);
  return stages.find((stage) => day >= stage.startDay && day < stage.endDay) ?? stages[stages.length - 1];
}

/** Expected litres for a crop on a given growth day, respecting its stage multiplier. */
export function expectedWaterForDay(plan, dayNumber, areaSqm) {
  const stage = stageForDay(plan, dayNumber);
  const perSqm = stage?.waterLitresPerSqmPerDay ?? plan?.waterLitresPerSqmPerDay ?? 4;
  const area = Number(areaSqm) > 0 ? Number(areaSqm) : 1;
  return round1(perSqm * area);
}
/** Light validation of an AI-produced plan so a malformed reply can never corrupt the DB. */
export function normalizePlan(raw, fallback) {
  if (!raw || typeof raw !== 'object') return fallback;
  const days = Number(raw.expectedDaysToHarvest ?? raw.expectedDaysToMaturity);
  const stages = Array.isArray(raw.stages) ? raw.stages : [];
  if (!Number.isFinite(days) || days < 10 || days > 1000 || !stages.length) return fallback;

  const cleanStages = stages
    .map((stage) => ({
      key: String(stage.key ?? stage.label ?? 'stage').slice(0, 40),
      label: String(stage.label ?? stage.key ?? 'Stage').slice(0, 60),
      startDay: clamp(Number(stage.startDay) || 0, 0, days),
      endDay: clamp(Number(stage.endDay) || days, 0, days),
      waterMultiplier: clamp(Number(stage.waterMultiplier) || 1, 0.2, 2),
      waterLitresPerSqmPerDay:
        Number(stage.waterLitresPerSqmPerDay) || Number(fallback.waterLitresPerSqmPerDay),
      focus: String(stage.focus ?? '').slice(0, 240),
      watchFor: Array.isArray(stage.watchFor)
        ? stage.watchFor.map((item) => String(item).slice(0, 200)).slice(0, 6)
        : [],
    }))
    .sort((a, b) => a.startDay - b.startDay);

  if (!cleanStages.length) return fallback;

  const list = (value, fallbackList, max = 8) =>
    Array.isArray(value) && value.length
      ? value.map((item) => String(item).slice(0, 240)).filter(Boolean).slice(0, max)
      : fallbackList;

  return {
    ...fallback,
    cropName: String(raw.cropName ?? fallback.cropName).slice(0, 80),
    expectedDaysToHarvest: Math.round(days),
    waterLitresPerSqmPerDay: Number(raw.waterLitresPerSqmPerDay) || fallback.waterLitresPerSqmPerDay,
    waterLitresPerDay: Number(raw.waterLitresPerDay) || fallback.waterLitresPerDay,
    wateringNote: String(raw.wateringNote ?? fallback.wateringNote).slice(0, 300),
    sunlightHours: String(raw.sunlightHours ?? fallback.sunlightHours).slice(0, 40),
    spacingCm: Number(raw.spacingCm) || fallback.spacingCm,
    soil: {
      phLow: Number(raw.soil?.phLow) || fallback.soil.phLow,
      phHigh: Number(raw.soil?.phHigh) || fallback.soil.phHigh,
      texture: String(raw.soil?.texture ?? fallback.soil.texture).slice(0, 200),
      note: String(raw.soil?.note ?? fallback.soil.note).slice(0, 400),
    },
    feedSchedule: Array.isArray(raw.feedSchedule)
      ? raw.feedSchedule
          .map((item) => ({
            day: clamp(Number(item.day) || 1, 1, days),
            task: String(item.task ?? '').slice(0, 200),
          }))
          .filter((item) => item.task)
          .slice(0, 12)
      : fallback.feedSchedule,
    stages: cleanStages,
    commonPests: Array.isArray(raw.commonPests)
      ? raw.commonPests
          .map((pest) => ({
            name: String(pest.name ?? '').slice(0, 80),
            signs: String(pest.signs ?? '').slice(0, 240),
            treatment: String(pest.treatment ?? '').slice(0, 240),
          }))
          .filter((pest) => pest.name)
          .slice(0, 8)
      : fallback.commonPests,
    harvestSigns: list(raw.harvestSigns, fallback.harvestSigns),
    riskNotes: list(raw.riskNotes, fallback.riskNotes),
    source: raw.source === 'gemini' ? 'gemini' : fallback.source,
  };
}
