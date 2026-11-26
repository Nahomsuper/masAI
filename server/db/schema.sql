PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS farmers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL UNIQUE,
  pin_hash      TEXT    NOT NULL,
  region        TEXT,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  farmer_id   INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crops (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id         INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  variety           TEXT,
  field_name        TEXT,
  area_sqm          REAL,
  planted_at        TEXT    NOT NULL,
  expected_days     INTEGER NOT NULL,
  planting_notes    TEXT,
  status            TEXT    NOT NULL DEFAULT 'active',
  plan_json         TEXT    NOT NULL,
  plan_source       TEXT    NOT NULL DEFAULT 'local',
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_id         INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  record_date     TEXT    NOT NULL,
  water_liters    REAL,
  growth_cm       REAL,
  leaf_colour     TEXT,
  soil_moisture   TEXT,
  pests_seen      TEXT,
  notes           TEXT,
  photo_url       TEXT,
  created_at      TEXT    NOT NULL,
  UNIQUE (crop_id, record_date)
);

CREATE TABLE IF NOT EXISTS assessments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_id             INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  source              TEXT    NOT NULL,
  created_at          TEXT    NOT NULL,
  health_score        INTEGER NOT NULL,
  condition_label     TEXT    NOT NULL,
  category            TEXT    NOT NULL,
  damage_percent      INTEGER NOT NULL DEFAULT 0,
  risk_level          TEXT    NOT NULL,
  summary             TEXT    NOT NULL,
  findings_json       TEXT    NOT NULL DEFAULT '[]',
  actions_json        TEXT    NOT NULL DEFAULT '[]',
  diagnosis_json      TEXT    NOT NULL DEFAULT '[]',
  predicted_harvest   TEXT,
  report_updates_json TEXT    NOT NULL DEFAULT '[]',
  model               TEXT    NOT NULL DEFAULT 'local',
  photo_url           TEXT
);

CREATE INDEX IF NOT EXISTS idx_crops_farmer ON crops (farmer_id);
CREATE INDEX IF NOT EXISTS idx_records_crop ON daily_records (crop_id, record_date);
CREATE INDEX IF NOT EXISTS idx_assessments_crop ON assessments (crop_id, created_at);
CREATE TABLE IF NOT EXISTS scans (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  farmer_id       INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  crop_id         INTEGER REFERENCES crops(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL,
  detected_crop   TEXT    NOT NULL,
  health_score    INTEGER NOT NULL,
  damage_percent  INTEGER NOT NULL,
  category        TEXT    NOT NULL,
  condition_label TEXT    NOT NULL,
  summary         TEXT    NOT NULL,
  stage_note      TEXT,
  urgency         TEXT,
  findings_json   TEXT    NOT NULL DEFAULT '[]',
  actions_json    TEXT    NOT NULL DEFAULT '[]',
  diagnosis_json  TEXT    NOT NULL DEFAULT '[]',
  photo_url       TEXT,
  model           TEXT    NOT NULL DEFAULT 'gemini'
);

CREATE INDEX IF NOT EXISTS idx_scans_farmer ON scans (farmer_id, created_at);
