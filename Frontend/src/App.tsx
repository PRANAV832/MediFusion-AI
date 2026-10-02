import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { Patient360Page } from './pages/Patient360Page';
import { CaseWorkspacePage } from './pages/CaseWorkspacePage';
import { NewCasePage } from './pages/NewCasePage';
import { ModelRegistryPage } from './pages/ModelRegistryPage';
import { ModelDetailPage } from './pages/ModelDetailPage';
import { CapabilityCatalogPage } from './pages/CapabilityCatalogPage';
import { ResourceSchedulerPage } from './pages/ResourceSchedulerPage';
import { LiveOrchestrationPage } from './pages/LiveOrchestrationPage';
import { EvidenceGraphPage } from './pages/EvidenceGraphPage';
import { ScreeningReportsPage } from './pages/ScreeningReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected clinical routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<Patient360Page />} />
                <Route path="/cases/new" element={<NewCasePage />} />
                <Route path="/cases/:id" element={<CaseWorkspacePage />} />
                <Route path="/orchestration" element={<LiveOrchestrationPage />} />
                <Route path="/orchestration/:caseId" element={<LiveOrchestrationPage />} />
                <Route path="/evidence-graph" element={<EvidenceGraphPage />} />
                <Route path="/evidence-graph/:caseId" element={<EvidenceGraphPage />} />
                <Route path="/reports" element={<ScreeningReportsPage />} />
                <Route path="/reports/:caseId" element={<ScreeningReportsPage />} />
                <Route path="/registry" element={<ModelRegistryPage />} />
                <Route path="/registry/:id" element={<ModelDetailPage />} />
                <Route path="/capabilities" element={<CapabilityCatalogPage />} />
                <Route path="/scheduler" element={<ResourceSchedulerPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
