export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'none';

export interface Farmer {
  id: number;
  name: string;
  phone: string;
  region: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  farmer: Farmer;
}

export interface HealthResponse {
  status: string;
  name: string;
  aiConfigured: boolean;
  time: string;
}

export interface CropLibraryItem {
  key: string;
  label: string;
  days: number;
  water: number;
  type: string;
}

export interface Diagnosis {
  name: string;
  confidence: number;
  treatment: string;
}

export interface ReportUpdate {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

export interface Assessment {
  id: number;
  cropId: number;
  source: string;
  createdAt: string;
  healthScore: number;
  conditionLabel: string;
  category: string;
  damagePercent: number;
  riskLevel: string;
  summary: string;
  findings: string[];
  actions: string[];
  diagnosis: Diagnosis[];
  predictedHarvest: string | null;
  reportUpdates: ReportUpdate[];
  model: string;
  photoUrl: string | null;
}

export interface PlanStage {
  key: string;
  label: string;
  startDay: number;
  endDay: number;
  waterMultiplier: number;
  waterLitresPerSqmPerDay: number;
  focus: string;
  watchFor: string[];
}

export interface CarePlan {
  cropName: string;
  cropKey?: string;
  variety: string | null;
  expectedDaysToHarvest: number;
  plantedAt: string | null;
  waterLitresPerSqmPerDay: number;
  waterLitresPerDay: number | null;
  wateringNote: string;
  sunlightHours: string;
  soil: { phLow: number; phHigh: number; texture: string; note: string };
  spacingCm: number;
  feedSchedule: { day: number; task: string }[];
  stages: PlanStage[];
  commonPests: { name: string; signs: string; treatment: string }[];
  harvestSigns: string[];
  riskNotes: string[];
  source: string;
}

export interface Crop {
  id: number;
  name: string;
  variety: string | null;
  fieldName: string | null;
  areaSqm: number | null;
  plantedAt: string;
  expectedDays: number;
  notes: string | null;
  status: 'active' | 'harvested' | 'failed';
  plan: Partial<CarePlan>;
  planSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRecord {
  id: number;
  cropId: number;
  recordDate: string;
  waterLiters: number | null;
  growthCm: number | null;
  leafColour: string | null;
  soilMoisture: string | null;
  pestsSeen: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
}

export interface Prediction {
  today: string;
  dayNumber: number;
  expectedDays: number;
  progressPercent: number;
  stage: PlanStage | null;
  nextStage: PlanStage | null;
  plantedAt: string;
  windowStart: string;
  recordStats: {
    logged: number;
    expectedRecords: number;
    completenessPct: number;
    missingToday: boolean;
    streakMissed: number;
    missedLast14: number;
    missedDates: string[];
    lastRecordDate: string | null;
    daysSinceLastRecord: number | null;
  };
  water: {
    requiredLast7Days: number;
    loggedLast7Days: number;
    balancePct: number;
    expectedToday: number;
  };
  baseHealth: number;
  recordPenalty: number;
  healthScore: number;
  healthStatus: string;
  healthLabel: string;
  damagePercent: number;
  riskLevel: string;
  yieldForecastPct: number;
  predictedHarvestDate: string;
  daysToHarvest: number;
  harvestDelayDays: number;
  isOverdue: boolean;
  overdueDays: number;
  hasAssessment: boolean;
  daysSinceAssessment: number | null;
  confidencePct: number;
  trend: { date: string; health: number }[];
}

export interface CropWarning {
  id: string;
  cropId: number;
  cropName: string;
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
  dueBy?: string;
}

export interface CropView {
  crop: Crop;
  prediction: Prediction;
  warnings: CropWarning[];
  topSeverity: Severity;
  latestAssessment: Assessment | null;
  assessments: Assessment[];
  records: DailyRecord[];
  aiWarning?: string | null;
  reportUpdates?: ReportUpdate[];
  record?: DailyRecord;
  assessment?: Assessment | null;
  aiSource?: string;
}

export interface DashboardData {
  today: string;
  farmer: Farmer;
  aiConfigured: boolean;
  summary: {
    activeCrops: number;
    totalCrops: number;
    averageHealth: number;
    atRiskCrops: number;
    highestDamagePercent: number;
    recordsThisWeek: number;
    pendingRecords: number;
    criticalAlerts: number;
  };
  alerts: CropWarning[];
  pendingToday: {
    cropId: number;
    name: string;
    fieldName: string | null;
    dayNumber: number;
    streakMissed: number;
    waterTarget: number;
    stage: string | null;
    healthScore: number;
    topSeverity: Severity;
  }[];
  crops: CropView[];
}

export interface Scan {
  id: number;
  cropId: number | null;
  createdAt: string;
  detectedCrop: string;
  healthScore: number;
  damagePercent: number;
  category: string;
  conditionLabel: string;
  summary: string;
  stageNote: string | null;
  urgency: string | null;
  findings: string[];
  actions: string[];
  diagnosis: Diagnosis[];
  photoUrl: string | null;
  model: string;
}

export interface ScanResult {
  scan: Scan;
  detectedCrop: string;
  reportUpdates: ReportUpdate[];
  crop?: Crop;
  prediction?: Prediction;
  warnings?: CropWarning[];
  latestAssessment?: Assessment | null;
}

export interface DemoResponse {
  token: string;
  farmer: Farmer;
  seeded: number;
  crops: { id: number; name: string }[];
  today: string;
  aiConfigured: boolean;
}
