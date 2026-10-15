# Cloudflare D1 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Make imported promotions persist in Cloudflare D1 and load them into the React dashboard.

**Architecture:** Add D1 binding and a Worker API alongside existing static assets. Use a single atomic batch for replace-all import; only return persisted data to the UI.

**Tech Stack:** React 19, TypeScript, Vite 8, Cloudflare Workers/Wrangler 4, D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-cloudflare-d1-design.md`

## Global Constraints
- Keep existing Worker `acompanhamento-de-oferta`; do not auto-deploy the main environment.
- D1 binding is `DB` and secret is `IMPORT_TOKEN`, never shipped to browser.
- Public GET; authenticated POST; no user-facing fake data.
- Maximum 1,000 rows in a replace-all import.
- Preserve dashboard, promotions, stores, validity, and theme screens.

## Review Focus
- Same product in several stores must save without duplicate primary keys.
- Missing or incorrect secret must never write to D1.
- Invalid status or giant upload must not delete the previous dataset.
- DB/network outage must be shown, not silently replaced with mock data.
- Empty database must display empty-state rather than old sample records.

---

### Task 1: D1 schema and binding
**Files:** `migrations/0001_init.sql`, `wrangler.toml`, `docs/SETUP_D1.md`
**Interfaces:** D1 SQL tables; binding `DB`; secret `IMPORT_TOKEN`.
- [ ] Step 1: Use remote schema query and ensure four tables exist.
- [ ] Step 2: Add SQL migration and Wrangler Worker + assets + D1 binding.
- [ ] Step 3: Verify remote `sqlite_master` and Wrangler configuration.
- [ ] Step 4: Commit.

### Task 2: Worker API
**Files:** `worker/index.test.ts`, `worker/index.ts`
**Interfaces:** GET `/api/promocoes` produces `{promotions: Promotion[]}`; POST `/api/promocoes/import` accepts `{promotions: Promotion[]}` and returns `{count: number}`.
- [ ] Step 1: Write tests for API routing, token, payload, deduplication and atomic call.
- [ ] Step 2: Run tests: expect module-not-found failure.
- [ ] Step 3: Implement Worker and error mapping.
- [ ] Step 4: Run Vitest: expect passing.
- [ ] Step 5: Commit.

### Task 3: React API and import flow
**Files:** `src/promotions-api.test.ts`, `src/promotions-api.ts`, `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`
**Interfaces:** `loadPromotions():Promise<Promotion[]>`; `savePromotions(rows,token):Promise<number>`.
- [ ] Step 1: Write tests for HTTP handling, payload and auth header.
- [ ] Step 2: Run tests: expect module-not-found failure.
- [ ] Step 3: Implement API, fetch on mount, guarded import, no sample rows.
- [ ] Step 4: Update UI tests to model D1-sourced promotions; run Vitest.
- [ ] Step 5: Commit.

### Task 4: Verification and handoff
**Files:** `docs/SETUP_D1.md`, `.github/workflows/ci.yml`
- [ ] Step 1: Run `npm test` and `npm run build` in GitHub Actions.
- [ ] Step 2: Check D1 remote table query and deployed Worker binding status.
- [ ] Step 3: Open PR, review diffs and document token and deployment commands.
- [ ] Step 4: Keep production deployment for authorized next stage.
