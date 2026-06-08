# Frontend Architecture Design Specification

**Title:** SmartLab Frontend Architecture Design  
**Date:** 2026-06-06  
**Project:** SmartLab — Computer Lab Management & Maintenance System  
**Spec:** spec-06

---

## 1. Overview

The SmartLab frontend is a multi-page HTML application (not a SPA) with a shared sidebar navigation, topbar, and bilingual Arabic/English support. It uses vanilla JavaScript with `localStorage` for lightweight state persistence, Chart.js for data visualization, and a custom CSS design system. All pages are served statically from the `public/` directory and communicate with the Express backend via REST APIs.

---

## 2. Page Inventory

| # | Page | File | Role Access | Description |
|---|------|------|-------------|-------------|
| 1 | Login | `index.html` | Public | JWT-based authentication |
| 2 | Dashboard | `dashboard.html` | Admin, Technician | Stats, charts, latest issues, unread alerts |
| 3 | Devices | `devices.html` | Admin, Technician | Device CRUD, search, filter, QR codes |
| 4 | Device Detail | `device.html` | Admin, Technician | Single device view, issue reporting |
| 5 | Issues | `issues.html` | Admin, Technician, User | Issue submission, status tracking |
| 6 | Maintenance | `maintenance.html` | Admin, Technician | Maintenance log with date/tech filtering |
| 7 | Lab Map | `map.html` | Admin, Technician | Grid-based interactive device map |
| 8 | Alerts | `alerts.html` | Admin, Technician | Predictive alerts + ML predictions |
| 9 | AI Assistant | `ai.html` | Admin, Technician, User | Chat-based AI diagnosis |
| 10 | Reports | `reports.html` | Admin, Technician | Printable analytics & charts |
| 11 | Users | `admin.html` | Admin | User management (admin-only) |
| 12 | Forgot Password | `forgot-password.html` | Public | Password reset request |
| 13 | Reset Password | `reset-password.html` | Public | Token-based password reset |

**Role gating** is implemented via `data-roles` attributes on sidebar nav items and runtime JavaScript checks that redirect unauthorized users.

---

## 3. Bilingual Architecture (i18n)

Translation is handled by `public/js/i18n.js` — a 607-line, zero-dependency system supporting Arabic (RTL) and English (LTR).

### Key Features

- **Two complete translation objects** (`ar` and `en`) with 250+ keys each
- **Automatic RTL/LTR direction switching** via `document.documentElement.dir`
- **Language persistence** in `localStorage`
- **Declarative markup** using `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` attributes
- **Event dispatch** (`languagechange`) so dynamic content can re-render

### Core API

```javascript
function getLang() {
  return localStorage.getItem('lang') || 'en';
}

function setLanguage(lang) {
  if (!translations[lang]) lang = 'ar';
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  applyTranslations();
  window.dispatchEvent(new Event('languagechange'));
}

function t(key) {
  const lang = getLang();
  return translations[lang]?.[key] ?? translations['ar']?.[key] ?? key;
}
```

### Translation Application

```javascript
function applyTranslations() {
  // text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[getLang()]?.[key]) {
      el.textContent = translations[getLang()][key];
    }
  });
  // placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (translations[getLang()]?.[key]) {
      el.placeholder = translations[getLang()][key];
    }
  });
  // title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => { /* ... */ });
  // document title
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) { /* ... */ }
  // update lang switcher button text
  const switcher = document.getElementById('lang-switcher');
  if (switcher) switcher.textContent = t('langBtn');
}
```

---

## 4. CSS Design System

All styling lives in `public/css/style.css` (663 lines). The design uses CSS custom properties for theming, a Cairo font from Google Fonts, and a consistent card-based layout.

### 4.1 CSS Variables

```css
:root {
  --primary:     #3B82F6;
  --primary-dk:  #2563EB;
  --success:     #22C55E;
  --danger:      #EF4444;
  --warning:     #F97316;
  --info:        #06B6D4;
  --bg:          #F1F5F9;
  --sidebar-bg:  #1E293B;
  --sidebar-w:   260px;
  --topbar-h:    64px;
  --card-bg:     #FFFFFF;
  --text:        #1E293B;
  --text-muted:  #64748B;
  --border:      #E2E8F0;
  --shadow:      0 2px 8px rgba(0,0,0,.07);
  --radius:      12px;
  --radius-sm:   8px;
}
```

### 4.2 Sidebar

```css
.sidebar {
  position:   fixed;
  top:        0;
  inset-inline-start: 0;
  height:     100vh;
  width:      var(--sidebar-w);
  background: var(--sidebar-bg);
  color:      #CBD5E1;
  display:    flex;
  flex-direction: column;
  z-index:    100;
  overflow-y: auto;
  transition: width .25s ease;
}

.nav-item {
  display:     flex;
  align-items: center;
  gap:         .75rem;
  padding:     .7rem 1.25rem;
  cursor:      pointer;
  border-radius: var(--radius-sm);
  margin:      .15rem .5rem;
  transition:  background .2s, color .2s;
  font-size:   .92rem;
  color:       #94A3B8;
}

.nav-item:hover  { background: rgba(255,255,255,.07); color: #fff; }
.nav-item.active {
  background: var(--primary);
  color:      #fff;
  font-weight: 600;
}
```

### 4.3 Cards

```css
.card {
  background:    var(--card-bg);
  border-radius: var(--radius);
  box-shadow:    var(--shadow);
  padding:       1.25rem;
}

.stat-card {
  background:    var(--card-bg);
  border-radius: var(--radius);
  box-shadow:    var(--shadow);
  padding:       1.25rem;
  display:       flex;
  align-items:   center;
  gap:           1rem;
}

.stat-icon {
  width:         52px;
  height:        52px;
  border-radius: var(--radius-sm);
  display:       flex;
  align-items:   center;
  justify-content: center;
  font-size:     1.4rem;
  flex-shrink:   0;
}

.stat-icon.blue   { background: #DBEAFE; color: var(--primary); }
.stat-icon.green  { background: #DCFCE7; color: var(--success); }
.stat-icon.red    { background: #FEE2E2; color: var(--danger);  }
.stat-icon.orange { background: #FFEDD5; color: var(--warning); }
```

### 4.4 Badges

```css
.badge {
  display:       inline-flex;
  align-items:   center;
  gap:           .3rem;
  padding:       .2rem .65rem;
  border-radius: 999px;
  font-size:     .78rem;
  font-weight:   600;
}

.badge-working     { background: #DCFCE7; color: #15803D; }
.badge-broken      { background: #FEE2E2; color: #B91C1C; }
.badge-maintenance { background: #FFEDD5; color: #C2410C; }
.badge-low         { background: #F0FDF4; color: #15803D; }
.badge-medium      { background: #FFFBEB; color: #B45309; }
.badge-high        { background: #FFF1F2; color: #BE123C; }
```

### 4.5 Tables

```css
.table-wrapper { overflow-x: auto; }

table {
  width:           100%;
  border-collapse: collapse;
  font-size:       .88rem;
}

thead th {
  background:    var(--bg);
  padding:       .75rem 1rem;
  text-align:    start;
  font-weight:   600;
  color:         var(--text-muted);
  font-size:     .8rem;
  text-transform: uppercase;
  white-space:   nowrap;
}

tbody td {
  padding:     .75rem 1rem;
  border-top:  1px solid var(--border);
  vertical-align: middle;
}

tbody tr:hover { background: #F8FAFC; }
```

### 4.6 Buttons

```css
.btn {
  display:       inline-flex;
  align-items:   center;
  gap:           .4rem;
  padding:       .5rem 1.1rem;
  border:        none;
  border-radius: 999px;
  font-family:   'Cairo', sans-serif;
  font-size:     .88rem;
  font-weight:   600;
  cursor:        pointer;
  transition:    all .2s;
  white-space:   nowrap;
}

.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dk); }
.btn-success { background: var(--success); color: #fff; }
.btn-danger  { background: var(--danger);  color: #fff; }
.btn-outline { background: transparent; border: 1.5px solid var(--border); color: var(--text); }
```

### 4.7 Forms

```css
.form-group { margin-bottom: 1rem; }

.form-label {
  display:       block;
  margin-bottom: .4rem;
  font-weight:   600;
  font-size:     .88rem;
}

.form-control {
  width:         100%;
  padding:       .55rem .9rem;
  border:        1.5px solid var(--border);
  border-radius: var(--radius-sm);
  font-family:   'Cairo', sans-serif;
  font-size:     .9rem;
  color:         var(--text);
  background:    #fff;
  transition:    border .2s;
}

.form-control:focus {
  outline:       none;
  border-color:  var(--primary);
  box-shadow:    0 0 0 3px rgba(59,130,246,.15);
}
```

### 4.8 Modal

```css
.modal-overlay {
  position:   fixed;
  inset:      0;
  background: rgba(0,0,0,.45);
  z-index:    200;
  display:    flex;
  align-items: center;
  justify-content: center;
  padding:    1rem;
}

.modal {
  background:    #fff;
  border-radius: var(--radius);
  width:         100%;
  max-width:     500px;
  max-height:    90vh;
  overflow-y:    auto;
  box-shadow:    0 20px 60px rgba(0,0,0,.2);
}
```

### 4.9 Alert Items

```css
.alert-item {
  background:    #fff;
  border-radius: var(--radius-sm);
  padding:       1rem 1.1rem;
  border-inline-end: 4px solid transparent;
  box-shadow:    var(--shadow);
  margin-bottom: .6rem;
  display:       flex;
  align-items:   flex-start;
  gap:           .75rem;
}

.alert-item.high   { border-inline-end-color: var(--danger); }
.alert-item.medium { border-inline-end-color: var(--warning); }
.alert-item.low    { border-inline-end-color: var(--success); }
.alert-item.read   { opacity: .6; }
```

### 4.10 Map Styles

```css
.map-container {
  background:    #fff;
  border-radius: var(--radius);
  box-shadow:    var(--shadow);
  padding:       1.5rem;
  overflow:      auto;
}

.device-rect {
  rx:         8;
  stroke:     #fff;
  stroke-width: 2;
  cursor:     pointer;
  transition: opacity .2s;
}
.device-rect:hover { opacity: .8; }
.device-rect.working     { fill: var(--success); }
.device-rect.broken      { fill: var(--danger); }
.device-rect.maintenance { fill: var(--warning); }
```

### 4.11 Toast Notifications

```css
#toast-container {
  position:  fixed;
  bottom:    1.5rem;
  inset-inline-start: 1.5rem;
  z-index:   999;
  display:   flex;
  flex-direction: column;
  gap:       .5rem;
}

.toast {
  background:    #1E293B;
  color:         #fff;
  border-radius: var(--radius-sm);
  padding:       .75rem 1.1rem;
  font-size:     .88rem;
  min-width:     220px;
  box-shadow:    0 4px 20px rgba(0,0,0,.2);
  animation:     slideIn .3s ease;
}

.toast.success { border-inline-end: 4px solid var(--success); }
.toast.error   { border-inline-end: 4px solid var(--danger);  }
.toast.info    { border-inline-end: 4px solid var(--primary); }
```

### 4.12 Responsive Design

```css
@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
  .grid-1-2 { grid-template-columns: 1fr; }
}

@media (max-width: 700px) {
  :root { --sidebar-w: 0px; }
  .sidebar { transform: translateX(-100%); transition: transform .25s; }
  .sidebar.open { transform: translateX(0); --sidebar-w: 260px; }
  [dir="rtl"] .sidebar { transform: translateX(100%); }
  [dir="rtl"] .sidebar.open { transform: translateX(0); }
  .topbar { inset-inline-end: 0; inset-inline-start: 0; }
  .main-content { margin-inline-start: 0; }
  .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
}
```

---

## 5. Chart.js Integration

Chart.js (loaded via CDN) powers the dashboard and reports pages:

- **Dashboard doughnut chart** — Device status distribution (working / broken / maintenance)
- **Reports bar chart** — Monthly issue counts
- **Reports horizontal bar** — Most broken devices ranking

Charts are initialized in page-specific inline scripts after fetching data from `/api/reports/summary` and `/api/devices`.

---

## 6. Interactive Lab Map

The lab map (`map.html`) renders devices as a grid of status-colored cards. Each device is positioned by its `location_x` and `location_y` coordinates.

### Map Grid CSS

```css
.map-grid { display:grid; grid-template-columns: repeat(5,1fr); gap:16px; }

.device-card-map { border-radius:10px; padding:1rem .5rem; text-align:center; cursor:pointer; transition:.2s; position:relative; border:2px solid transparent; }
.device-card-map:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(0,0,0,.12); }

.device-card-map.working   { background:#dcfce7; border-color:#22c55e }
.device-card-map.broken    { background:#fee2e2; border-color:#ef4444 }
.device-card-map.maintenance { background:#fef9c3; border-color:#f97316 }
```

### Map Interaction

- Click any device card to open the device detail page
- Color coding: green (working), red (broken), yellow (maintenance)
- Quick stats bar shows total/working/broken/maintenance counts
- Refresh button re-fetches device data from `/api/devices`

---

## 7. AI Chat Interface

The AI Assistant page (`ai.html`) provides a chat-style interface for device fault diagnosis.

### Chat Layout

- **Message area** — Scrollable conversation history with avatar bubbles
- **Quick-action buttons** — Pre-filled common issues ("Device won't turn on", "Screen issue", etc.)
- **Device linker** — Optional dropdown to associate the chat with a specific device
- **Input area** — Textarea with send button

### Chat Styling

```css
.chat-wrap {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 130px);
  max-width: 860px;
  margin: 0 auto;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: .85rem;
  padding: 1.25rem;
  background: #f8fafc;
  border-radius: 14px 14px 0 0;
}

.msg-bubble {
  max-width: 72%;
  padding: .85rem 1.1rem;
  border-radius: 14px;
  font-size: .93rem;
  line-height: 1.7;
  white-space: pre-wrap;
}

.msg.ai   .msg-bubble { background: #fff; border: 1px solid var(--border); }
.msg.user .msg-bubble { background: var(--primary); color: #fff; }
```

### AI API Flow

1. User describes the issue (+ optional device link)
2. Frontend POSTs to `/api/ai/diagnose` with `{ description, device_id }`
3. Backend queries the AI factory (OpenRouter or Ollama)
4. Response is streamed/rendered into the chat bubble

---

## 8. State Management

No Redux or Vuex — state is managed via `localStorage` and simple module-level variables:

| State | Storage | Key |
|-------|---------|-----|
| JWT token | `localStorage` | `token` |
| Language preference | `localStorage` | `lang` |
| Current user | `localStorage` | `user` (JSON) |
| Chat history | `localStorage` | `ai_chat_history` (per-page, optional) |

### Auth Flow

```javascript
// Login → store token
localStorage.setItem('token', res.token);
localStorage.setItem('user', JSON.stringify(res.user));

// Logout → clear everything
localStorage.removeItem('token');
localStorage.removeItem('user');

// API calls → attach Bearer token
fetch('/api/devices', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
});
```

### Shared `api.js`

A common `public/js/api.js` module wraps all fetch calls with auth headers, error handling, and toast notifications for consistent UX across pages.

---

## 9. Asset Structure

```
public/
├── index.html          # Login
├── dashboard.html      # Admin/tech dashboard
├── devices.html        # Device list
├── device.html         # Device detail
├── issues.html         # Issue management
├── maintenance.html    # Maintenance logs
├── map.html            # Lab map
├── alerts.html         # Predictive alerts
├── ai.html             # AI assistant
├── reports.html        # Analytics reports
├── admin.html          # User management
├── forgot-password.html
├── reset-password.html
├── css/
│   └── style.css       # 663-line design system
├── js/
│   ├── i18n.js         # 607-line translation system
│   └── api.js          # Shared API wrapper
└── img/
    └── lab-bg.jpg      # Login background
```

---

## 10. Summary

| Concern | Implementation |
|---------|---------------|
| Architecture | Multi-page HTML (not SPA) |
| Styling | Custom CSS with variables, 663 lines |
| i18n | Custom JS translator, 607 lines, AR/EN |
| Charts | Chart.js via CDN |
| Map | CSS Grid, status-colored cards |
| AI Chat | Custom styled chat interface |
| State | `localStorage` (token, user, lang) |
| Icons | Font Awesome 6.5 |
| Font | Cairo (Google Fonts) |
| Responsive | Mobile-first, sidebar collapses at 700px |
