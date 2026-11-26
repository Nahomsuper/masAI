import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Link2,
  Loader2,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiError, api } from '../api/client';
import { fileToDataUrl } from '../lib/image';
import { categoryText, useI18n } from '../i18n';
import { formatDate, formatNumber, healthTone } from '../lib/format';
import type { Assessment, Crop, Scan, ScanResult } from '../types';
import {
  AssessmentCard,
  Badge,
  EmptyState,
  Notice,
  ReportUpdates,
} from '../components/Ui';

const toAssessment = (scan: Scan): Assessment => ({
  id: scan.id,
  cropId: scan.cropId ?? 0,
  source: 'photo',
  createdAt: scan.createdAt,
  healthScore: scan.healthScore,
  conditionLabel: scan.conditionLabel,
  category: scan.category,
  damagePercent: scan.damagePercent,
  riskLevel: healthTone(scan.healthScore) === 'good' ? 'low' : healthTone(scan.healthScore) === 'warn' ? 'moderate' : 'high',
  summary: scan.summary,
  findings: scan.findings,
  actions: scan.actions,
  diagnosis: scan.diagnosis,
  predictedHarvest: null,
  reportUpdates: [],
  model: scan.model,
  photoUrl: scan.photoUrl,
});

export function ScanPage() {
  const [searchParams] = useSearchParams();
  const { lang, t } = useI18n();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedCrop, setSelectedCrop] = useState(searchParams.get('cropId') ?? '');
  const [cropHint, setCropHint] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState('');
  const [message, setMessage] = useState('');
  const [aiConfigured, setAiConfigured] = useState(true);
  const [attachTargets, setAttachTargets] = useState<Record<number, string>>({});
  const [busyScan, setBusyScan] = useState<number | null>(null);

  const loadScans = useCallback(() => {
    api.scans().then(({ scans: rows }) => setScans(rows)).catch(() => undefined);
  }, []);

  useEffect(() => {
    api.health().then((health) => setAiConfigured(health.aiConfigured)).catch(() => undefined);
    api.crops().then(({ crops: views }) => setCrops(views.filter((view) => view.crop.status === 'active').map((view) => view.crop))).catch(() => undefined);
    loadScans();
  }, [loadScans]);

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setAiError('');
    try {
      setImage(await fileToDataUrl(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('Could not prepare that photo.'));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!image) {
      setError(t('Choose a photo first.'));
      return;
    }
    setBusy(true);
    setError('');
    setAiError('');
    setMessage('');
    try {
      const response = await api.createScan({
        image,
        cropId: selectedCrop ? Number(selectedCrop) : null,
        cropHint: cropHint.trim() || null,
        note: note.trim() || null,
      });
      setResult(response);
      loadScans();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code.startsWith('gemini_')) {
        setAiError(caught.message);
      } else {
        setError(caught instanceof ApiError ? caught.message : t('Could not analyse that photo.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const attach = async (scan: Scan) => {
    const cropId = Number(attachTargets[scan.id]);
    if (!cropId) return;
    setBusyScan(scan.id);
    setMessage('');
    try {
      await api.attachScan(scan.id, cropId);
      setMessage(t('Verdict applied to the crop report.'));
      loadScans();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not attach that scan.'));
    } finally {
      setBusyScan(null);
    }
  };

  const remove = async (scan: Scan) => {
    if (!window.confirm(t('Delete this scan?'))) return;
    setBusyScan(scan.id);
    try {
      await api.deleteScan(scan.id);
      setScans((current) => current.filter((item) => item.id !== scan.id));
      if (result?.scan.id === scan.id) setResult(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not delete that scan.'));
    } finally {
      setBusyScan(null);
    }
  };

  return (
    <div className="stack-lg">
      {!aiConfigured ? (
        <Notice tone="warn" title="Photo AI needs a Gemini key">
          {t('Daily records still work with local rules. To enable photo diagnosis, add')} <code>GEMINI_API_KEY</code>{' '}
          {t('to server/.env and restart the API.')}
        </Notice>
      ) : null}
      {error ? <Notice tone="bad" title="Could not complete that action">{error}</Notice> : null}
      {aiError ? <Notice tone="bad" title="Gemini could not analyse the photo">{aiError}</Notice> : null}
      {message ? <Notice tone="good" title="Done">{message}</Notice> : null}

      <div className="scan-layout">
        <form className="panel scan-form" onSubmit={submit}>
          <div className="section-heading compact">
            <div>
              <h2>{t('Analyse a field photo')}</h2>
              <p>{t('The verdict can update a crop report or stand alone for later attachment.')}</p>
            </div>
            <ScanLine size={22} />
          </div>

          <label className={`photo-dropzone ${image ? 'has-photo' : ''}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
            {image ? <img src={image} alt={t('Selected crop')} /> : (
              <div className="dropzone-copy">
                <Camera size={30} />
                <strong>{t('Choose a crop photo')}</strong>
                <span>{t('JPEG, PNG or WebP · compressed automatically')}</span>
                <span className="button button-outline button-small"><Upload size={15} /> {t('Browse files')}</span>
              </div>
            )}
          </label>

          <div className="form-grid">
            <label className="field field-full">
              <span>{t('Attach to a crop')} <small>{t('optional — updates its report')}</small></span>
              <select value={selectedCrop} onChange={(event) => setSelectedCrop(event.target.value)}>
                <option value="">{t('Standalone diagnosis')}</option>
                {crops.map((crop) => <option value={crop.id} key={crop.id}>{crop.name} · {crop.fieldName || t('no field name')}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('Crop hint')} <small>{t('optional')}</small></span>
              <input value={cropHint} onChange={(event) => setCropHint(event.target.value)} placeholder={t('e.g. tomato with dark spots')} maxLength={60} />
            </label>
            <label className="field">
              <span>{t('Note for the AI')} <small>{t('optional')}</small></span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('e.g. spotted this morning')} maxLength={500} />
            </label>
          </div>

          <button className="button button-primary button-wide" type="submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            {t(busy ? 'Looking at the photo…' : 'Run AI diagnosis')}
          </button>
        </form>

        <div className="scan-results">
          {result ? (
            <div className="panel result-panel">
              <div className="result-head">
                <CheckCircle2 size={20} />
                <div>
                  <h3>{result.detectedCrop}</h3>
                  <p>{t('Photo diagnosis')} · {formatDate(result.scan.createdAt)}</p>
                </div>
                <Badge tone="good">{result.scan.model}</Badge>
              </div>
              <AssessmentCard assessment={toAssessment(result.scan)} />
              <ReportUpdates updates={result.reportUpdates} />
              {result.crop ? (
                <Link className="text-link" to={`/crops/${result.crop.id}`}>{t('Open updated crop report →')}</Link>
              ) : (
                <Notice tone="info" title="Standalone scan">
                  {t("Attach it to a crop from the history below to push the verdict into that crop's report.")}
                </Notice>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<ScanLine size={28} />}
              title={t('No diagnosis yet')}
              text={t('Upload a clear photo of leaves, fruit and soil for the most useful verdict.')}
            />
          )}
        </div>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>{t('Scan history')}</h2>
            <p>{t('Last 30 photos. Standalone scans can be attached to a crop later.')}</p>
          </div>
          <Badge tone="neutral">{t('{n} scans', { n: scans.length })}</Badge>
        </div>
        {scans.length ? (
          <div className="scan-history">
            {scans.map((scan) => (
              <article className="scan-row" key={scan.id}>
                <div className="scan-thumb">
                  {scan.photoUrl ? <img src={scan.photoUrl} alt={scan.detectedCrop} /> : <Camera size={18} />}
                </div>
                <div className="scan-row-main">
                  <div className="scan-row-title">
                    <strong>{scan.detectedCrop}</strong>
                    <Badge tone={healthTone(scan.healthScore) === 'good' ? 'good' : healthTone(scan.healthScore) === 'warn' ? 'warn' : 'bad'}>
                      {categoryText(scan.category, lang)}
                    </Badge>
                    {scan.cropId ? <Badge tone="info">{t('attached')}</Badge> : <Badge tone="neutral">{t('standalone')}</Badge>}
                  </div>
                  <p>{scan.summary}</p>
                  <span className="muted small">
                    {t('{date} · {score}/100 health · {damage}% damage', {
                      date: formatDate(scan.createdAt),
                      score: scan.healthScore,
                      damage: formatNumber(scan.damagePercent),
                    })}
                    {scan.stageNote ? ` · ${scan.stageNote}` : ''}
                  </span>
                </div>
                <div className="scan-row-actions">
                  {!scan.cropId ? (
                    <div className="attach-controls">
                      <select
                        aria-label={`${t('Attach to a crop')} ${scan.id}`}
                        value={attachTargets[scan.id] ?? ''}
                        onChange={(event) => setAttachTargets((current) => ({ ...current, [scan.id]: event.target.value }))}
                      >
                        <option value="">{t('Choose crop…')}</option>
                        {crops.map((crop) => <option value={crop.id} key={crop.id}>{crop.name}</option>)}
                      </select>
                      <button className="button button-small button-outline" disabled={busyScan === scan.id || !attachTargets[scan.id]} onClick={() => attach(scan)}>
                        <Link2 size={14} /> {t('Attach')}
                      </button>
                    </div>
                  ) : null}
                  <button className="icon-button danger" title={t('Delete scan')} disabled={busyScan === scan.id} onClick={() => remove(scan)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<AlertTriangle size={26} />} title={t('No scans yet')} text={t('Your photo diagnoses will appear here.')} />
        )}
      </section>
    </div>
  );
}
