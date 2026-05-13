import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './lib/RequireAuth'
import { LoginPage } from './pages/Login'
import { DemoSwitcher } from './components/shared/DemoSwitcher'

// Portal layouts
import { AdminLayout } from './portals/admin/AdminLayout'
import { ClientLayout } from './portals/client/ClientLayout'
import { ReviewerLayout } from './portals/reviewer/ReviewerLayout'
import { SalesLayout } from './portals/sales/SalesLayout'

// Admin pages
import { AdminDashboard } from './portals/admin/Dashboard'
import { AdminJobs } from './portals/admin/Jobs'
import { AdminClients } from './portals/admin/Clients'
import { AdminInsights } from './portals/admin/Insights'
import { AdminReviewers } from './portals/admin/Reviewers'
import { AdminSales } from './portals/admin/Sales'
import { AdminQuotes } from './portals/admin/Quotes'
import { AdminInvoices } from './portals/admin/Invoices'
import { AdminSettings } from './portals/admin/Settings'
import { AdminAuditLog } from './portals/admin/AuditLog'
import { AdminCron } from './portals/admin/Cron'

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
          <DemoSwitcher />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin portal */}
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminLayout /></RequireAuth>}>
              <Route index element={<AdminDashboard />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="insights" element={<AdminInsights />} />
              <Route path="reviewers" element={<AdminReviewers />} />
              <Route path="sales" element={<AdminSales />} />
              <Route path="quotes" element={<AdminQuotes />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
              <Route path="cron" element={<AdminCron />} />
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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
