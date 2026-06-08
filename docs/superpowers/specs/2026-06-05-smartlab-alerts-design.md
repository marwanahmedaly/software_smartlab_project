# Alert System Design Specification

**Title:** SmartLab Alert System Design  
**Date:** 2026-06-05  
**Project:** SmartLab — Computer Lab Management & Maintenance System  
**Spec:** spec-05

---

## 1. Overview

The SmartLab Alert System provides proactive, predictive alerting for lab device maintenance. It combines heuristic rule-based checks (device age, fault frequency, maintenance gaps) with a trained Random Forest ML model to surface actionable alerts before devices fail. Alerts are generated automatically via cron scheduling, deduplicated to prevent noise, and exposed through a REST API for dashboard integration.

---

## 2. Alert Types

| Type | Trigger | Data Source |
|------|---------|-------------|
| `age` | Device age > 5 years | `devices.age_years` |
| `frequency` | 3+ issues in the past month | `issues` table (last 30 days) |
| `maintenance_gap` | Last maintenance > 6 months ago | `devices.last_maintenance` |
| `prediction` | ML model predicts medium+ risk | Random Forest via `ml_bridge` |

---

## 3. Severity Levels

| Level | Color | Criteria |
|-------|-------|----------|
| `low` | Green | Maintenance gap 6–9 months |
| `medium` | Orange | Device age 5–7 years; ML score 30–69% |
| `high` | Red | Device age > 7 years; 3+ monthly faults; ML score ≥ 70% |

---

## 4. Alert Generation

### 4.1 Cron-Based Scheduling

Alerts run automatically at two triggers:

- **Server startup** — `runPredictiveCheck()` is invoked immediately on boot
- **Daily at 8:00 AM** — `node-cron` schedules `0 8 * * *`

```javascript
// services/predictive.js
const cron = require('node-cron');

// Run on server startup
runPredictiveCheck().catch(err => console.error('Startup predictive check failed:', err.message));

// Schedule: every day at 8 AM
cron.schedule('0 8 * * *', () => {
  console.log('⏰ Running predictive alert check...');
  runPredictiveCheck().catch(err => console.error('Cron predictive check failed:', err.message));
});
```

### 4.2 Simple Heuristic Predictor

The `runPredictiveCheck()` function in `services/predictive.js` performs three rule-based scans:

```javascript
// 1. Check age > 5 years
if (device.age_years > 5) {
  const severity = device.age_years > 7 ? 'high' : 'medium';
  createAlertIfNew(
    device.id, 'age',
    `Device ${device.name} is ${device.age_years} years old, review or replacement recommended`,
    severity
  );
}

// 2. Check fault frequency > 3 in the last month
const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
const freq = db.prepare(`
  SELECT COUNT(*) as c FROM issues
  WHERE device_id = ? AND created_at >= ?
`).get(device.id, monthAgo.toISOString().split('T')[0]).c;

if (freq >= 3) {
  createAlertIfNew(
    device.id, 'frequency',
    `Device ${device.name} malfunctioned ${freq} times in the past month, needs comprehensive inspection`,
    'high'
  );
}

// 3. Check maintenance gap > 6 months
if (device.last_maintenance) {
  const lastMaint = new Date(device.last_maintenance);
  const monthsDiff = (now - lastMaint) / (1000 * 60 * 60 * 24 * 30);
  if (monthsDiff > 6) {
    createAlertIfNew(
      device.id, 'maintenance_gap',
      `${Math.floor(monthsDiff)} months since last maintenance for device ${device.name}`,
      monthsDiff > 9 ? 'medium' : 'low'
    );
  }
}
```

---

## 5. ML-Triggered Alerts

The Random Forest model runs as the fourth check within `runPredictiveCheck()`. Only predictions with a score ≥ 30 (medium risk and above) generate alerts:

```javascript
// 4. Trained prediction model — Random Forest
try {
  const result = await runModel('predict');
  if (result.predictions) {
    for (const p of result.predictions) {
      if (p.score >= 30) { // Only medium risk and above
        createAlertIfNew(
          p.device_id,
          'prediction',
          `🤖 Trained model prediction: Device ${p.device_name} failure probability ${p.probability} (${p.score}%)`,
          p.severity
        );
      }
    }
  }
} catch (err) {
  console.error('❌ ML Model error:', err.message);
}
```

---

## 6. Alert Deduplication Logic

The `createAlertIfNew()` helper prevents duplicate alerts for the same device, type, and day:

```javascript
function createAlertIfNew(device_id, type, message, severity) {
  const existing = db.prepare(`
    SELECT id FROM alerts
    WHERE device_id = ? AND type = ? AND is_read = 0
      AND DATE(created_at) = DATE('now')
  `).get(device_id, type);

  if (!existing) {
    db.prepare('INSERT INTO alerts (device_id, type, message, severity) VALUES (?, ?, ?, ?)')
      .run(device_id, type, message, severity);
    console.log(`🔔 New alert: ${message}`);
  }
}
```

**Deduplication rules:**
- Same `device_id` + `type` + unread (`is_read = 0`) + same calendar day = skip
- If the user marks an alert as read, a new alert can be generated the next day
- This prevents alert spam while keeping the system current

---

## 7. Alert Management API

Full route file: `routes/alerts.js`

```javascript
const express = require('express');
const db      = require('../db/database');
const { runModel } = require('../services/ml_bridge');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts — List alerts (admin/tech only)
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { severity, is_read, type } = req.query;
  let where = '1=1';
  const params = [];

  if (severity !== undefined) { where += ' AND a.severity = ?'; params.push(severity); }
  if (is_read  !== undefined) { where += ' AND a.is_read = ?';  params.push(Number(is_read)); }
  if (type     !== undefined) { where += ' AND a.type = ?';     params.push(type); }

  const alerts = db.prepare(`
    SELECT a.*, d.name AS device_name
    FROM alerts a
    LEFT JOIN devices d ON a.device_id = d.id
    WHERE ${where}
    ORDER BY a.created_at DESC
  `).all(...params);

  const unread = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
  res.json({ alerts, unread });
});

// GET /api/alerts/predictions — Trained model predictions (admin/tech only)
router.get('/predictions', authenticate, authorize('admin', 'technician'), async (req, res) => {
  try {
    const result = await runModel('predict');
    res.json({ predictions: result.predictions || [] });
  } catch (err) {
    console.error('ML predict error:', err.message);
    res.status(500).json({ error: 'Failed to run trained prediction model' });
  }
});

// POST /api/alerts/predictions/run — Run model manually (admin/tech)
router.post('/predictions/run', authenticate, authorize('admin', 'technician'), async (req, res) => {
  try {
    const result = await runModel('predict');
    const predictions = result.predictions || [];
    let created = 0;
    for (const p of predictions) {
      if (p.score < 30) continue; // Only medium risk and above
      const existing = db.prepare(`
        SELECT id FROM alerts
        WHERE device_id = ? AND type = 'prediction' AND is_read = 0
          AND DATE(created_at) = DATE('now')
      `).get(p.device_id);
      if (!existing) {
        db.prepare(`
          INSERT INTO alerts (device_id, type, message, severity)
          VALUES (?, 'prediction', ?, ?)
        `).run(
          p.device_id,
          `🤖 Trained model prediction: Device ${p.device_name} failure probability ${p.probability} (${p.score}%)`,
          p.severity
        );
        created++;
      }
    }
    res.json({ message: `Created ${created} new alert(s)`, predictions, created });
  } catch (err) {
    console.error('ML run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/read-all — Mark all as read
router.patch('/read-all', authenticate, authorize('admin', 'technician'), (_req, res) => {
  db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ message: 'All alerts marked as read' });
});

// PATCH /api/alerts/:id/read — Mark one alert as read
router.patch('/:id/read', authenticate, authorize('admin', 'technician'), (req, res) => {
  const alert = db.prepare('SELECT id FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Updated' });
});

module.exports = router;
```

---

## 8. Dashboard Integration

The unread alert count is returned with every `GET /api/alerts` response as the `unread` field. The frontend renders this as a badge on the bell icon in the topbar:

```html
<!-- Topbar bell with unread badge -->
<div class="alert-bell" onclick="window.location='/alerts.html'">
  <i class="fas fa-bell"></i>
  <span class="badge-count" id="unread-count" style="display:none">0</span>
</div>
```

The badge is styled in `style.css`:

```css
.badge-count {
  position:      absolute;
  top:           -6px;
  inset-inline-start: -6px;
  background:    var(--danger);
  color:         #fff;
  border-radius: 50%;
  font-size:     .65rem;
  width:         17px;
  height:        17px;
  display:       flex;
  align-items:   center;
  justify-content: center;
  font-weight:   700;
}
```

The frontend polls or fetches the unread count on page load to keep the badge current across all authenticated pages.

---

## 9. Database Schema

```sql
CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,        -- age, frequency, maintenance_gap, prediction
  message     TEXT NOT NULL,
  severity    TEXT NOT NULL,        -- low, medium, high
  is_read     INTEGER DEFAULT 0,    -- 0 = unread, 1 = read
  created_at  DATETIME DEFAULT (datetime('now'))
);
```

---

## 10. Summary

| Concern | Implementation |
|---------|---------------|
| Scheduling | `node-cron` at 8 AM + startup |
| Heuristics | Age, frequency, maintenance gap in `predictive.js` |
| ML Model | Random Forest via `ml_bridge`/`runModel()` |
| Deduplication | Same device + type + day, unread only |
| API | Full CRUD+read on `routes/alerts.js` |
| Dashboard | Unread count badge on every page |
| Auth | `authenticate` + `authorize('admin', 'technician')` |
