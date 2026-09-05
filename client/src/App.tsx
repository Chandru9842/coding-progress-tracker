import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { Loader2 } from 'lucide-react';

const LoginPage = lazy(() => import('./pages/LoginPage.js').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage.js').then((m) => ({ default: m.StaffManagementPage })));
const BatchesPage = lazy(() => import('./pages/BatchesPage.js').then((m) => ({ default: m.BatchesPage })));
const BatchDetailPage = lazy(() => import('./pages/BatchDetailPage.js').then((m) => ({ default: m.BatchDetailPage })));
const StudentsPage = lazy(() => import('./pages/StudentsPage.js').then((m) => ({ default: m.StudentsPage })));
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage.js').then((m) => ({ default: m.StudentDetailPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage.js'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })));

const RouteLoadingFallback: React.FC = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      color: 'var(--text-secondary)',
    }}
  >
    <Loader2 className="animate-spin" size={30} style={{ color: 'var(--primary)' }} />
    <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em' }}>Loading...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Root path redirect to Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Public Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/staff-management" element={<StaffManagementPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/batches/:batchId" element={<BatchDetailPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/:studentId" element={<StudentDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Dedicated 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
