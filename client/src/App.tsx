import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { AutoSyncDaemon } from './components/AutoSyncDaemon.js';
import { InteractiveLoader } from './components/InteractiveLoader.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage.js').then((m) => ({ default: m.StaffManagementPage })));
const BatchesPage = lazy(() => import('./pages/BatchesPage.js').then((m) => ({ default: m.BatchesPage })));
const BatchDetailPage = lazy(() => import('./pages/BatchDetailPage.js').then((m) => ({ default: m.BatchDetailPage })));
const StudentsPage = lazy(() => import('./pages/StudentsPage.js').then((m) => ({ default: m.StudentsPage })));
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage.js').then((m) => ({ default: m.StudentDetailPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage.js'));
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage.js').then((m) => ({ default: m.DiagnosticsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })));

const RouteLoadingFallback: React.FC = () => (
  <InteractiveLoader
    mode="fullscreen"
    title="INITIALIZING WORKSPACE VIEWPORT"
    subtitle="Streaming module bundle • GPU-accelerated rendering active"
  />
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AutoSyncDaemon />
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Root path redirect to Dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes (Admin & Staff) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/batches/:batchId" element={<BatchDetailPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:studentId" element={<StudentDetailPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Admin Only Protected Routes */}
              <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
                <Route path="/staff-management" element={<StaffManagementPage />} />
                <Route path="/diagnostics" element={<DiagnosticsPage />} />
              </Route>

              {/* Dedicated 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
