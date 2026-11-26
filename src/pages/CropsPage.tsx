import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, ClipboardList, Droplets, Plus, Search, Sprout, Trash2 } from 'lucide-react';
import { ApiError, api } from '../api/client';
import { formatDate, formatNumber, healthTone } from '../lib/format';
import { severityText, stageText, statusText, useI18n } from '../i18n';
import type { CropView } from '../types';
import { Badge, EmptyState, ErrorBanner, HealthRing, Progress, Spinner } from '../components/Ui';

export function CropsPage() {
  const { lang, t } = useI18n();
  const [crops, setCrops] = useState<CropView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'harvested' | 'failed'>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .crops()
      .then(({ crops: rows }) => setCrops(rows))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : t('Could not load crops.')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return crops.filter((view) => {
      if (filter !== 'all' && view.crop.status !== filter) return false;
      if (!needle) return true;
      return [view.crop.name, view.crop.variety, view.crop.fieldName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [crops, filter, query]);

  const remove = async (id: number) => {
    if (!window.confirm(t('Delete this crop and all of its records?'))) return;
    setBusyId(id);
    try {
      await api.deleteCrop(id);
      setCrops((current) => current.filter((view) => view.crop.id !== id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not delete this crop.'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !crops.length) return <Spinner label="Loading crops…" />;

  return (
    <div className="stack-lg">
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search crop, variety or field')} />
        </label>
        <div className="filter-tabs">
          {(['all', 'active', 'harvested', 'failed'] as const).map((value) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {t(value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1))}
            </button>
          ))}
        </div>
        <Link className="button button-primary" to="/crops/new"><Plus size={17} /> {t('Add crop')}</Link>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {filtered.length ? (
        <div className="crop-list">
          {filtered.map((view) => (
            <article className="crop-row" key={view.crop.id}>
              <HealthRing score={view.prediction.healthScore} size={78} />
              <div className="crop-row-main">
                <div className="crop-row-title">
                  <h3>{view.crop.name}</h3>
                  {view.crop.variety ? <span className="muted">{view.crop.variety}</span> : null}
                  <Badge tone={view.crop.status === 'active' ? 'good' : 'neutral'}>{statusText(view.crop.status, lang)}</Badge>
                  {view.topSeverity !== 'none' ? (
                    <Badge tone={view.topSeverity === 'critical' || view.topSeverity === 'high' ? 'bad' : 'warn'}>
                      {t('{severity} priority', { severity: severityText(view.topSeverity, lang) })}
                    </Badge>
                  ) : null}
                </div>
                <div className="crop-row-meta">
                  <span>{t('Day {day}/{total}', { day: view.prediction.dayNumber, total: view.prediction.expectedDays })}</span>
                  <span>{stageText(view.prediction.stage, lang)}</span>
                  <span><Droplets size={13} /> {t('{n} L today', { n: formatNumber(view.prediction.water.expectedToday, 1) })}</span>
                  <span><ClipboardList size={13} /> {t('{n}% logged', { n: view.prediction.recordStats.completenessPct })}</span>
                  <span><Camera size={13} /> {view.prediction.hasAssessment ? formatDate(view.latestAssessment?.createdAt) : t('no scan')}</span>
                </div>
                <Progress value={view.prediction.progressPercent} tone={healthTone(view.prediction.healthScore)} />
              </div>
              <div className="crop-row-actions">
                <Link className="button button-small button-outline" to={`/crops/${view.crop.id}`}>{t('Report')} <ArrowRight size={14} /></Link>
                <Link className="button button-small button-quiet" to={`/crops/${view.crop.id}/records/new`}>{t('Log today')}</Link>
                <button className="icon-button danger" title={t('Delete crop')} disabled={busyId === view.crop.id} onClick={() => remove(view.crop.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Sprout size={28} />}
          title={t(crops.length ? 'No crops match that search' : 'No crops yet')}
          text={t(crops.length ? 'Try another search or change the filter.' : 'Register a crop to start your prediction.')}
          action={!crops.length ? <Link className="button button-primary" to="/crops/new"><Plus size={17} /> {t('Add a crop')}</Link> : undefined}
        />
      )}
    </div>
  );
}
