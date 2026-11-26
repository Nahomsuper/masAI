import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useI18n } from '../i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="not-found">
      <Leaf size={32} />
      <h2>{t('This field is not on the map')}</h2>
      <p>{t('The page you were looking for does not exist.')}</p>
      <Link className="button button-primary" to="/">{t('Back to dashboard')}</Link>
    </div>
  );
}
