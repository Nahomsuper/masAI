import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Plus,
  ScanLine,
  Sprout,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { LanguageToggle } from './LanguageToggle';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crops', label: 'My crops', icon: Sprout, end: false },
  { to: '/crops/new', label: 'Add crop', icon: Plus, end: false },
  { to: '/scan', label: 'AI photo scan', icon: ScanLine, end: false },
];

function pageTitle(pathname: string) {
  if (pathname === '/') return { title: 'Farm overview', subtitle: 'What the model sees across your fields today.' };
  if (pathname === '/crops') return { title: 'My crops', subtitle: 'Every field, its stage and its latest prediction.' };
  if (pathname === '/crops/new') return { title: 'Add a crop', subtitle: 'Register what you planted and get a care plan.' };
  if (pathname === '/scan') return { title: 'AI photo scan', subtitle: 'Take or upload a photo and let the agronomist look.' };
  return { title: 'MasAI', subtitle: 'Pre-prediction farming' };
}

export function Layout() {
  const { farmer, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const { title, subtitle } = pageTitle(location.pathname);

  useEffect(() => {
    api
      .health()
      .then((health) => setAiConfigured(health.aiConfigured))
      .catch(() => setAiConfigured(false));
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {menuOpen ? <button className="sidebar-scrim" aria-label={t('Close menu')} onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={21} /></div>
          <div>
            <strong>MasAI</strong>
            <span>{t('Pre-prediction farming')}</span>
          </div>
          <button className="icon-button sidebar-close" aria-label={t('Close menu')} onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="side-nav">
          <span className="nav-caption">{t('Workspace')}</span>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          {farmer ? (
            <div className="farmer-card">
              <div className="avatar">{farmer.name.slice(0, 1).toUpperCase()}</div>
              <div className="farmer-meta">
                <strong>{farmer.name}</strong>
                <span>{farmer.region || farmer.phone}</span>
              </div>
              <button className="icon-button" title={t('Sign out')} onClick={handleSignOut}><LogOut size={17} /></button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={t('Open menu')} onClick={() => setMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <h1>{t(title)}</h1>
            <p>{t(subtitle)}</p>
          </div>
          <div className="topbar-right">
            <LanguageToggle compact />
            <span className={`ai-chip ${aiConfigured ? 'live' : ''}`}>
              <Activity size={14} />
              {t(aiConfigured ? 'AI live' : 'Local mode')}
            </span>
            <div className="topbar-user">
              <span>{t('Hello,')}</span>
              <strong>{farmer?.name ?? t('Farmer')}</strong>
            </div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
