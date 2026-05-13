import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './lib/RequireAuth'
import { LoginPage } from './pages/Login'

// Portal layouts
import { AdminLayout } from './portals/admin/AdminLayout'
import { ClientLayout } from './portals/client/ClientLayout'
import { ReviewerLayout } from './portals/reviewer/ReviewerLayout'

// Admin pages
import { AdminDashboard } from './portals/admin/Dashboard'
import { AdminJobs } from './portals/admin/Jobs'
import { AdminClients } from './portals/admin/Clients'
import { AdminReviewers } from './portals/admin/Reviewers'
import { AdminSettings } from './portals/admin/Settings'
import { PlaceholderPage } from './components/shared/PlaceholderPage'

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin portal */}
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminLayout /></RequireAuth>}>
              <Route index element={<AdminDashboard />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="reviewers" element={<AdminReviewers />} />
              <Route path="quotes" element={
                <PlaceholderPage
                  title="Quotes"
                  icon="file-text"
                  items={['Create and send branded quotes to prospects', 'Convert accepted quotes into client organisations', 'Track pipeline value and conversion rates']}
                />
              } />
              <Route path="invoices" element={
                <PlaceholderPage
                  title="Invoices & Payouts"
                  icon="receipt"
                  items={['Monthly subscription invoices synced to Xero', 'Overflow and expedited charge billing', 'Reviewer payout processing on the 28th']}
                />
              } />
              <Route path="settings" element={<AdminSettings />} />
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

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
