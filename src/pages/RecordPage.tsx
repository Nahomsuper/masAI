import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ClipboardList, Droplets, Loader2, Upload } from 'lucide-react';
import { ApiError, api } from '../api/client';
import { fileToDataUrl } from '../lib/image';
import { formatNumber, todayISO } from '../lib/format';
import { sourceText, useI18n } from '../i18n';
import type { CropView } from '../types';
import {
  AssessmentCard,
  Badge,
  Notice,
  ReportUpdates,
  Spinner,
} from '../components/Ui';

const toNumberOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function RecordPage() {
  const { id } = useParams();
  const cropId = Number(id);
  const { lang, t } = useI18n();
  const [view, setView] = useState<CropView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CropView | null>(null);

  const [recordDate, setRecordDate] = useState(todayISO());
  const [water, setWater] = useState('');
  const [growth, setGrowth] = useState('');
  const [leafColour, setLeafColour] = useState('');
  const [soilMoisture, setSoilMoisture] = useState('');
  const [pestsSeen, setPestsSeen] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!Number.isFinite(cropId)) {
      setError(t('That crop link is not valid.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .crop(cropId)
      .then((data) => {
        setView(data);
        if (data.prediction.water.expectedToday) {
          setWater(String(Math.round(data.prediction.water.expectedToday * 10) / 10));
        }
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : t('Could not load this crop.')))
      .finally(() => setLoading(false));
  }, [cropId, t]);

  useEffect(() => { load(); }, [load]);

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      setImage(await fileToDataUrl(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('Could not prepare that photo.'));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.createRecord(cropId, {
        recordDate,
        waterLiters: toNumberOrNull(water),
        growthCm: toNumberOrNull(growth),
        leafColour: leafColour || null,
        soilMoisture: soilMoisture || null,
        pestsSeen: pestsSeen.trim() || null,
        notes: notes.trim() || null,
        image,
      });
      setResult(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not save this record.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !view) return <Spinner label="Opening record form…" />;
  if (error && !view) return <Notice tone="bad" title="Could not open the form">{error}</Notice>;
  if (!view) return null;

  return (
    <div className="stack-lg narrow-page">
      <Link className="back-link" to={`/crops/${cropId}`}><ArrowLeft size={16} /> {t('Back to crop report')}</Link>

      <div className="form-intro">
        <span className="eyebrow">{t('Daily record')}</span>
        <h2>{t('Log what happened in the field today')}</h2>
        <p>
          {t('{crop} · day {day} · target {litres} L. Missing days lower the predicted health.', {
            crop: view.crop.name,
            day: view.prediction.dayNumber,
            litres: formatNumber(view.prediction.water.expectedToday, 1),
          })}
        </p>
      </div>

      {error ? <Notice tone="bad" title="Check the record">{error}</Notice> : null}

      {result ? (
        <div className="panel result-panel">
          <div className="result-head">
            <CheckCircle2 size={20} />
            <div>
              <h3>{t('Record saved and assessed')}</h3>
              <p>{t("The report has been updated with today's verdict.")}</p>
            </div>
            <Badge tone={result.aiSource === 'gemini' ? 'good' : 'info'}>
              {sourceText(result.aiSource ?? 'local-rules', lang)}
            </Badge>
          </div>
          {result.aiWarning ? <Notice tone="warn" title="AI fallback">{result.aiWarning}</Notice> : null}
          {result.assessment ? <AssessmentCard assessment={result.assessment} /> : null}
          <ReportUpdates updates={result.reportUpdates ?? []} />
          <div className="result-actions">
            <Link className="button button-primary" to={`/crops/${cropId}`}>{t('See full report')}</Link>
            <Link className="button button-outline" to={`/scan?cropId=${cropId}`}><Camera size={16} /> {t('Scan a photo too')}</Link>
          </div>
        </div>
      ) : null}

      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>{t('Record date')}</span>
            <input type="date" value={recordDate} max={todayISO()} min={view.crop.plantedAt} onChange={(event) => setRecordDate(event.target.value)} required />
          </label>
          <label className="field">
            <span>{t('Water given (litres)')}</span>
            <div className="input-with-icon">
              <Droplets size={16} />
              <input type="number" min="0" step="0.1" value={water} onChange={(event) => setWater(event.target.value)} placeholder={t('e.g. 240')} />
            </div>
            <small className="field-hint">{t('Plan target: {n} L', { n: formatNumber(view.prediction.water.expectedToday, 1) })}</small>
          </label>
          <label className="field">
            <span>{t('Plant height (cm)')} <small>{t('optional')}</small></span>
            <input type="number" min="0" step="0.5" value={growth} onChange={(event) => setGrowth(event.target.value)} placeholder={t('e.g. 65')} />
          </label>
          <label className="field">
            <span>{t('Leaf colour')} <small>{t('optional')}</small></span>
            <select value={leafColour} onChange={(event) => setLeafColour(event.target.value)}>
              <option value="">{t('Not recorded')}</option>
              <option value="Dark green">{t('Dark green')}</option>
              <option value="Green">{t('Green')}</option>
              <option value="Pale / yellow">{t('Pale / yellow')}</option>
              <option value="Brown / dry">{t('Brown / dry')}</option>
              <option value="Wilting">{t('Wilting')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Soil moisture')} <small>{t('optional')}</small></span>
            <select value={soilMoisture} onChange={(event) => setSoilMoisture(event.target.value)}>
              <option value="">{t('Not recorded')}</option>
              <option value="Moist">{t('Moist')}</option>
              <option value="Dry / cracked">{t('Dry / cracked')}</option>
              <option value="Wet / soggy">{t('Wet / soggy')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Pests seen')} <small>{t('optional')}</small></span>
            <input value={pestsSeen} onChange={(event) => setPestsSeen(event.target.value)} placeholder={t('e.g. holes in leaves, aphids')} maxLength={200} />
          </label>
          <label className="field field-full">
            <span>{t('Notes')} <small>{t('optional')}</small></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder={t('Anything else the model should know…')} maxLength={1000} />
          </label>
          <label className="field field-full">
            <span>{t('Photo')} <small>{t('optional — JPEG, PNG or WebP')}</small></span>
            <div className="photo-picker">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
              <span className="muted small"><Upload size={13} /> {t('Photos are stored with the record.')}</span>
            </div>
            {image ? <img className="photo-preview" src={image} alt={t('Selected field record')} /> : null}
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? <Loader2 className="spin" size={17} /> : <ClipboardList size={17} />}
            {t('Save daily record')}
          </button>
        </div>
      </form>
    </div>
  );
}
