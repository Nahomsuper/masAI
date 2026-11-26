import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Droplets, Leaf, Loader2, ScanLine, Sprout } from 'lucide-react';
import { ApiError, api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { LanguageToggle } from '../components/LanguageToggle';

type Mode = 'login' | 'register';

export function LoginPage() {
  const { signIn, startDemo } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoCrops, setDemoCrops] = useState<string[]>([]);

  useEffect(() => {
    api.demoPreview().then((preview) => setDemoCrops(preview.crops.map((crop) => crop.name))).catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        const response = await api.register({ name, phone, pin, region: region || undefined });
        signIn(response);
      } else {
        const response = await api.login({ phone, pin });
        signIn(response);
      }
      navigate('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not sign in. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const openDemo = async () => {
    setDemoBusy(true);
    setError('');
    try {
      await startDemo();
      navigate('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('Could not open the demo farm.'));
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-story">
        <div className="auth-brand">
          <div className="brand-mark"><Leaf size={24} /></div>
          <div>
            <strong>MasAI</strong>
            <span>{t('Pre-prediction farming')}</span>
          </div>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">{t('Built for the field')}</span>
          <h1>
            {lang === 'am' ? (
              <>ሰብልዎ ችግር ላይ መሆኑን <em>ከማየትዎ በፊት</em> ይወቁ።</>
            ) : (
              <>Know your crop is in trouble <em>before</em> you can see it.</>
            )}
          </h1>
          <p>{t('Log what you did today. MasAI compares it with the care plan, watches for missing records, and warns you while there is still time to act.')}</p>
          <div className="auth-features">
            <div><Sprout size={18} /><span>{t('Daily care plan for every crop')}</span></div>
            <div><Droplets size={18} /><span>{t('Water and damage prediction')}</span></div>
            <div><ScanLine size={18} /><span>{t('Photo diagnosis that updates the report')}</span></div>
          </div>
        </div>
        <div className="auth-story-foot">
          <CheckCircle2 size={16} />
          {t('Records are stored locally in SQLite on this device.')}
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-lang"><LanguageToggle /></div>
        <div className="auth-card">
          <span className="eyebrow">{t('Welcome to MasAI')}</span>
          <h2>{t(mode === 'login' ? 'Sign in to your farm' : 'Create your farm')}</h2>
          <p className="muted">
            {t(mode === 'login' ? 'Use your phone number and PIN to continue.' : 'A 4 to 8 digit PIN keeps your records private.')}
          </p>

          <div className="mode-switch">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>{t('Sign in')}</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>{t('Register')}</button>
          </div>

          <form onSubmit={submit} className="form-stack">
            {mode === 'register' ? (
              <label className="field">
                <span>{t('Full name')}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('e.g. Abebe Tola')} required maxLength={80} />
              </label>
            ) : null}
            <label className="field">
              <span>{t('Phone number')}</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('e.g. 0912345678')} inputMode="tel" required maxLength={20} />
            </label>
            <label className="field">
              <span>{t('PIN')}</span>
              <input value={pin} onChange={(event) => setPin(event.target.value)} type="password" placeholder={t('4–8 digits')} inputMode="numeric" pattern="[0-9]{4,8}" required maxLength={8} />
            </label>
            {mode === 'register' ? (
              <label className="field">
                <span>{t('Region')} <small>{t('optional')}</small></span>
                <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder={t('e.g. Oromia')} maxLength={80} />
              </label>
            ) : null}

            {error ? <div className="form-error">{error}</div> : null}

            <button className="button button-primary button-wide" type="submit" disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              {t(mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <div className="auth-divider"><span>{t('or explore first')}</span></div>

          <button className="button button-outline button-wide" onClick={openDemo} disabled={demoBusy}>
            {demoBusy ? <Loader2 className="spin" size={18} /> : <Sprout size={18} />}
            {t('Open the demo farm')}
          </button>
          {demoCrops.length ? (
            <p className="demo-hint">{t('Includes {crops} with real records and warnings.', { crops: demoCrops.join(', ') })}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
