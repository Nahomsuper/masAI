const currentLocale = () =>
  typeof document !== 'undefined' && document.documentElement.lang === 'am'
    ? 'am-ET-u-ca-gregory'
    : 'en-GB';

export const todayISO = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export const formatShortDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short' }).format(date);
};

export const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString(currentLocale(), { maximumFractionDigits: digits });

export const healthTone = (score: number) => (score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad');

export const categoryLabel = (category: string) =>
  ({
    healthy: 'Healthy',
    stressed: 'Stressed',
    needs_attention: 'Needs attention',
    recovering: 'Recovering',
    damaged: 'Damaged',
    diseased: 'Diseased',
    pest: 'Pest attack',
  })[category] ?? category.replace(/_/g, ' ');

export const humanize = (value: string) =>
  value
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase());
