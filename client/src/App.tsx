import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StaffManagementPage } from './pages/StaffManagementPage.js';
import { BatchesPage } from './pages/BatchesPage.js';
import { BatchDetailPage } from './pages/BatchDetailPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { StudentDetailPage } from './pages/StudentDetailPage.js';
import ReportsPage from './pages/ReportsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root path redirect to Dashboard (ProtectedRoute will redirect to /login if unauthenticated) */}
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
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
