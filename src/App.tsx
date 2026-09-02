import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ResponsiveShell } from '@/layouts/ResponsiveShell'
import Login from '@/pages/Login'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Sales = lazy(() => import('@/pages/Sales'))
const Purchases = lazy(() => import('@/pages/Purchases'))
const Customers = lazy(() => import('@/pages/Customers'))
const Suppliers = lazy(() => import('@/pages/Suppliers'))
const Products = lazy(() => import('@/pages/Products'))
const Debts = lazy(() => import('@/pages/Debts'))
const Returns = lazy(() => import('@/pages/Returns'))
const Reports = lazy(() => import('@/pages/Reports'))
const Settings = lazy(() => import('@/pages/Settings'))
const Backup = lazy(() => import('@/pages/Backup'))

function PageFallback() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brass-500 border-t-transparent" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
})

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <ResponsiveShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
              <Route path="/sales" element={<Suspense fallback={<PageFallback />}><Sales /></Suspense>} />
              <Route path="/purchases" element={<Suspense fallback={<PageFallback />}><Purchases /></Suspense>} />
              <Route path="/customers" element={<Suspense fallback={<PageFallback />}><Customers /></Suspense>} />
              <Route path="/suppliers" element={<Suspense fallback={<PageFallback />}><Suppliers /></Suspense>} />
              <Route path="/products" element={<Suspense fallback={<PageFallback />}><Products /></Suspense>} />
              <Route path="/debts" element={<Suspense fallback={<PageFallback />}><Debts /></Suspense>} />
              <Route path="/returns" element={<Suspense fallback={<PageFallback />}><Returns /></Suspense>} />
              <Route path="/reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
              <Route path="/backup" element={<ProtectedRoute roles={['owner', 'admin']}><Suspense fallback={<PageFallback />}><Backup /></Suspense></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={['owner', 'admin']}><Suspense fallback={<PageFallback />}><Settings /></Suspense></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
