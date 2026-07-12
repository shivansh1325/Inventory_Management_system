# Assembly Line Inventory Manager

Enterprise-grade inventory management for assembly-line / manufacturing production. Full-stack **Next.js 14 (App Router) + TypeScript + Prisma + SQLite**, Tailwind design system with dark mode, RBAC with four roles, multi-warehouse stock, purchasing with approvals, and a manufacturing analytics layer — all built on an immutable stock-movement ledger.

The three core ideas:

1. **Components** (raw materials) are stocked per warehouse, with quantities you can view and update.
2. **Products** each have a **Bill of Materials (BOM)** — the exact components and quantity needed to build one unit.
3. **Producing** N units automatically deducts `qtyPerUnit × N` of every BOM component from stock — all-or-nothing — and adds N to the product's finished stock.

## Setup

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db and runs the seed
npm run seed             # (re)load demo data — safe to re-run anytime
npm run dev              # http://localhost:3000
```

`.env` needs `DATABASE_URL` and `AUTH_SECRET` (see `.env.example`; dev defaults ship in `.env`).

### Demo logins (all password `demo1234`)

| Email | Role |
|---|---|
| `admin@demo.local` | Admin |
| `manager@demo.local` | Production Manager |
| `store@demo.local` | Store Keeper |
| `operator@demo.local` | Operator |

## The auto-deduction rule (unchanged, non-negotiable)

When a production run for product **P**, quantity **Q**, from warehouse **W** is confirmed:

1. P's BOM is loaded and every line checked against W's stock: `required = qtyPerUnit × Q`.
2. If **any** component is short, the run is **blocked**, the shortfall list is shown, a stockout incident is logged and purchasing users are notified. **Nothing is deducted.** (The negative-stock flag lives in Settings, OFF by default.)
3. Otherwise, inside a **single database transaction**: every component is deducted from its `StockLevel` and cached total (re-guarded at write time so concurrent runs cannot double-spend), a `PRODUCTION_CONSUMPTION` movement is written per component, a `ProductionRunLine` snapshot freezes the BOM as used, finished stock rises by Q with a `PRODUCTION_OUTPUT` movement, and the run becomes `COMPLETED`.
4. Any error rolls the whole transaction back — **a run either deducts everything or nothing.**

Reversing a completed run restores every consumed quantity from the run's snapshot (never the live BOM), removes Q from finished stock, writes `RUN_REVERSAL` movements, and marks the run `CANCELLED`.

Every stock change — receipt, adjustment, production, reversal, transfer, goods receipt — writes an immutable `StockMovement`; totals and per-warehouse levels are running results that always reconcile with the ledger (the seed and tests assert this).

## Tests

```bash
npm run seed        # includes the worked example: Control Panel ×10 → 80/10/10/25, asserted
npm run test:rbac   # permission matrix: 68 role×action pairs + approval value limits
npm run test:logic  # shortfall block, reversal restore, concurrent-run race, ledger reconciliation
npm run test:flows  # approval limit escalation, partial/full goods receipt, over-receipt block, transfer pairing
npm run test:smoke  # (server must be running) every route × every role → 200 / redirect / 403 as expected
```

Re-run `npm run seed` after `test:logic` / `test:flows` — they consume stock.

## Modules

| Area | What's there |
|---|---|
| **Dashboard** | Date-range picker (Today/7d/30d/MTD/QTD) with vs-previous-period deltas. KPIs: production output, inventory value (components + finished split), low/out count, material consumption value, **buildable coverage**, inventory turnover (est.), pending requisitions, **stockout incidents**. Production trend (stacked by product), top consumed components, stock-health donut, critical-shortages table with one-click "raise requisition", activity feed. |
| **Analytics** | Production (output trend, run success vs blocked, material cost per unit), Inventory (value trend from the ledger, **ABC/Pareto**, days-of-stock, slow-moving stock, adjustment rate), Consumption & Cost (by category, **what-if material runway**), Purchasing (spend by supplier, cycle time, fill rate). |
| **Components** | DataTable (sort, search, column show/hide, density, CSV export), detail drawer with stock sparkline + per-warehouse levels + recent movements, receive/adjust dialogs (adjust needs a reason and the right role), **archive instead of delete**. |
| **Products & BOM** | BOM editor with per-unit material cost; buildable-now everywhere; read-only for roles without `products.write`. |
| **Production** | 3-step wizard (product cards with buildable badge → quantity + live feasibility with "set to max" and **"raise requisition for shortfall"** → review with cost + snapshot preview). Run detail page with before/after stock and a **printable production slip**. Reverse with typed confirmation. |
| **Purchasing** | Suppliers master; requisitions `DRAFT → PENDING_APPROVAL → APPROVED/REJECTED → ORDERED → RECEIVED → CLOSED`; manager approvals capped by an Admin-configurable value limit (above it: Admin only); goods receipt with partial receipts writing `RECEIPT` movements. |
| **Warehouses & Transfers** | Per-warehouse `StockLevel`s; transfers as paired `TRANSFER_OUT`/`TRANSFER_IN` movements, transactional. Single-warehouse installs never see warehouse pickers. |
| **Movements** | Server-paginated immutable ledger with type/item/warehouse/date filters + CSV export. |
| **Administration** | Users & roles (invite, edit role, deactivate — never delete, force password reset), Settings (company name, currency, approval limit, negative-stock flag), **Audit log** of every mutation with actor and detail. |
| **Shell** | Collapsible grouped sidebar (role-scoped), ⌘K/Ctrl-K command palette (components/products/runs), notification bell (low stock, blocked runs, approvals), dark mode toggle, breadcrumbs, shortcuts (`n` new run, `/` search). |

## Roles & permissions

Permissions are **data**, not scattered checks: [src/lib/permissions.ts](src/lib/permissions.ts) maps `role → allowed actions`; every server action calls `requirePermission()` (server-side, DB-verified — UI hiding is cosmetic only), pages gate via `requirePagePermission()`, and middleware bounces unauthenticated requests to `/login`.

| Capability | Admin | Manager | Store | Operator |
|---|---|---|---|---|
| Users, settings, audit log | ✔ | ✖ | ✖ | ✖ |
| Components create/edit | ✔ | ✔ | ✔ | ✖ |
| Component archive | ✔ | ✔ | ✖ | ✖ |
| Stock receive | ✔ | ✔ | ✔ | ✖ |
| Stock adjustment | ✔ | ✔ | ✖ | ✖ |
| Products & BOM | ✔ | ✔ | ✖ | ✖ |
| Run create | ✔ | ✔ | ✖ | ✔ |
| Run reverse | ✔ | ✔ | ✖ | ✖ |
| Requisition raise / receive / transfer | ✔ | ✔ | ✔ | ✖ |
| Requisition approve | ✔ | ✔ (≤ value limit) | ✖ | ✖ |
| Analytics & exports | ✔ | ✔ | ✔ | ✖ |

Deactivated users are rejected on their next request (DB-verified), not just at token expiry.

## Exact decimal arithmetic (design note)

Prisma's SQLite connector has no `Decimal` type. Quantities/costs are stored as **integers in milli-units** (×1000, 3 dp): `2.5 m` → `2500`. All parsing/arithmetic is integer-only via [src/lib/qty.ts](src/lib/qty.ts) — no float drift possible.

**PostgreSQL later:** set `provider = "postgresql"` + `DATABASE_URL`, run `npx prisma migrate dev`; optionally migrate the integer columns to native `Decimal`. For existing pre-warehouse databases, `npx tsx scripts/backfill-warehouse.ts` creates the Main Warehouse and backfills levels/movements (idempotent).

## Project layout

```
prisma/schema.prisma           data model (+ milli-unit note)
prisma/seed.ts                 demo data through the real services; asserts the worked example
scripts/                       logic-test, flow-test, rbac-test, smoke-test, backfill-warehouse
src/lib/qty.ts                 exact integer quantity math
src/lib/permissions.ts         RBAC as data (role → actions)
src/lib/auth.ts                JWT sessions, requirePermission guard
src/lib/services/              stock-core (guarded delta), stock, production, transfer, purchasing
src/lib/*-actions.ts           zod-validated server actions (single mutation choke point)
src/lib/analytics.ts           dashboard + analytics aggregations from the ledger
src/components/ui/             design system (DataTable, StatCard, Drawer, Toast, ConfirmDialog…)
src/app/(app)/                 authed pages; src/app/login; src/middleware.ts route protection
```

Analytics are computed on demand from the ledger — plenty fast at this scale; the swap point for a `DailyStockSnapshot` cache table is documented in `src/lib/analytics.ts`.

## Deliberately deferred

Batch/lot FIFO tracking (C3), email digests (in-app notifications ship; SMTP hook is the notify helpers), CSV *import* with preview, and bulk row actions are not in this phase — the schema and action layer are structured so each slots in without touching the deduction engine.
