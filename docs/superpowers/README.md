# SmartLab Superpowers Documentation

> **Project:** SmartLab — AI-Powered Computer Laboratory Management System  
> **Course:** CISC 818 – Software Engineering with AI  
> **Plugin:** superpowers (https://github.com/obra/superpowers)  
> **Dates:** June 1-8, 2026

---

## Overview

This directory contains the complete design specifications and implementation plans for SmartLab, created using the **superpowers plugin** for Claude Code. The documentation is split into **7 logical subsystems**, each with its own design specification (brainstorming skill output) and implementation plan (writing-plans skill output).

## What is Superpowers?

Superpowers is a Claude Code plugin that provides:
- **Structured skills** for development workflows (brainstorming, writing-plans, TDD, etc.)
- **Specialized agents** for different tasks (planner, architect, code-reviewer, security-reviewer)
- **Commands** for rapid execution (/plan, /security, /code-review)
- **Hooks** for automated quality checks

## Documentation Structure

### Design Specifications (Brainstorming Skill)

```
docs/superpowers/specs/
├── 2026-06-01-smartlab-database-auth-design.md      (Database & Auth)
├── 2026-06-02-smartlab-devices-issues-design.md     (Devices & Issues)
├── 2026-06-03-smartlab-ai-diagnostics-design.md     (AI Diagnostics)
├── 2026-06-04-smartlab-ml-predictive-design.md      (ML Predictive Maintenance)
├── 2026-06-05-smartlab-alerts-design.md             (Alert System)
├── 2026-06-06-smartlab-frontend-design.md           (Frontend Architecture)
└── 2026-06-07-smartlab-operations-design.md         (Testing & Deployment)
```

### Implementation Plans (Writing-Plans Skill)

```
.opencode/plans/
├── 2026-06-01-smartlab-database-auth-plan.md        (Database & Auth)
├── 2026-06-02-smartlab-devices-issues-plan.md       (Devices & Issues)
├── 2026-06-03-smartlab-ai-diagnostics-plan.md       (AI Diagnostics)
├── 2026-06-04-smartlab-ml-predictive-plan.md        (ML Predictive Maintenance)
├── 2026-06-05-smartlab-alerts-plan.md               (Alert System)
├── 2026-06-06-smartlab-frontend-plan.md             (Frontend)
└── 2026-06-07-smartlab-operations-plan.md           (Testing & Deployment)
```

**Symlink:** `docs/superpowers/plans → .opencode/plans`

---

## Subsystem Overview

### 1. Database & Authentication (June 1)
- **6 tables** with full constraints (users, devices, issues, maintenance_logs, alerts, reset_tokens)
- **JWT authentication** with bcrypt hashing and role-based access
- **Password reset** with crypto random tokens and 1-hour expiry
- **Security model** with parameterized queries and email enumeration prevention

### 2. Device & Issue Management (June 2)
- **Device CRUD** with pagination, filtering, and search
- **QR code generation** and public device access
- **Issue reporting** with image upload (Multer, 5MB limit)
- **Status workflow** (open → in_progress → resolved) with auto-maintenance logs

### 3. AI Provider & Diagnostics (June 3)
- **AI Provider Factory** pattern with configurable providers
- **OpenRouter integration** (Llama 3.2 via REST API)
- **Ollama fallback** for local LLM deployment
- **Context-aware prompts** with device specs and fault history

### 4. ML Predictive Maintenance (June 4)
- **Random Forest model** (300 estimators, scikit-learn)
- **5000 synthetic training samples** with feature engineering
- **Python bridge** for Node.js to Python communication
- **Prediction API** with severity scoring and Arabic probability labels

### 5. Alert System (June 5)
- **4 alert types**: age, frequency, maintenance_gap, prediction
- **Cron-based generation** (daily at 8 AM + startup)
- **ML-triggered alerts** for medium+ risk devices
- **Deduplication** logic to prevent duplicate alerts

### 6. Frontend Architecture (June 6)
- **13 HTML pages** with role-based access
- **Bilingual support** (Arabic/English with RTL/LTR switching)
- **607-line translation system** (i18n.js)
- **Chart.js** integration for dashboard and reports
- **Interactive lab map** with status-colored SVG grid

### 7. Testing & Deployment (June 7)
- **7 test suites** with Jest + Supertest (~1900 lines)
- **Docker multi-stage build** (Node + Python)
- **Auto-seeding** on first startup
- **Health check** endpoint

---

## Key Statistics

| Metric | Value |
|--------|-------|
| Design Specifications | 7 |
| Implementation Plans | 7 |
| Total Documentation | ~340 KB |
| Specs Total Lines | ~3,200 |
| Plans Total Lines | ~4,800 |
| Actual Code Snippets | 100+ |
| Test Code Included | 7 suites |
| ML Code Included | 206 lines (Python) |

---

## Git History

The git history was rewritten to align with the 7-phase implementation plan:
- **June 1**: Foundation (8 commits)
- **June 2**: Devices & Issues (9 commits)
- **June 3**: AI Diagnostics (7 commits)
- **June 4**: ML Predictive (8 commits)
- **June 5**: Alert System (8 commits)
- **June 6**: Frontend (15 commits)
- **June 7**: Operations (13 commits)
- **June 8**: Integration + v1.0 tag (5 commits)

**Total: 73 commits + v1.0 release tag**

---

## Verification

To verify these documents reflect the actual application:

```bash
# List all specifications
ls -la docs/superpowers/specs/

# List all implementation plans
ls -la .opencode/plans/

# Check file sizes
du -sh docs/superpowers/specs/*.md
du -sh .opencode/plans/*.md

# Count total lines
wc -l docs/superpowers/specs/*.md
wc -l .opencode/plans/*.md
```

---

## References

- **Superpowers Plugin:** https://github.com/obra/superpowers
- **SmartLab Repository:** https://github.com/m0hamedKhalidMG/smartlab
- **Course:** CISC 818 – Software Engineering with AI

---

*This documentation was generated using the superpowers plugin for Claude Code as part of the CISC 818 Assignment 3 presentation.*
