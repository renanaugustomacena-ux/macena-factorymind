# FactoryMind Frontend

React 18 + Vite 7 + TypeScript 5 + TailwindCSS + react-router-dom + @tanstack/react-query + recharts.

The frontend is the operator dashboard: real-time OEE gauges, machine status, alert feed, shift reports, attestazione PDF generation. Bundled production size: 688 KB JS, no sourcemaps (R-FRONTEND-SOURCEMAP-001).

## Layout

```
src/
  App.tsx                 # router + RequireAuth wrapper; public routes (/login) outside the guard
  pages/                  # Dashboard, Reports, Login, …
  components/             # OEEGauge, AlertFeed, MachineStatus, ErrorBoundary, RequireAuth, …
  api/client.ts           # axios with `withCredentials: true`, CSRF mirror, 401 → /login redirect
  i18n/useT.ts            # lightweight i18n hook (3 locales, no react-i18next dep)
  locales/                # it.json (source-of-truth) + en.json + de.json (R-FRONTEND-i18n-001)
  types/index.ts          # shared TS types (OEEResult, Alert, Device, …)
```

## Dev workflow

```bash
npm install
npm run dev              # vite — binds to 127.0.0.1:5173 (R-FRONTEND-DEV-BIND-001)
npm run dev -- --host 0.0.0.0   # cross-machine override (CLI overrides config)
npm run lint             # ESLint with no-explicit-any: error + no-console: error + no-warning-comments
npm run typecheck        # tsc --noEmit
npm run build            # tsc -b + vite build → dist/ (no .map files in production)
npm run preview          # serve the production build locally
```

The full stack starts via `docker compose up -d` from the repo root.

## Vite config

`vite.config.ts` uses the function form `defineConfig(({ mode }) => ({ ... }))` because Vite v7's config-loading pipeline applies `NODE_ENV` AFTER config evaluation — the verbatim `process.env.NODE_ENV !== 'production'` form would emit sourcemaps in production despite `vite build` setting NODE_ENV=production. The function form's `mode` parameter is the reliable equivalent.

`tsconfig.node.json` redirects `tsc -b` emit to `node_modules/.cache/tsc-node` (R-FRONTEND-SOURCEMAP-001 side-fix). The previously-tracked `vite.config.{js,d.ts}` shadow files were `git rm`-ed in PR #1 because Vite was loading the stale `.js` instead of the `.ts` source.

## i18n

`it.json` is the source-of-truth (Italian). `en.json` and `de.json` mirror the same key structure. Every key referenced via `t('foo.bar')` in `src/**/*.{ts,tsx}` MUST resolve in all three locales — enforced by `backend/tests/i18n-key-audit.test.js` (the H-20 substitute for the named `tests/i18n-key-audit.sh`).

To add a new translation key:

1. Add to `src/locales/it.json` (Italian).
2. Add equivalent to `en.json` and `de.json`.
3. The CI audit runs on every push.

The `useT()` hook (lightweight, no react-i18next dep) syncs `document.documentElement.lang` to the active locale on every change (R-i18n-HTML-LANG-001).

## ErrorBoundary

`src/components/ErrorBoundary.tsx` gates raw `error.message` behind `import.meta.env.PROD` (R-FRONTEND-ERROR-001). Production users see a generic Italian message; the full Error + ErrorInfo goes to `__FM_ERROR_SINK` (deferred to the observability stream's frontend logger when it ships).

## Doctrine references

- **R-3** — lint failures are fixed at root cause, not silenced. ESLint runs in CI (`Frontend · ESLint + typecheck`); `no-explicit-any: error` and `no-console: error` are intentional.
- **R-14** — review by non-implementer. New components / pages should be reviewed by a different engineer than the author before merge.

See [`docs/HANDOFF.md`](../docs/HANDOFF.md) § 4 for the cross-stack module map and [`docs/REMEDIATION.md`](../docs/REMEDIATION.md) for active frontend tickets.
