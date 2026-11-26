import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { Assessment, ReportUpdate } from '../types';
import { formatDate, formatNumber, healthTone } from '../lib/format';
import { categoryText, sourceText, useI18n } from '../i18n';

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading-state">
      <Loader2 className="spin" size={22} />
      <span>{label ? t(label) : t('Loading…')}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <div className="notice notice-bad" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>{t('Something needs attention')}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const Icon = tone === 'bad' || tone === 'warn' ? AlertTriangle : tone === 'good' ? CheckCircle2 : Info;
  return (
    <div className={`notice notice-${tone}`}>
      <Icon size={18} />
      <div>
        <strong>{t(title)}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function HealthRing({ score, size = 104 }: { score: number; size?: number }) {
  const { t } = useI18n();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const tone = healthTone(score);
  return (
    <div className="health-ring" style={{ width: size, height: size }} aria-label={`${t('health')} ${score}/100`}>
      <svg viewBox="0 0 100 100">
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle
          className={`ring-value ring-${tone}`}
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label">
        <strong>{score}</strong>
        <span>{t('health')}</span>
      </div>
    </div>
  );
}

export function Sparkline({ points }: { points: { date: string; health: number }[] }) {
  const { t } = useI18n();
  if (points.length < 2) return <p className="muted small">{t('More records will draw a trend.')}</p>;
  const values = points.map((point) => point.health);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = 4 + (index / (values.length - 1)) * 232;
    const y = 56 - ((value - min) / span) * 44;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = coords[coords.length - 1].split(',');
  return (
    <svg className="sparkline" viewBox="0 0 240 64" preserveAspectRatio="none" role="img" aria-label={t('Health trend')}>
      <polygon points={`4,60 ${coords.join(' ')} 236,60`} className="spark-fill" />
      <polyline points={coords.join(' ')} className="spark-line" />
      <circle cx={last[0]} cy={last[1]} r="3.5" className="spark-dot" />
    </svg>
  );
}

export function Progress({ value, tone = 'good' }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="progress-track">
      <div className={`progress-fill progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'good',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="stat-tile">
      <div className={`stat-icon stat-${tone}`}>{icon}</div>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const reportValueAm: Record<string, string> = {
  Healthy: 'ጤናማ',
  Stressed: 'ጭንቀት ላይ',
  'Needs attention': 'ትኩረት ይፈልጋል',
  Recovering: 'እያገገመ',
  Damaged: 'ተጎድቷል',
  Diseased: 'በሽታ አለበት',
  'Pest attack': 'ተባይ ጥቃት',
  unknown: 'ያልታወቀ',
  untracked: 'ያልተከታተለ',
  'on track': 'በትክክለኛው መንገድ',
  'under treatment': 'በሕክምና ላይ',
};

export function ReportUpdates({ updates }: { updates: ReportUpdate[] }) {
  const { lang, t } = useI18n();
  if (!updates.length) return null;
  const value = (input: string | null) => {
    if (!input) return '—';
    return lang === 'am' ? reportValueAm[input] ?? input : input;
  };
  return (
    <div className="report-updates">
      <h4>{t('Report changes')}</h4>
      <div className="update-list">
        {updates.map((update, index) => (
          <div className="update-row" key={`${update.field}-${index}`}>
            <span>{t(update.label)}</span>
            <span className="update-from">{value(update.from)}</span>
            <span className="update-arrow">→</span>
            <strong>{value(update.to)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const { lang, t } = useI18n();
  const tone = healthTone(assessment.healthScore);
  return (
    <article className="assessment-card">
      <header className="assessment-head">
        <div>
          <Badge tone={tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'bad'}>
            {categoryText(assessment.category, lang)}
          </Badge>
          <h3>{assessment.conditionLabel}</h3>
          <span className="muted small">
            {formatDate(assessment.createdAt)} · {assessment.model} · {sourceText(assessment.source, lang)}
          </span>
        </div>
        <div className="assessment-scores">
          <div>
            <strong>{assessment.healthScore}</strong>
            <span>{t('health')}</span>
          </div>
          <div>
            <strong>{formatNumber(assessment.damagePercent)}%</strong>
            <span>{t('damage')}</span>
          </div>
        </div>
      </header>
      <p className="assessment-summary">{assessment.summary}</p>

      {assessment.findings.length ? (
        <div className="assessment-group">
          <h4>{t('What was seen')}</h4>
          <ul className="tick-list">
            {assessment.findings.map((finding, index) => <li key={index}>{finding}</li>)}
          </ul>
        </div>
      ) : null}

      {assessment.actions.length ? (
        <div className="assessment-group">
          <h4>{t('What to do')}</h4>
          <ul className="tick-list action-list">
            {assessment.actions.map((action, index) => <li key={index}>{action}</li>)}
          </ul>
        </div>
      ) : null}

      {assessment.diagnosis.length ? (
        <div className="assessment-group">
          <h4>{t('Possible causes')}</h4>
          <div className="diagnosis-grid">
            {assessment.diagnosis.map((item, index) => (
              <div className="diagnosis-item" key={index}>
                <div>
                  <strong>{item.name}</strong>
                  <Badge tone={item.confidence >= 70 ? 'good' : 'warn'}>{t('{n}% sure', { n: item.confidence })}</Badge>
                </div>
                <p>{item.treatment}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
