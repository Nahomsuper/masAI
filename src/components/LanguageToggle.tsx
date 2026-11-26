import { useI18n } from '../i18n';

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`lang-toggle ${compact ? 'lang-toggle-compact' : ''}`} role="group" aria-label={t('Language')}>
      <button
        type="button"
        className={lang === 'am' ? 'active' : ''}
        aria-pressed={lang === 'am'}
        onClick={() => setLang('am')}
      >
        አማ
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
