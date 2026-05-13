import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './lib/RequireAuth'
import { LoginPage } from './pages/Login'
import { AuthCallback } from './pages/AuthCallback'
import { PortalMode } from './pages/PortalMode'
import { DemoPage } from './pages/Demo'
import { DemoBanner } from './components/shared/DemoBanner'
import { DemoModeProvider } from './lib/demoMode'

// Portal layouts
import { AdminLayout } from './portals/admin/AdminLayout'
import { ClientLayout } from './portals/client/ClientLayout'
import { ReviewerLayout } from './portals/reviewer/ReviewerLayout'
import { SalesLayout } from './portals/sales/SalesLayout'

// Admin pages
import { AdminDashboard } from './portals/admin/Dashboard'
import { AdminJobs } from './portals/admin/Jobs'
import { AdminClients } from './portals/admin/Clients'
import { AdminClientDetail } from './portals/admin/ClientDetail'
import { AdminInsights } from './portals/admin/Insights'
import { AdminReviewerDetail } from './portals/admin/ReviewerDetail'
import { AdminSalespersonDetail } from './portals/admin/SalespersonDetail'
import { AdminReviewerInvoices } from './portals/admin/ReviewerInvoices'
import { SalesLeads } from './portals/sales/Leads'
import { LeadDetail } from './portals/sales/LeadDetail'
import { AdminReviewers } from './portals/admin/Reviewers'
import { AdminSales } from './portals/admin/Sales'
import { AdminQuotes } from './portals/admin/Quotes'
import { AdminInvoices } from './portals/admin/Invoices'
import { AdminSettings } from './portals/admin/Settings'
import { AdminAuditLog } from './portals/admin/AuditLog'
import { AdminCron } from './portals/admin/Cron'
import { AdminSystemReset } from './portals/admin/SystemReset'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
        <DemoModeProvider>
          <DemoBanner />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/portal-mode" element={<PortalMode />} />
            <Route path="/demo" element={<DemoPage />} />

            {/* Admin portal */}
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminLayout /></RequireAuth>}>
              <Route index element={<AdminDashboard />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="clients/:id" element={<AdminClientDetail />} />
              <Route path="insights" element={<AdminInsights />} />
              <Route path="reviewers" element={<AdminReviewers />} />
              <Route path="reviewers/:id" element={<AdminReviewerDetail />} />
              <Route path="sales" element={<AdminSales />} />
              <Route path="sales/:id" element={<AdminSalespersonDetail />} />
              <Route path="reviewer-invoices" element={<AdminReviewerInvoices />} />
              <Route path="leads" element={<SalesLeads />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="quotes" element={<AdminQuotes />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="cron" element={<AdminCron />} />
              <Route path="system-reset" element={<AdminSystemReset />} />
            </Route>

            {/* Client portal */}
            <Route path="/client/*" element={
              <RequireAuth allowedRoles={['client', 'admin']}>
                <ClientLayout />
              </RequireAuth>
            } />

            {/* Reviewer portal */}
            <Route path="/reviewer/*" element={
              <RequireAuth allowedRoles={['reviewer', 'admin']}>
                <ReviewerLayout />
              </RequireAuth>
            } />

            {/* Salesperson portal */}
            <Route path="/sales/*" element={
              <RequireAuth allowedRoles={['salesperson', 'admin']}>
                <SalesLayout />
              </RequireAuth>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </DemoModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
