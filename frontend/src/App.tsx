import type { ReactNode } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/pages/Dashboard';
import { DeviceConfig } from '@/pages/DeviceConfig';
import { LineDetail } from '@/pages/LineDetail';
import { Alerts } from '@/pages/Alerts';
import { Reports } from '@/pages/Reports';
import { Login } from '@/pages/Login';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RequireAuth } from '@/components/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
});

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/lines/mozzecane/line-01', label: 'Linea' },
  { to: '/devices', label: 'Macchine' },
  { to: '/alerts', label: 'Allarmi' },
  { to: '/reports', label: 'Report' }
];

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-steel-50">
      <nav className="border-b border-steel-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-safety-500" aria-hidden="true" />
            <span className="font-bold text-steel-900">FactoryMind</span>
            <span className="ml-2 rounded bg-steel-100 px-2 py-0.5 text-xs text-steel-600">v1.0</span>
          </div>
          <ul className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `px-2 py-1 rounded ${isActive ? 'bg-steel-900 text-white' : 'text-steel-700 hover:text-steel-900'}`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            {/* Public route — no Shell, no RequireAuth. */}
            <Route path="/login" element={<Login />} />

            {/* Authenticated routes share the chrome + the auth guard. */}
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Shell>
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/lines/:facility/:line" element={<LineDetail />} />
                        <Route path="/devices" element={<DeviceConfig />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/reports" element={<Reports />} />
                      </Routes>
                    </ErrorBoundary>
                  </Shell>
                </RequireAuth>
              }
            />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
