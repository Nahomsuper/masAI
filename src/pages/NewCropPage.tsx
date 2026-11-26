import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Droplets, Leaf, Loader2, Sparkles, Sprout } from 'lucide-react';
import { ApiError, api } from '../api/client';
import { formatNumber, todayISO } from '../lib/format';
import { sourceText, useI18n } from '../i18n';
import type { CarePlan, CropLibraryItem } from '../types';
import { Badge, Notice, Spinner } from '../components/Ui';

interface Preview {
  plan: Partial<CarePlan>;
  source: string;
  warning: string | null;
}

export function NewCropPage() {
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const [library, setLibrary] = useState<CropLibraryItem[]>([]);
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [area, setArea] = useState('');
  const [plantedAt, setPlantedAt] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'save' | 'preview' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.library().then(({ crops }) => setLibrary(crops)).catch(() => undefined);
  }, []);

  const buildPayload = () => ({
    name: name.trim(),
    variety: variety.trim() || null,
    fieldName: fieldName.trim() || null,
    areaSqm: area ? Number(area) : null,
    plantedAt,
    notes: notes.trim() || null,
  });

  const showPreview = async () => {
    if (!name.trim()) {
      setError(t('Enter a crop name first.'));
      return;
    }
    setBusy('preview');
    setError('');
    try {
      setPreview(await api.planPreview(buildPayload()));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not preview the care plan.'));
    } finally {
      setBusy(null);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('save');
    setError('');
    try {
      const view = await api.createCrop(buildPayload());
      navigate(`/crops/${view.crop.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not save this crop.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack-lg narrow-page">
      <Link className="back-link" to="/crops"><ArrowLeft size={16} /> {t('Back to crops')}</Link>

      <div className="form-intro">
        <span className="eyebrow">{t('New field record')}</span>
        <h2>{t('What did you plant?')}</h2>
        <p>{t('MasAI builds a stage-by-stage care plan and starts predicting from the planting date.')}</p>
      </div>

      {error ? <Notice tone="bad" title="Check the form">{error}</Notice> : null}

      <form className="panel form-panel" onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            <span>{t('Crop name')}</span>
            <input list="crop-library" value={name} onChange={(event) => { setName(event.target.value); setPreview(null); }} placeholder={t('e.g. Tomato')} required maxLength={60} />
            <datalist id="crop-library">
              {library.map((crop) => <option value={crop.label} key={crop.key}>{crop.days} {t('days')} · {crop.water} L/m²</option>)}
            </datalist>
            {library.length ? null : <Spinner label="Loading crop library…" />}
          </label>
          <label className="field">
            <span>{t('Variety')} <small>{t('optional')}</small></span>
            <input value={variety} onChange={(event) => setVariety(event.target.value)} placeholder={t('e.g. Roma VF')} maxLength={60} />
          </label>
          <label className="field">
            <span>{t('Field name')} <small>{t('optional')}</small></span>
            <input value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder={t('e.g. River Plot')} maxLength={60} />
          </label>
          <label className="field">
            <span>{t('Field area (m²)')} <small>{t('optional')}</small></span>
            <input type="number" min="1" max="100000" step="0.1" value={area} onChange={(event) => setArea(event.target.value)} placeholder={t('e.g. 120')} />
          </label>
          <label className="field">
            <span>{t('Planted on')}</span>
            <input type="date" value={plantedAt} max={todayISO()} onChange={(event) => setPlantedAt(event.target.value)} required />
          </label>
          <label className="field field-full">
            <span>{t('Planting notes')} <small>{t('optional')}</small></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder={t('Soil preparation, seed source, irrigation method…')} maxLength={600} />
          </label>
        </div>

        {preview ? (
          <div className="preview-card">
            <div className="preview-head">
              <Sparkles size={18} />
              <div>
                <strong>{t('Care plan preview')}</strong>
                <span className="muted small">{t(preview.source === 'gemini' ? 'Generated by Gemini' : 'Built from the local agronomy library')}</span>
              </div>
              <Badge tone={preview.source === 'gemini' ? 'good' : 'info'}>{sourceText(preview.source, lang)}</Badge>
            </div>
            {preview.warning ? <p className="muted small">{preview.warning}</p> : null}
            <div className="preview-stats">
              <div><CalendarDays size={15} /><span>{t('Harvest')}</span><strong>{preview.plan.expectedDaysToHarvest ?? '—'} {t('days')}</strong></div>
              <div><Droplets size={15} /><span>{t('Water')}</span><strong>{formatNumber(preview.plan.waterLitresPerDay, 1)} {t('L/day')}</strong></div>
              <div><Leaf size={15} /><span>{t('Soil pH')}</span><strong>{preview.plan.soil?.phLow ?? '—'}–{preview.plan.soil?.phHigh ?? '—'}</strong></div>
              <div><Sprout size={15} /><span>{t('Stages')}</span><strong>{preview.plan.stages?.length ?? 0}</strong></div>
            </div>
            <p className="muted small">{preview.plan.wateringNote}</p>
          </div>
        ) : null}

        <div className="form-actions">
          <button type="button" className="button button-outline" onClick={showPreview} disabled={busy !== null}>
            {busy === 'preview' ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
            {t('Preview care plan')}
          </button>
          <button type="submit" className="button button-primary" disabled={busy !== null}>
            {busy === 'save' ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
            {t('Save crop')}
          </button>
        </div>
      </form>
    </div>
  );
}
