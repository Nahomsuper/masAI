import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardList,
  Droplets,
  Gauge,
  Leaf,
  MapPin,
  RefreshCw,
  Sprout,
  Trash2,
} from 'lucide-react';
import { ApiError, api } from '../api/client';
import { formatDate, formatNumber, formatShortDate, healthTone } from '../lib/format';
import {
  healthLabel,
  riskText,
  severityText,
  sourceText,
  stageText,
  statusText,
  useI18n,
  warningText,
} from '../i18n';
import type { Crop, CropView } from '../types';
import {
  AssessmentCard,
  Badge,
  EmptyState,
  ErrorBanner,
  HealthRing,
  Notice,
  Progress,
  ReportUpdates,
  Section,
  Sparkline,
  Spinner,
} from '../components/Ui';

export function CropDetailPage() {
  const { id } = useParams();
  const cropId = Number(id);
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const [data, setData] = useState<CropView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    if (!Number.isFinite(cropId)) {
      setError(t('That crop link is not valid.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .crop(cropId)
      .then(setData)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : t('Could not load this crop.')))
      .finally(() => setLoading(false));
  }, [cropId, t]);

  useEffect(() => { load(); }, [load]);

  const replan = async () => {
    setBusy('replan');
    setError('');
    try {
      setData(await api.replanCrop(cropId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not rebuild the plan.'));
    } finally {
      setBusy('');
    }
  };

  const changeStatus = async (status: Crop['status']) => {
    setBusy('status');
    try {
      setData(await api.updateCrop(cropId, { status }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not update the status.'));
    } finally {
      setBusy('');
    }
  };

  const removeCrop = async () => {
    if (!window.confirm(t('Delete this crop and all its records and assessments?'))) return;
    setBusy('delete');
    try {
      await api.deleteCrop(cropId);
      navigate('/crops');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not delete this crop.'));
      setBusy('');
    }
  };

  const removeRecord = async (recordId: number) => {
    if (!window.confirm(t('Delete this daily record?'))) return;
    setBusy(`record-${recordId}`);
    try {
      setData(await api.deleteRecord(cropId, recordId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not delete that record.'));
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <Spinner label="Opening crop report…" />;
  if (error && !data) return <ErrorBanner message={error} />;
  if (!data) return null;

  const { crop, prediction, warnings, latestAssessment } = data;
  const plan = crop.plan ?? {};
  const tone = healthTone(prediction.healthScore);

  return (
    <div className="stack-lg">
      <Link className="back-link" to="/crops"><ArrowLeft size={16} /> {t('Back to crops')}</Link>

      {error ? <ErrorBanner message={error} /> : null}
      {data.aiWarning ? <Notice tone="warn" title="AI plan fallback">{data.aiWarning}</Notice> : null}

      <div className="detail-header">
        <div>
          <div className="detail-title-row">
            <h2>{crop.name}</h2>
            <Badge tone={crop.status === 'active' ? 'good' : 'neutral'}>{statusText(crop.status, lang)}</Badge>
            <Badge tone={tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'bad'}>{healthLabel(prediction.healthScore, lang)}</Badge>
          </div>
          <p className="muted">
            {crop.variety ? `${crop.variety} · ` : ''}
            {crop.fieldName ? <><MapPin size={13} /> {crop.fieldName} · </> : null}
            {t('Planted {date} · plan from {source}', { date: formatDate(crop.plantedAt), source: sourceText(crop.planSource, lang) })}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="button button-primary" to={`/crops/${crop.id}/records/new`}><ClipboardList size={16} /> {t("Log today's record")}</Link>
          <Link className="button button-outline" to={`/scan?cropId=${crop.id}`}><Camera size={16} /> {t('Scan photo')}</Link>
        </div>
      </div>

      <section className="panel overview-panel">
        <div className="overview-hero">
          <HealthRing score={prediction.healthScore} size={126} />
          <div className="overview-copy">
            <span className="eyebrow">{t('Pre-prediction report')}</span>
            <h3>{t('{stage} · day {day} of {total}', { stage: stageText(prediction.stage, lang), day: prediction.dayNumber, total: prediction.expectedDays })}</h3>
            <p>
              {prediction.recordPenalty > 0
                ? t("Missing records have already lowered this crop's health by {n} points.", { n: prediction.recordPenalty })
                : t('Record keeping is protecting this crop’s predicted health.')}
            </p>
            <div className="overview-badges">
              <Badge tone={prediction.riskLevel === 'low' ? 'good' : prediction.riskLevel === 'moderate' ? 'warn' : 'bad'}>
                {t('{risk} risk', { risk: riskText(prediction.riskLevel, lang) })}
              </Badge>
              <Badge tone="neutral">{t('{n}% damage', { n: prediction.damagePercent })}</Badge>
              <Badge tone="neutral">{t('{n}% yield forecast', { n: prediction.yieldForecastPct })}</Badge>
              <Badge tone="info">{t('{n}% confidence', { n: prediction.confidencePct })}</Badge>
            </div>
          </div>
          <div className="overview-progress">
            <span className="muted small">{t('Season progress')}</span>
            <strong>{prediction.progressPercent}%</strong>
            <Progress value={prediction.progressPercent} tone={tone} />
            <span className="muted small">{t('Next: {stage}', { stage: prediction.nextStage ? stageText(prediction.nextStage, lang) : t('Harvest') })}</span>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric"><Droplets size={17} /><span>{t('Water today')}</span><strong>{formatNumber(prediction.water.expectedToday, 1)} L</strong></div>
          <div className="metric"><ClipboardList size={17} /><span>{t('Records')}</span><strong>{prediction.recordStats.logged}/{prediction.recordStats.expectedRecords}</strong></div>
          <div className="metric"><Gauge size={17} /><span>{t('Record completeness')}</span><strong>{prediction.recordStats.completenessPct}%</strong></div>
          <div className="metric"><CalendarDays size={17} /><span>{t('Predicted harvest')}</span><strong>{formatShortDate(prediction.predictedHarvestDate)}</strong></div>
          <div className="metric"><Activity size={17} /><span>{t('Harvest shift')}</span><strong>{t('{n} days later', { n: prediction.harvestDelayDays })}</strong></div>
          <div className="metric"><Sprout size={17} /><span>{t('Water balance 7d')}</span><strong>{prediction.water.balancePct}%</strong></div>
        </div>

        <div className="trend-block">
          <div className="section-heading compact">
            <div><h3>{t('Health trend')}</h3><p>{t('Last 21 days, reconstructed from records and AI verdicts.')}</p></div>
            <Badge tone={prediction.recordStats.missingToday ? 'warn' : 'good'}>
              {t(prediction.recordStats.missingToday ? 'Today not logged' : 'Logged today')}
            </Badge>
          </div>
          <Sparkline points={prediction.trend} />
        </div>
      </section>

      <Section title={t('Warnings')} subtitle={t('Why the prediction is moving, and what to do about it.')}>
        {warnings.length ? (
          <div className="warning-grid">
            {warnings.map((warning) => {
              const copy = warningText(warning, lang, prediction, latestAssessment);
              return (
                <div className={`warning-card warning-${warning.severity}`} key={warning.id}>
                  <Badge tone={warning.severity === 'critical' || warning.severity === 'high' ? 'bad' : warning.severity === 'medium' ? 'warn' : 'info'}>
                    {severityText(warning.severity, lang)}
                  </Badge>
                  <h4>{copy.title}</h4>
                  <p>{copy.detail}</p>
                  <strong>→ {copy.action}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Activity size={26} />} title={t('No warnings')} text={t('This crop is on track. Keep the daily record going.')} />
        )}
      </Section>

      <Section
        title={t('Latest AI assessment')}
        subtitle={t('Photo and record verdicts feed directly into the report.')}
        action={<Link className="text-link" to={`/scan?cropId=${crop.id}`}>{t('New scan')} <ArrowRight size={15} /></Link>}
      >
        {latestAssessment ? (
          <div className="stack-md">
            <AssessmentCard assessment={latestAssessment} />
            <ReportUpdates updates={latestAssessment.reportUpdates ?? []} />
          </div>
        ) : (
          <EmptyState
            icon={<Camera size={26} />}
            title={t('No AI baseline yet')}
            text={t('Scan a photo to let the agronomist judge the real condition of this crop.')}
            action={<Link className="button button-outline" to={`/scan?cropId=${crop.id}`}><Camera size={16} /> {t('Scan a photo')}</Link>}
          />
        )}
      </Section>

      <Section
        title={t('Care plan')}
        subtitle={t('{days} days · {source} plan', {
          days: plan.expectedDaysToHarvest ?? crop.expectedDays,
          source: sourceText(String(plan.source ?? crop.planSource), lang),
        })}
        action={
          <button className="button button-small button-outline" onClick={replan} disabled={busy === 'replan'}>
            <RefreshCw className={busy === 'replan' ? 'spin' : ''} size={15} /> {t('Rebuild')}
          </button>
        }
      >
        <div className="plan-grid">
          <div className="plan-card">
            <h4>{t('Water and soil')}</h4>
            <p>{plan.wateringNote ?? t('Follow the stage targets above.')}</p>
            <dl className="detail-list">
              <div><dt>{t('Target per day')}</dt><dd>{formatNumber(plan.waterLitresPerDay ?? plan.waterLitresPerSqmPerDay, 1)} L</dd></div>
              <div><dt>{t('Soil pH')}</dt><dd>{plan.soil?.phLow ?? '—'}–{plan.soil?.phHigh ?? '—'}</dd></div>
              <div><dt>{t('Spacing')}</dt><dd>{plan.spacingCm ?? '—'} cm</dd></div>
              <div><dt>{t('Sunlight')}</dt><dd>{plan.sunlightHours ?? '—'} {t('hours')}</dd></div>
            </dl>
            <p className="muted small">{plan.soil?.texture}</p>
          </div>

          <div className="plan-card">
            <h4>{t('Growth stages')}</h4>
            <div className="stage-list">
              {(plan.stages ?? []).map((stage) => (
                <div className={`stage-row ${prediction.dayNumber >= stage.startDay && prediction.dayNumber < stage.endDay ? 'current' : ''}`} key={stage.key}>
                  <span className="stage-dot" />
                  <div>
                    <strong>{stageText(stage, lang)}</strong>
                    <span>{t('Day {day}', { day: stage.startDay })}–{stage.endDay} · {stage.focus}</span>
                  </div>
                  <span className="muted small">{formatNumber(stage.waterLitresPerSqmPerDay, 1)} L/m²</span>
                </div>
              ))}
            </div>
          </div>

          <div className="plan-card">
            <h4>{t('Feeding calendar')}</h4>
            <ul className="plain-list">
              {(plan.feedSchedule ?? []).map((item, index) => (
                <li key={index}><span>{t('Day {day}', { day: item.day })}</span>{item.task}</li>
              ))}
            </ul>
          </div>

          <div className="plan-card">
            <h4>{t('Watch for')}</h4>
            <ul className="plain-list">
              {(plan.commonPests ?? []).map((pest, index) => (
                <li key={index}><span>{pest.name}</span>{pest.signs} — {pest.treatment}</li>
              ))}
            </ul>
            <h4 className="subhead">{t('Harvest signs')}</h4>
            <ul className="tick-list compact">
              {(plan.harvestSigns ?? []).map((sign, index) => <li key={index}>{sign}</li>)}
            </ul>
          </div>
        </div>
        {plan.riskNotes?.length ? (
          <div className="risk-note"><Leaf size={16} /><div>{plan.riskNotes.map((note, index) => <p key={index}>{note}</p>)}</div></div>
        ) : null}
      </Section>

      <Section
        title={t('Daily records')}
        subtitle={t('{n} stored · newest first', { n: data.records.length })}
        action={<Link className="button button-small button-primary" to={`/crops/${crop.id}/records/new`}><ClipboardList size={15} /> {t('Add record')}</Link>}
      >
        {data.records.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>{t('Date')}</th><th>{t('Water')}</th><th>{t('Height')}</th><th>{t('Leaves')}</th><th>{t('Soil')}</th><th>{t('Pests')}</th><th>{t('Notes')}</th><th /></tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{formatShortDate(record.recordDate)}</strong></td>
                    <td>{formatNumber(record.waterLiters, 1)} L</td>
                    <td>{formatNumber(record.growthCm)} cm</td>
                    <td>{record.leafColour ?? '—'}</td>
                    <td>{record.soilMoisture ?? '—'}</td>
                    <td>{record.pestsSeen ?? '—'}</td>
                    <td className="notes-cell">{record.notes ?? '—'}</td>
                    <td>
                      <button className="icon-button danger" title={t('Delete record')} disabled={busy === `record-${record.id}`} onClick={() => removeRecord(record.id)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ClipboardList size={26} />} title={t('No records yet')} text={t('Log what you did today to start the prediction.')} />
        )}
      </Section>

      <div className="detail-footer">
        <label className="inline-field">
          <span>{t('Field status')}</span>
          <select value={crop.status} onChange={(event) => changeStatus(event.target.value as Crop['status'])} disabled={busy === 'status'}>
            <option value="active">{t('Active')}</option>
            <option value="harvested">{t('Harvested')}</option>
            <option value="failed">{t('Failed')}</option>
          </select>
        </label>
        <button className="button button-danger" onClick={removeCrop} disabled={busy === 'delete'}><Trash2 size={16} /> {t('Delete crop')}</button>
      </div>
    </div>
  );
}
