# 🔬 Smart Lab — Computer Lab Management System

> **نظام إدارة وصيانة مختبرات الحاسب الذكي**  
> A smart, proactive lab management system that reduces device downtime and accelerates maintenance using data analysis, AI diagnostics, and intelligent alerts.

**Team:** Marwan Aly | Mohamed Othman | Manar Elabsi | Aya Abdallah  
**Course:** CISC 818 – Software Engineering with AI

---

## 📋 Table of Contents

- [Overview](#overview)
- [Team](#team)
- [AI-Augmented Development](#ai-augmented-development)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [User Roles](#user-roles)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Credentials](#demo-credentials)
- [Pages & UI](#pages--ui)

---

## Overview

Smart Lab is a full-stack web application for managing computer laboratories. It enables administrators, technicians, and regular users to track device health, report issues, and receive AI-powered maintenance suggestions — all through a bilingual Arabic/English interface with RTL support.

Built in 10 days using AI-augmented development methodology with the Superpowers plugin and MCP servers.

---

## Team

| Member | Role | Focus Area |
|--------|------|------------|
| **Marwan Aly** | Team Lead & Backend Lead | Architecture, database, project management |
| **Mohamed Othman** | Frontend Lead | Bilingual i18n, responsive UI, RTL support |
| **Manar Elabsi** | AI/ML Engineer | Ollama integration, ML predictive maintenance |
| **Aya Abdallah** | QA Engineer | Testing, Docker deployment, DevOps |

---

## AI-Augmented Development

This project was built using a systematic AI-augmented methodology:

### Superpowers Plugin
AI skill system with structured workflows for each SDLC phase:
- **Planning:** `brainstorming`, `writing-plans`
- **Implementation:** `subagent-driven-development`, `coding-standards`, `frontend-patterns`
- **Testing:** `tdd-workflow`, `verification-loop`
- **Quality:** `systematic-debugging`, `verification-before-completion`

### MCP Servers (Model Context Protocol)
- **Jira MCP:** Automated creation of 96 issues (7 Epics, 34 Stories, 44 Tasks, 11 Bugs)
- **GitHub MCP:** Repository management and version control
- **Context7 MCP:** Real-time documentation queries for 8+ libraries

### Key Metrics
- **10 days** — Total development time
- **33 commits** — Structured repository history
- **96 Jira issues** — Complete project tracking
- **15 Superpowers skills** — Across all SDLC phases
- **7 test suites** — All passing
- **87% ML accuracy** — On synthetic test data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | HTML + CSS + JavaScript (Vanilla) |
| Database | SQLite (better-sqlite3) |
| AI Diagnostics | Ollama (local LLM) + OpenRouter API |
| ML/Analytics | Python + scikit-learn (RandomForestRegressor) |
| QR Code | qrcode (npm) |
| Charts | Chart.js |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| File Uploads | Multer |
| Notifications | In-app only |
| i18n | Custom lightweight engine (Arabic/English) |
| Testing | Jest + Supertest |
| Deployment | Docker + Docker Compose |

---

## Features

- 📊 **Dashboard** — Real-time stats: total devices, working, broken, under maintenance; Pie chart + latest issues table
- 💻 **Device Management** — Full CRUD for devices with specs, location (X/Y on interactive map), and status badges
- 🌍 **Bilingual Interface** — Full Arabic/English support with custom i18n engine, RTL layouts, and language persistence
- 🚨 **Issue Reporting** — Submit fault reports with optional image upload; AI suggests fixes in real-time (debounced)
- 🤖 **AI Diagnostics** — Local Ollama LLM integration for privacy-preserving fault diagnosis based on description and device specs
- 🔮 **ML Predictive Maintenance** — scikit-learn RandomForestRegressor predicts device failure risk using age, fault frequency, and maintenance gaps
- 🗺 **Interactive Lab Map** — SVG layout of the lab; each device node is color-coded by status; click to navigate to device details
- 🔔 **Smart Alerts** — Daily cron job generates proactive alerts:
  - Device age > 5 years → `medium` severity
  - 3+ faults in a month → `high` severity
  - Maintenance gap > 6 months → `low` severity
- 📈 **Reports & Analytics** — Date-range filtered bar charts, average repair time, most-faulted device, total maintenance count, ML insights
- 📱 **QR Codes** — Each device gets a unique QR code; scanning opens device details without full login
- 👥 **Admin Panel** — Manage users (add, edit, delete), view roles
- 🔐 **Role-Based Access Control** — Three roles with granular permissions
- 🧪 **Comprehensive Testing** — 7 test suites covering auth, devices, issues, alerts, AI, reports, and integration

---

## Project Structure

```
smartlab/
├── PLAN.md                    ← Project plan (Arabic)
├── README.md                  ← This file
├── package.json
├── server.js                  ← Express entry point + route mounting
├── .env.example               ← Environment variable template
├── docker-compose.yml         ← Docker orchestration
├── Dockerfile                 ← Multi-stage Node.js + Python build
├── db/
│   ├── database.js            ← SQLite init + table creation
│   └── seed.js                ← Sample data (20 devices, 10 issues, 5 alerts)
├── middleware/
│   └── auth.js                ← JWT verification + role guard
├── routes/
│   ├── auth.js                ← POST /api/auth/login, GET /api/auth/me
│   ├── devices.js             ← CRUD + QR PNG generation
│   ├── issues.js              ← CRUD + status update
│   ├── alerts.js              ← GET + mark-read endpoints
│   ├── reports.js             ← GET /summary?from=&to=
│   ├── ai.js                  ← POST /api/ai/diagnose (Ollama + OpenRouter)
│   ├── ml.js                  ← POST /api/ml/predict (Predictive maintenance)
│   ├── users.js               ← User management (admin only)
│   └── qr.js                  ← GET /qr/:token → redirect to device page
├── services/
│   ├── deepseek.js            ← OpenRouter API wrapper
│   ├── ollama.js              ← Local Ollama LLM integration
│   ├── ml_bridge.js           ← Python bridge for scikit-learn
│   ├── ml_predictor.py        ← RandomForestRegressor training + prediction
│   └── predictive.js          ← Daily cron job for proactive alerts
├── ml/
│   └── model.joblib           ← Trained ML model (auto-generated)
├── tests/                     ← 7 test suites (Jest + Supertest)
│   ├── auth.test.js
│   ├── devices.test.js
│   ├── issues.test.js
│   ├── alerts.test.js
│   ├── ai.test.js
│   ├── reports.test.js
│   └── integration.test.js
├── uploads/                   ← Issue images (Multer)
└── public/
    ├── css/style.css          ← RTL + Cairo font + CSS variables
    ├── js/
    │   ├── api.js             ← Fetch wrapper (auto-attaches JWT)
    │   ├── auth.js            ← Login / logout
    │   ├── i18n.js            ← Custom i18n engine (AR/EN)
    │   ├── dashboard.js
    │   ├── devices.js
    │   ├── device.js
    │   ├── issues.js
    │   ├── maintenance.js
    │   ├── map.js
    │   ├── alerts.js
    │   ├── reports.js
    │   └── admin.js
    ├── index.html             ← Login screen
    ├── dashboard.html
    ├── devices.html
    ├── device.html            ← Also accessible via QR scan
    ├── issues.html
    ├── maintenance.html
    ├── map.html
    ├── alerts.html
    ├── reports.html
    └── admin.html
```

---

## Database Schema

### `users`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | User ID |
| name | TEXT | Full name |
| email | TEXT UNIQUE | Email address |
| password_hash | TEXT | Bcrypt hash |
| role | TEXT | `admin` / `technician` / `user` |
| created_at | DATETIME | Creation timestamp |

### `devices`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Device ID |
| name | TEXT | Device label (e.g. PC-01) |
| type | TEXT | Device type |
| processor | TEXT | CPU |
| ram | TEXT | RAM |
| os | TEXT | Operating system |
| location_x / location_y | INTEGER | Map coordinates |
| age_years | REAL | Age in years |
| status | TEXT | `working` / `broken` / `maintenance` |
| purchase_date | DATE | Purchase date |
| last_maintenance | DATE | Last maintenance date |
| qr_token | TEXT UNIQUE | QR code token |
| notes | TEXT | Notes |

### `issues`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Issue ID |
| device_id | INTEGER FK | Target device |
| reported_by_id | INTEGER FK | Reporting user |
| issue_type | TEXT | Fault category |
| description | TEXT | Fault description |
| image_path | TEXT | Optional image |
| status | TEXT | `open` / `in_progress` / `resolved` |
| ai_suggestions | TEXT | AI-generated diagnosis |
| priority | TEXT | `low` / `medium` / `high` |
| created_at / resolved_at | DATETIME | Timestamps |
| resolved_by_id | INTEGER FK | Resolving technician |
| resolution_notes | TEXT | Fix notes |

### `alerts`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Alert ID |
| device_id | INTEGER FK | Related device |
| type | TEXT | `age` / `frequency` / `maintenance_gap` |
| message | TEXT | Alert message |
| severity | TEXT | `low` / `medium` / `high` |
| is_read | INTEGER | `0` = unread, `1` = read |

### `maintenance_logs`
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Log ID |
| device_id | INTEGER FK | Device |
| issue_id | INTEGER FK | Related issue |
| technician_id | INTEGER FK | Technician |
| action | TEXT | Action taken |
| duration_hours | REAL | Repair duration |
| cost | REAL | Cost |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/login` | Login | Public |
| GET | `/api/auth/me` | Current user info | Authenticated |

### Devices
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/devices` | List all devices | Authenticated |
| GET | `/api/devices/:id` | Device details | Authenticated |
| POST | `/api/devices` | Add device | Admin |
| PUT | `/api/devices/:id` | Update device | Admin |
| DELETE | `/api/devices/:id` | Delete device | Admin |
| GET | `/api/devices/:id/qr` | Download QR PNG | Authenticated |
| GET | `/qr/:token` | QR scan redirect | Public |

### Issues
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/issues` | List issues | Authenticated |
| POST | `/api/issues` | Submit issue report | Authenticated |
| PUT | `/api/issues/:id` | Update issue | Admin / Technician |
| PATCH | `/api/issues/:id/status` | Update status | Admin / Technician |

### Alerts
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/alerts` | List alerts | Admin / Technician |
| PATCH | `/api/alerts/:id/read` | Mark as read | Admin / Technician |
| PATCH | `/api/alerts/read-all` | Mark all as read | Admin / Technician |

### Reports
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/reports/summary` | General statistics | Admin / Technician |
| GET | `/api/reports/maintenance` | Maintenance log | Admin / Technician |

### AI
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/ai/diagnose` | Ollama/OpenRouter fault diagnosis | Admin / Technician |
| POST | `/api/ai/chat` | Interactive AI chat with device context | Admin / Technician |

### ML (Predictive Maintenance)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/ml/predict` | Predict failure risk for a device | Admin / Technician |
| GET | `/api/ml/insights` | ML feature importance and model stats | Admin / Technician |
| POST | `/api/ml/train` | Retrain model with current data | Admin |

### Users (Admin)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/users` | List users | Admin |
| POST | `/api/users` | Create user | Admin |
| PUT | `/api/users/:id` | Update user | Admin |
| DELETE | `/api/users/:id` | Delete user | Admin |

---

## User Roles

| Feature | Admin | Technician | User |
|---|:---:|:---:|:---:|
| Device management | ✅ | ❌ | ❌ |
| User management | ✅ | ❌ | ❌ |
| Submit issue report | ✅ | ✅ | ✅ |
| Update issue status | ✅ | ✅ | ❌ |
| AI diagnostic assistant | ✅ | ✅ | ❌ |
| Interactive map | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ❌ |
| Smart alerts | ✅ | ✅ | ❌ |
| QR Code | ✅ | ✅ | Read only |

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/marwanahmedaly/software_smartlab_project.git
cd software_smartlab_project

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and add your JWT_SECRET and DEEPSEEK_API_KEY

# Seed the database with sample data
npm run seed

# Start the server
npm start
```

The server starts at **http://localhost:3000**

---

## 🐳 Docker Deployment

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Quick Start

```bash
# 1. Clone and enter the project
git clone https://github.com/marwanahmedaly/software_smartlab_project.git
cd software_smartlab_project

# 2. Create environment file
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# 3. Build and start
docker-compose up --build -d

# 4. View logs
docker-compose logs -f smartlab
```

The application will be available at **http://localhost:3000**

### Docker Commands

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes database)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build -d

# Shell into container
docker exec -it smartlab-app bash

# View logs
docker-compose logs -f
```

### Docker Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | — | ✅ | Your OpenRouter API key |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.2-3b-instruct:free` | ❌ | Model to use |
| `JWT_SECRET` | `smartlab_super_secret_key_change_in_production` | ❌ | JWT signing secret |
| `PORT` | `3000` | ❌ | Server port |

### Volume Mounts

| Host Path | Container Path | Purpose |
|---|---|---|
| `./data` | `/app/data` | SQLite database persistence |
| `./uploads` | `/app/uploads` | Uploaded issue images |

---

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
JWT_SECRET=your_jwt_secret_here

# AI Diagnostics (Ollama - Local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# AI Diagnostics (OpenRouter - Cloud Fallback)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions
```

> ⚠️ **Security:** Never commit your `.env` file. Add it to `.gitignore`.

---

## Demo Credentials

After running `npm run seed`:

| User | Email | Password | Role |
|---|---|---|---|
| System Admin | admin@lab.com | Admin@123 | admin |
| Maintenance Tech | tech@lab.com | Tech@123 | technician |
| Regular User | user@lab.com | User@123 | user |

**Seeded sample data:**
- 20 devices: PC-01 → PC-20 (12 working ✅, 5 broken ❌, 3 under maintenance 🛠)
- 10 issues with varied statuses
- 5 alerts with varied severities

---

## Pages & UI

| Page | File | Description |
|---|---|---|
| Login | `index.html` | Auth screen with lab background + blue overlay |
| Dashboard | `dashboard.html` | Stats cards, pie chart, recent issues, alert count |
| Devices | `devices.html` | Device table with add/edit modal, pagination |
| Device Detail | `device.html` | Specs, status, fault history, QR code download |
| Issues | `issues.html` | Report form with AI suggestion, filtered table |
| Maintenance Log | `maintenance.html` | Filterable maintenance history |
| Lab Map | `map.html` | SVG lab layout, color-coded device nodes |
| Smart Alerts | `alerts.html` | Severity-filtered alert list, mark as read |
| Reports | `reports.html` | Date-range charts, KPI cards, print/export |
| Admin Panel | `admin.html` | User management (admin only) |

### UI Design Tokens

| Token | Value | Usage |
|---|---|---|
| Primary | `#3B82F6` | Buttons, sidebar |
| Success | `#22C55E` | "Working" status |
| Danger | `#EF4444` | "Broken" status |
| Warning | `#F97316` | "Maintenance" status |
| Background | `#F1F5F9` | Page backgrounds |
| Sidebar | `#1E293B` | Sidebar background |
| Font | Cairo (Google Fonts) | RTL Arabic UI |
| Direction | RTL / LTR | Auto-switches with language |

### Bilingual Support

The system includes a custom 200-line i18n engine:
- **Language Toggle:** Switches between Arabic and English instantly
- **RTL Support:** CSS direction flipping with `[dir="rtl"]` selectors
- **Persistence:** Language preference saved in localStorage
- **Coverage:** All 12 pages fully translated
- **No Dependencies:** Built with vanilla JavaScript (no react-i18next)

---

## 🤖 AI & ML Features

### AI Diagnostics (Ollama)
- **Local LLM:** Runs on Ollama — institutional data never leaves the network
- **Context-Aware:** Pre-loaded with device specs and fault history
- **Interactive Chat:** Technicians can ask follow-up questions
- **Privacy:** No API costs, no data leakage, 10-second response time

### ML Predictive Maintenance
- **Algorithm:** RandomForestRegressor (scikit-learn)
- **Features:** Device age, failure frequency, maintenance gaps
- **Output:** Failure risk score + feature importance
- **Model Persistence:** joblib for fast loading
- **Accuracy:** 87% on synthetic test data

---

## 🧪 Testing

7 comprehensive test suites:
- **Auth:** JWT verification, role guards, token expiration
- **Devices:** CRUD operations, QR generation, validation
- **Issues:** Reporting, status updates, image uploads
- **Alerts:** Smart alert generation, marking as read
- **AI:** Ollama/OpenRouter integration, response formatting
- **Reports:** Date filtering, chart data, KPI calculations
- **Integration:** End-to-end workflows across modules

Run tests:
```bash
npm test
```

---

## License

This project is for educational/demonstration purposes.
