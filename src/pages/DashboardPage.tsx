import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardList,
  Droplets,
  Plus,
  Sprout,
} from 'lucide-react';
import { ApiError, api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatNumber, formatShortDate, healthTone } from '../lib/format';
import { severityText, stageText, statusText, useI18n, warningText } from '../i18n';
import type { DashboardData } from '../types';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  HealthRing,
  Progress,
  Spinner,
  StatTile,
} from '../components/Ui';

const severityTone = (severity: string) =>
  severity === 'critical' || severity === 'high' ? 'bad' : severity === 'medium' ? 'warn' : 'info';

export function DashboardPage() {
  const { farmer, startDemo } = useAuth();
  const { lang, t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .dashboard()
      .then(setData)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : t('Could not load your farm.')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openDemo = async () => {
    setDemoBusy(true);
    try {
      await startDemo();
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not open the demo farm.'));
    } finally {
      setDemoBusy(false);
    }
  };

  if (loading && !data) return <Spinner label="Reading your fields…" />;
  if (error && !data) return <ErrorBanner message={error} />;
  if (!data) return null;

  const { summary } = data;
  const greeting = new Intl.DateTimeFormat(lang === 'am' ? 'am-ET-u-ca-gregory' : 'en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${data.today}T12:00:00`));

  return (
    <div className="stack-lg">
      <div className="welcome-strip">
        <div>
          <span className="eyebrow">{greeting}</span>
          <h2>{t('Good to see you, {name}.', { name: farmer?.name?.split(' ')[0] ?? t('Farmer') })}</h2>
          <p>{t('Here is what the model predicts for your farm today.')}</p>
        </div>
        <Link className="button button-primary" to="/crops/new"><Plus size={17} /> {t('New crop')}</Link>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="stat-grid">
        <StatTile label={t('Active crops')} value={summary.activeCrops} hint={t('{n} total', { n: summary.totalCrops })} icon={<Sprout size={20} />} />
        <StatTile label={t('Average health')} value={`${summary.averageHealth}/100`} hint={t('{n} need attention', { n: summary.atRiskCrops })} icon={<Activity size={20} />} tone={summary.averageHealth >= 75 ? 'good' : summary.averageHealth >= 55 ? 'warn' : 'bad'} />
        <StatTile label={t('Records due today')} value={summary.pendingRecords} hint={t('{n} logged this week', { n: summary.recordsThisWeek })} icon={<ClipboardList size={20} />} tone={summary.pendingRecords ? 'warn' : 'good'} />
        <StatTile label={t('Highest damage')} value={`${summary.highestDamagePercent}%`} hint={t('{n} critical alerts', { n: summary.criticalAlerts })} icon={<AlertTriangle size={20} />} tone={summary.highestDamagePercent > 25 ? 'bad' : 'good'} />
      </div>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{t('Early warnings')}</h2>
              <p>{t('Ranked by how urgently they need your attention.')}</p>
            </div>
            <Badge tone={summary.criticalAlerts ? 'bad' : 'good'}>{t('{n} alerts', { n: data.alerts.length })}</Badge>
          </div>
          {data.alerts.length ? (
            <div className="alert-list">
              {data.alerts.slice(0, 8).map((alert) => {
                const view = data.crops.find((item) => item.crop.id === alert.cropId);
                const copy = warningText(alert, lang, view?.prediction, view?.latestAssessment);
                return (
                  <div className={`alert-item alert-${alert.severity}`} key={alert.id}>
                    <div className={`alert-icon alert-icon-${alert.severity}`}><AlertTriangle size={16} /></div>
                    <div className="alert-body">
                      <div className="alert-title-row">
                        <strong>{copy.title}</strong>
                        <Badge tone={severityTone(alert.severity)}>{severityText(alert.severity, lang)}</Badge>
                      </div>
                      <p>{copy.detail}</p>
                      <span className="alert-action">{copy.action}</span>
                    </div>
                    <Link className="alert-link" to={`/crops/${alert.cropId}`} aria-label={`${t('Open report')}: ${alert.cropName}`}>
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Activity size={26} />} title={t('No warnings right now')} text={t('Your records look consistent. Keep logging daily so the model stays honest.')} />
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{t('Due today')}</h2>
              <p>{t('Missing records lower predicted health.')}</p>
            </div>
            <Badge tone={data.pendingToday.length ? 'warn' : 'good'}>{t('{n} pending', { n: data.pendingToday.length })}</Badge>
          </div>
          {data.pendingToday.length ? (
            <div className="pending-list">
              {data.pendingToday.map((item) => (
                <div className="pending-item" key={item.cropId}>
                  <div className="pending-icon"><ClipboardList size={17} /></div>
                  <div className="pending-body">
                    <strong>{item.name}</strong>
                    <span>{item.fieldName || t('Unnamed field')} · {t('Day {day}', { day: item.dayNumber })}</span>
                    <span className="muted small">
                      {item.streakMissed > 0 ? `${t('{n} day gap', { n: item.streakMissed })} · ` : ''}
                      <Droplets size={12} /> {t('{n} L target', { n: formatNumber(item.waterTarget, 1) })}
                    </span>
                  </div>
                  <Link className="button button-small button-outline" to={`/crops/${item.cropId}/records/new`}>
                    {t('Log record')}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<ClipboardList size={26} />} title={t('All caught up')} text={t('Every active crop has a record for today.')} />
          )}
        </section>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>{t('Your crops')}</h2>
            <p>{t('Prediction health blends the last AI verdict with your record consistency.')}</p>
          </div>
          <Link className="text-link" to="/crops">{t('View all')} <ArrowRight size={15} /></Link>
        </div>

        {data.crops.length ? (
          <div className="crop-card-grid">
            {data.crops.slice(0, 6).map((view) => (
              <Link className="crop-card" to={`/crops/${view.crop.id}`} key={view.crop.id}>
                <div className="crop-card-head">
                  <div>
                    <h3>{view.crop.name}</h3>
                    <span>{view.crop.fieldName || view.crop.variety || t('Unnamed field')}</span>
                  </div>
                  <Badge tone={view.crop.status === 'active' ? 'good' : 'neutral'}>{statusText(view.crop.status, lang)}</Badge>
                </div>
                <div className="crop-card-main">
                  <HealthRing score={view.prediction.healthScore} size={92} />
                  <div className="crop-card-facts">
                    <span className="muted small">{t('Day {day} of {total}', { day: view.prediction.dayNumber, total: view.prediction.expectedDays })}</span>
                    <strong>{stageText(view.prediction.stage, lang)}</strong>
                    <span className="muted small"><CalendarDays size={12} /> {formatShortDate(view.prediction.predictedHarvestDate)} {t('harvest')}</span>
                    <Badge tone={view.prediction.recordStats.missingToday ? 'warn' : 'good'}>
                      {t(view.prediction.recordStats.missingToday ? 'Record due' : 'Logged today')}
                    </Badge>
                  </div>
                </div>
                <Progress value={view.prediction.progressPercent} tone={healthTone(view.prediction.healthScore)} />
                <div className="crop-card-foot">
                  <span><Camera size={13} /> {view.prediction.hasAssessment ? formatDate(view.latestAssessment?.createdAt) : t('No AI baseline')}</span>
                  <span>{t('Open report')} <ArrowRight size={13} /></span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Sprout size={28} />}
            title={t('Your farm is ready for its first crop')}
            text={t('Add what you planted and MasAI will build a care plan and start the prediction.')}
            action={
              <div className="empty-actions">
                <Link className="button button-primary" to="/crops/new"><Plus size={17} /> {t('Add a crop')}</Link>
                <button className="button button-outline" onClick={openDemo} disabled={demoBusy}>{t('Open demo farm')}</button>
              </div>
            }
          />
        )}
      </section>
    </div>
  );
}
