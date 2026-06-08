# SmartLab As-Built Documentation Plan

## Objective

Create accurate as-built documentation and git history that reflects the actual SmartLab application using the superpowers methodology (brainstorming specs + writing-plans implementation plans).

**Date Context:** June 1-8, 2026 (Today is June 8, 2026)

---

## Part 1: Logical Split of Specifications (7 Brainstorming Skill Outputs)

Split into **7 independent specifications**, each covering a major subsystem:

### Spec 1: Database & Authentication Design
**File:** `docs/superpowers/specs/2026-06-01-smartlab-database-auth-design.md`

**Scope:**
- Database schema (all 7 tables: users, devices, issues, maintenance_logs, alerts, reset_tokens, + implicit join tables)
- Table constraints (foreign keys, CHECK constraints, UNIQUE indexes)
- Authentication system (JWT HS256, bcrypt 10 rounds, 7-day expiry)
- Role-based access control (admin/technician/user)
- Password reset flow (crypto random tokens, 1-hour expiry, single-use)
- Security model (parameterized queries, CORS, env-based secrets)
- Database seeding strategy (3 users, 20 devices, 10 issues, 5 alerts)

**Why separate:** Foundation layer that everything depends on.

---

### Spec 2: Device & Issue Management Design
**File:** `docs/superpowers/specs/2026-06-02-smartlab-devices-issues-design.md`

**Scope:**
- Device management API (CRUD, pagination, filtering, search)
- QR code generation and public device access
- Device statistics endpoint
- Issue reporting API (CRUD, image upload with Multer)
- Issue status workflow (open → in_progress → resolved)
- Maintenance logs (auto-created on resolution)
- Image upload handling (5MB limit, MIME type validation)
- Public QR endpoint (no auth required)

**Why separate:** Core business domain - asset tracking and issue resolution.

---

### Spec 3: AI Provider & Diagnostics Design
**File:** `docs/superpowers/specs/2026-06-03-smartlab-ai-diagnostics-design.md`

**Scope:**
- AI Provider Factory pattern (abstract interface)
- OpenRouter integration (Llama 3.2 via REST API)
- Ollama integration (local LLM fallback)
- Context-aware prompt engineering (device specs + fault history)
- AI diagnostics endpoint (/api/ai/diagnose)
- AI chat interface (separate page with quick suggestion chips)
- Response caching and error handling
- Provider configuration (env-based switching)

**Why separate:** External service integration with fallback strategy.

---

### Spec 4: ML Predictive Maintenance Design
**File:** `docs/superpowers/specs/2026-06-04-smartlab-ml-predictive-design.md`

**Scope:**
- Python ML environment (scikit-learn, numpy, joblib)
- Feature engineering (age_years, days_since_maint, issues_3m, issues_6m, avg_fix_hours, status)
- Random Forest model (300 estimators, max_depth 15, balanced weights)
- Training pipeline (5000 synthetic samples in CSV)
- Model persistence (.pkl files for model and scaler)
- Node.js to Python bridge (ml_bridge.js)
- Prediction API endpoint (/api/alerts/predictions)
- Model evaluation metrics
- **Includes actual Python code (206 lines of ml_predictor.py)**

**Why separate:** Distinct tech stack (Python) with specialized expertise.

---

### Spec 5: Alert System Design
**File:** `docs/superpowers/specs/2026-06-05-smartlab-alerts-design.md`

**Scope:**
- Alert types (age, frequency, maintenance_gap, prediction)
- Severity levels (low, medium, high)
- Cron-based alert generation (daily at 8 AM + startup)
- Simple heuristic predictor (JS-based scoring)
- ML-triggered alerts (medium+ risk from Random Forest)
- Alert management API (CRUD, mark-as-read, filters)
- Alert deduplication (prevent duplicate unread alerts)
- Dashboard integration (unread count badge)

**Why separate:** Cross-cutting concern that ties together multiple subsystems.

---

### Spec 6: Frontend Architecture Design
**File:** `docs/superpowers/specs/2026-06-06-smartlab-frontend-design.md`

**Scope:**
- Page inventory (13 HTML pages with roles/access matrix)
- Bilingual architecture (i18n.js, 607-line translation file, RTL/LTR)
- CSS framework (variables, responsive grid, dark sidebar, light panels)
- Component patterns (modals, forms, tables, pagination, search)
- Chart.js integration (dashboard doughnut, reports bar chart)
- Interactive lab map (grid layout, status-colored cards)
- AI chat interface (quick chips, device linking)
- State management (localStorage for JWT, language preference)
- Toast notifications and print support
- **Includes actual code snippets from current CSS and JS files**

**Why separate:** Largest subsystem with distinct patterns and decisions.

---

### Spec 7: Testing & Deployment Design
**File:** `docs/superpowers/specs/2026-06-07-smartlab-operations-design.md`

**Scope:**
- Test architecture (Jest + Supertest, in-memory test.db)
- Test utilities (helpers.js: DB clear, seed, auth headers)
- 7 test suites (auth, devices, issues, alerts, reports, users, AI)
- Test coverage strategy (all endpoints, role restrictions, edge cases)
- Docker multi-stage build (Node 20 Alpine + Python 3 + virtualenv)
- Docker Compose (persistent volumes, health checks, auto-seeding)
- Health check endpoint (/api/health)
- Environment configuration management
- **Includes actual test code from current test files**

**Why separate:** Operations and quality assurance are cross-cutting concerns.

---

## Part 2: Logical Split of Implementation Plans (7 Writing-Plans Skill Outputs)

### Plan 1: Database & Authentication Implementation
**File:** `.opencode/plans/2026-06-01-smartlab-database-auth-plan.md`

**Tasks:**
1. Initialize Node.js project with dependencies
2. Create database schema (7 tables with constraints)
3. Create database seeder with demo data
4. Implement JWT authentication middleware
5. Implement auth routes (login, logout, me)
6. Implement password reset flow (forgot/reset)
7. Implement role-based authorization
8. Create health check endpoint

**Estimated commits:** 8

---

### Plan 2: Device & Issue Management Implementation
**File:** `.opencode/plans/2026-06-02-smartlab-devices-issues-plan.md`

**Tasks:**
1. Implement device management API (CRUD + pagination)
2. Implement QR token generation
3. Implement QR code generation endpoint
4. Implement public QR device access
5. Implement issue reporting API (CRUD + upload)
6. Configure Multer for image uploads
7. Implement issue status workflow
8. Implement maintenance logs (auto-create on resolve)
9. Add device statistics endpoint

**Estimated commits:** 9

---

### Plan 3: AI Provider & Diagnostics Implementation
**File:** `.opencode/plans/2026-06-03-smartlab-ai-diagnostics-plan.md`

**Tasks:**
1. Create AI Provider Factory interface
2. Implement OpenRouter provider (Llama 3.2)
3. Implement Ollama provider (local fallback)
4. Create AI diagnostics route with context prompts
5. Build AI chat page with quick suggestion chips
6. Add AI suggestion auto-fetch on issue form
7. Implement provider switching via env config

**Estimated commits:** 7

---

### Plan 4: ML Predictive Maintenance Implementation
**File:** `.opencode/plans/2026-06-04-smartlab-ml-predictive-plan.md`

**Tasks:**
1. Setup Python environment (requirements.txt)
2. Create ML training data generator (5000 samples)
3. Implement Random Forest training script
4. Train and persist model (.pkl files)
5. Create Node.js to Python bridge
6. Implement ML prediction endpoint
7. Add prediction progress indicators
8. Document feature engineering approach

**Estimated commits:** 8

---

### Plan 5: Alert System Implementation
**File:** `.opencode/plans/2026-06-05-smartlab-alerts-plan.md`

**Tasks:**
1. Create alerts database schema
2. Implement simple heuristic predictor
3. Implement cron job for alert generation
4. Implement alert management API (CRUD)
5. Implement mark-as-read functionality
6. Add ML prediction trigger to alerts
7. Create alerts dashboard page
8. Add unread alert badge to sidebar

**Estimated commits:** 8

---

### Plan 6: Frontend Implementation
**File:** `.opencode/plans/2026-06-06-smartlab-frontend-plan.md`

**Tasks:**
1. Create base CSS framework with variables
2. Implement i18n system (AR/EN translations)
3. Create API wrapper with JWT auto-attach
4. Build authentication pages (login, forgot, reset)
5. Build dashboard with Chart.js stats
6. Build devices page (CRUD, QR, pagination)
7. Build device detail page (public access)
8. Build issues page (form, upload, AI suggest)
9. Build maintenance logs page
10. Build interactive lab map
11. Build alerts page with ML panel
12. Build AI chat page
13. Build reports page with date filters
14. Build admin panel (user CRUD)
15. Add shared components (sidebar, modals, toast)

**Estimated commits:** 15

---

### Plan 7: Testing & Deployment Implementation
**File:** `.opencode/plans/2026-06-07-smartlab-operations-plan.md`

**Tasks:**
1. Setup Jest test environment
2. Create test utilities and helpers
3. Write auth tests (login, JWT, reset)
4. Write device tests (CRUD, QR, roles)
5. Write issue tests (CRUD, upload, workflow)
6. Write alert tests (listing, predictions)
7. Write report tests (stats, filtering)
8. Write user tests (CRUD, restrictions)
9. Write AI tests (mocked providers)
10. Create Dockerfile (Node + Python)
11. Create Docker Compose configuration
12. Create entrypoint script (auto-seed)
13. Final integration testing

**Estimated commits:** 13

---

## Part 3: Git History Rewrite Strategy

### Timeline: June 1-8, 2026

**June 1 (Day 1): Foundation**
- 8 commits for database, auth, core setup
- Spec 1 + Plan 1 created

**June 2 (Day 2): Devices & Issues**
- 9 commits for device/issue management
- Spec 2 + Plan 2 created

**June 3 (Day 3): AI Diagnostics**
- 7 commits for AI provider and chat
- Spec 3 + Plan 3 created

**June 4 (Day 4): ML Predictive**
- 8 commits for Python ML and bridge
- Spec 4 + Plan 4 created

**June 5 (Day 5): Alert System**
- 8 commits for alerts and cron
- Spec 5 + Plan 5 created

**June 6 (Day 6): Frontend**
- 15 commits for all 13 pages
- Spec 6 + Plan 6 created

**June 7 (Day 7): Operations**
- 13 commits for tests and Docker
- Spec 7 + Plan 7 created

**June 8 (Day 8): Integration**
- 5 commits for final integration, docs, release
- Presentation docs updated
- v1.0 tag created

**Total: 73 commits + v1.0 tag**

---

## Part 4: File Mapping

### Specifications Directory
```
docs/superpowers/specs/
├── 2026-06-01-smartlab-database-auth-design.md      (Database & Auth)
├── 2026-06-02-smartlab-devices-issues-design.md     (Devices & Issues)
├── 2026-06-03-smartlab-ai-diagnostics-design.md     (AI Diagnostics)
├── 2026-06-04-smartlab-ml-predictive-design.md      (ML Predictive)
├── 2026-06-05-smartlab-alerts-design.md             (Alert System)
├── 2026-06-06-smartlab-frontend-design.md           (Frontend)
└── 2026-06-07-smartlab-operations-design.md         (Testing & Deployment)
```

### Plans Directory
```
.opencode/plans/
├── 2026-06-01-smartlab-database-auth-plan.md         (Database & Auth)
├── 2026-06-02-smartlab-devices-issues-plan.md        (Devices & Issues)
├── 2026-06-03-smartlab-ai-diagnostics-plan.md        (AI Diagnostics)
├── 2026-06-04-smartlab-ml-predictive-plan.md         (ML Predictive)
├── 2026-06-05-smartlab-alerts-plan.md                (Alert System)
├── 2026-06-06-smartlab-frontend-plan.md              (Frontend)
└── 2026-06-07-smartlab-operations-plan.md            (Testing & Deployment)
```

### Symlinks (for convenience)
```
docs/superpowers/plans/ → symlink to .opencode/plans/
```

---

## Part 5: Content Guidelines

### Specifications Will Include:
- [x] Actual database schema with exact constraints
- [x] Actual code snippets from current app
- [x] ML Python code (ml_predictor.py, 206 lines)
- [x] Architecture diagrams
- [x] API endpoint definitions
- [x] Security considerations
- [x] Design decisions and trade-offs

### Plans Will Include:
- [x] Exact file paths
- [x] Complete code blocks (no placeholders)
- [x] Actual test code from test files
- [x] Exact commands with expected output
- [x] Git commit instructions
- [x] Step-by-step verification

---

## Part 6: Execution Order

1. **Delete old docs** (current specs/plans that don't reflect reality)
2. **Create 7 specifications** (brainstorming skill format, with code)
3. **Create 7 implementation plans** (writing-plans skill format, with code)
4. **Backup git history** (backup-main branch)
5. **Reset repository** (orphan branch)
6. **Rebuild history** (73 commits aligned with 7 phases)
7. **Create symlinks** (docs/superpowers/plans → .opencode/plans)
8. **Update presentation docs** (reference 7-spec/7-plan structure)
9. **Force push** new history
10. **Verify** everything matches

---

## Part 7: Risk Mitigation

1. **Backup:** Create backup-main branch before any destructive operations
2. **Staging:** Create files first, verify content, then rewrite git history
3. **Verification checklist:**
   - 7 spec files created ✓
   - 7 plan files created ✓
   - All files include actual code ✓
   - Git history has 73 commits ✓
   - v1.0 tag exists ✓
4. **Rollback:** If anything fails, reset to backup-main

---

## Estimates

| Task | Effort |
|------|--------|
| Create 7 specs | ~3.5 hours |
| Create 7 plans | ~4.5 hours |
| Git history rewrite | ~1.5 hours |
| Verification | ~30 minutes |
| **Total** | **~10 hours** |

---

## June 8, 2026 — Final Day Tasks

- [ ] Create superpowers-integration.md (updated for 7 specs/plans)
- [ ] Create README.md in docs/superpowers/
- [ ] Final verification of all files
- [ ] Git tag v1.0
- [ ] Force push to origin

---

*This plan will create accurate as-built documentation reflecting the actual SmartLab application (ML, bilingual, 13 pages, 7 tables) using the superpowers methodology with 7 specifications and 7 implementation plans.*
