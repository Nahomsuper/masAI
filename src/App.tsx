import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LanguageProvider } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/Ui';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CropsPage } from './pages/CropsPage';
import { NewCropPage } from './pages/NewCropPage';
import { CropDetailPage } from './pages/CropDetailPage';
import { RecordPage } from './pages/RecordPage';
import { ScanPage } from './pages/ScanPage';
import { NotFoundPage } from './pages/NotFoundPage';

function RequireAuth() {
  const { token, ready } = useAuth();
  if (!ready) return <Spinner label="Checking your session…" />;
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth();
  if (!ready) return <Spinner label="Checking your session…" />;
  return token ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="crops" element={<CropsPage />} />
                <Route path="crops/new" element={<NewCropPage />} />
                <Route path="crops/:id" element={<CropDetailPage />} />
                <Route path="crops/:id/records/new" element={<RecordPage />} />
                <Route path="scan" element={<ScanPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
