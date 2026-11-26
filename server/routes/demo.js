import { Router } from 'express';
import { get, run } from '../db/index.js';
import { asyncHandler } from '../lib/http.js';
import { addDays, nowISO, todayISO } from '../lib/dates.js';
import { buildLocalPlan, expectedWaterForDay } from '../engine/plan.js';
import { normalizeAssessment, buildReportUpdates } from '../engine/report.js';
import { insertAssessment } from '../services/crops.js';
import { createSession, hashPin } from '../lib/auth.js';
import { isGeminiConfigured } from '../config.js';

export const demoRouter = Router();

const DEMO_PHONE = '+15550000000';
const DEMO_PIN = '1234';

/** A demo farm definition: crop, age, documentation habits and the last AI verdict. */
const DEMO_CROPS = [
  {
    name: 'Tomato',
    variety: 'Roma VF',
    fieldName: 'River Plot',
    areaSqm: 120,
    plantedDaysAgo: 52,
    recordEveryDay: true,
    missingRecentDays: 3,
    assessment: {
      daysAgo: 7,
      healthScore: 74,
      category: 'stressed',
      damage: 14,
      label: 'Early water stress',
      summary:
        'Lower leaves are curling and the soil surface is cracking between rows. Fruit set is holding, but plants lose turgor by mid-morning.',
      findings: [
        'Curled lower leaves on about a third of the plants',
        'Cracked soil crust between rows',
        'Two fruit with blossom end rot',
      ],
      actions: [
        'Irrigate about 240 L over the plot before 9am',
        'Mulch the rows to hold moisture',
        'Add a calcium foliar feed this week',
      ],
    },
  },
  {
    name: 'Onion',
    variety: 'Bombay Red',
    fieldName: 'Home Garden',
    areaSqm: 80,
    plantedDaysAgo: 34,
    recordEveryDay: true,
    missingRecentDays: 0,
    assessment: {
      daysAgo: 2,
      healthScore: 91,
      category: 'healthy',
      damage: 3,
      label: 'Even stand, no disease',
      summary:
        'Uniform leaf colour, upright tops and even spacing. No thrips scarring found on the sample rows.',
      findings: ['Uniform dark green tops', 'No silvery thrips streaks', 'Soil moisture even down the bed'],
      actions: ['Keep the 7-day neem spray for thrips', 'Weed the path edges this week'],
    },
  },
  {
    name: 'Maize',
    variety: 'BH-660',
    fieldName: 'Upper Field',
    areaSqm: 400,
    plantedDaysAgo: 96,
    recordEveryDay: false,
    recordGap: 3,
    missingRecentDays: 6,
    assessment: {
      daysAgo: 11,
      healthScore: 48,
      category: 'pest',
      damage: 34,
      label: 'Fall armyworm in the whorl',
      summary:
        'Ragged feeding damage in the whorls of roughly 40% of plants with fresh frass. Some cobs are already stunted.',
      findings: [
        'Ragged holes across whorl leaves in most rows',
        'Fresh sawdust-like frass in the whorls',
        'Two plants per row with dead heart',
      ],
      actions: [
        'Scout at dawn and hand-pick larvae',
        'Apply Bt or emamectin into the whorls',
        'Remove and destroy the dead-heart plants',
      ],
    },
  },
];

const publicFarmer = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  region: row.region,
  createdAt: row.created_at,
});

function seedCrop(farmerId, demo, today) {
  const plantedAt = addDays(today, -(demo.plantedDaysAgo - 1));
  const plan = buildLocalPlan({
    name: demo.name,
    variety: demo.variety,
    areaSqm: demo.areaSqm,
    plantedAt,
  });
  const timestamp = nowISO();

  const created = run(
    `INSERT INTO crops (
       farmer_id, name, variety, field_name, area_sqm, planted_at, expected_days,
       planting_notes, status, plan_json, plan_source, created_at, updated_at
     ) VALUES (
       :farmerId, :name, :variety, :fieldName, :areaSqm, :plantedAt, :expectedDays,
       :notes, 'active', :plan, 'local', :createdAt, :updatedAt
     )`,
    {
      farmerId,
      name: plan.cropName,
      variety: demo.variety,
      fieldName: demo.fieldName,
      areaSqm: demo.areaSqm,
      plantedAt,
      expectedDays: plan.expectedDaysToHarvest,
      notes: 'Demo farm — replace with your own field records.',
      plan: JSON.stringify(plan),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  );
  const cropId = Number(created.lastInsertRowid);
  const cropRow = get('SELECT * FROM crops WHERE id = :id', { id: cropId });

  const missing = new Set(
    Array.from({ length: demo.missingRecentDays }, (_, index) => addDays(today, -index)),
  );
  const gap = demo.recordEveryDay ? 1 : demo.recordGap ?? 1;
  const stressed = ['stressed', 'pest', 'damaged', 'diseased'].includes(demo.assessment.category);

  for (let dayNumber = 1; dayNumber <= demo.plantedDaysAgo; dayNumber += 1) {
    const recordDate = addDays(plantedAt, dayNumber - 1);
    if (missing.has(recordDate) || dayNumber % gap !== 0) continue;
    run(
      `INSERT INTO daily_records (
         crop_id, record_date, water_liters, growth_cm, leaf_colour, soil_moisture,
         pests_seen, notes, photo_url, created_at
       ) VALUES (
         :cropId, :recordDate, :waterLiters, :growthCm, :leafColour, :soilMoisture,
         :pestsSeen, :notes, NULL, :createdAt
       )`,
      {
        cropId,
        recordDate,
        waterLiters: expectedWaterForDay(plan, dayNumber, demo.areaSqm),
        growthCm: Math.round(dayNumber * (plan.spacingCm ? 0.7 : 0.5)),
        leafColour: !stressed ? 'Dark green' : demo.assessment.category === 'pest' ? 'Pale green' : 'Yellowing',
        soilMoisture: demo.assessment.category === 'stressed' ? 'Dry / cracked' : 'Moist',
        pestsSeen: demo.assessment.category === 'pest' ? 'Chewed whorl leaves seen' : null,
        notes: null,
        createdAt: timestamp,
      },
    );
  }

  const assessment = normalizeAssessment({
    healthScore: demo.assessment.healthScore,
    damagePercent: demo.assessment.damage,
    category: demo.assessment.category,
    conditionLabel: demo.assessment.label,
    summary: demo.assessment.summary,
    findings: demo.assessment.findings,
    actions: demo.assessment.actions,
    diagnosis: [],
  });

  const { updates, harvestTo } = buildReportUpdates({
    crop: cropRow,
    plan,
    assessment,
    previous: null,
    today,
  });

  insertAssessment({
    cropId,
    source: 'demo',
    assessment,
    reportUpdates: updates,
    predictedHarvest: harvestTo,
    model: 'demo',
    createdAt: addDays(today, -demo.assessment.daysAgo),
  });

  return cropRow;
}

demoRouter.get('/', (_req, res) => {
  res.json({
    available: true,
    aiConfigured: isGeminiConfigured(),
    crops: DEMO_CROPS.map(({ name, variety, fieldName, plantedDaysAgo, assessment }) => ({
      name,
      variety,
      fieldName,
      plantedDaysAgo,
      condition: assessment.label,
    })),
  });
});

demoRouter.post(
  '/start',
  asyncHandler(async (_req, res) => {
    let farmer = get('SELECT * FROM farmers WHERE phone = :phone', { phone: DEMO_PHONE });

    if (!farmer) {
      const created = run(
        `INSERT INTO farmers (name, phone, pin_hash, region, created_at)
         VALUES (:name, :phone, :pinHash, :region, :createdAt)`,
        {
          name: 'Demo Farmer',
          phone: DEMO_PHONE,
          pinHash: hashPin(DEMO_PIN),
          region: 'Oromia',
          createdAt: nowISO(),
        },
      );
      farmer = get('SELECT * FROM farmers WHERE id = :id', { id: Number(created.lastInsertRowid) });
    }

    run('DELETE FROM scans WHERE farmer_id = :farmerId', { farmerId: farmer.id });
    run('DELETE FROM crops WHERE farmer_id = :farmerId', { farmerId: farmer.id });

    const today = todayISO();
    const crops = DEMO_CROPS.map((demo) => seedCrop(farmer.id, demo, today));
    const token = createSession(farmer.id);

    res.status(201).json({
      token,
      farmer: publicFarmer(farmer),
      seeded: crops.length,
      crops: crops.map((crop) => ({ id: crop.id, name: crop.name })),
      today,
      aiConfigured: isGeminiConfigured(),
    });
  }),
);
