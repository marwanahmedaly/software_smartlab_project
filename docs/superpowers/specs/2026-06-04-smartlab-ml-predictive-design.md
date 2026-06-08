# SmartLab ML Predictive Maintenance Design

**Date:** 2026-06-04  
**Project:** SmartLab — Smart Computer Lab Management & Maintenance System  
**Version:** 1.0.0  
**File:** `docs/superpowers/specs/2026-06-04-smartlab-ml-predictive-design.md`

---

## Overview

SmartLab employs a machine learning pipeline to predict device failure probability and enable proactive maintenance. A Random Forest classifier is trained on 5000 synthetic samples representing historical device behavior, then applied to live database data to generate risk scores for each device. The system bridges Node.js and Python via a child process spawn, exposing predictions through a REST API. Predicted failures are automatically converted into alerts for administrators and technicians, allowing intervention before devices actually break down.

---

## 1. Python ML Environment

**File:** `requirements.txt`

The Python runtime dependencies for training and inference:

```text
numpy>=1.24.0
scikit-learn>=1.3.0
joblib>=1.3.0
```

**Runtime:** Python 3.x  
**Key Libraries:**
- `numpy` — Numerical arrays and matrix operations
- `scikit-learn` — RandomForestClassifier and StandardScaler
- `joblib` — Model and scaler serialization to `.pkl` files

---

## 2. Feature Engineering

The model uses 6 engineered features extracted from device records and issue history:

| Feature | Type | Description |
|---------|------|-------------|
| `age_years` | float | Device age in years |
| `days_since_maint` | float | Days elapsed since last maintenance (9999 if never maintained) |
| `issues_3m` | int | Count of issues reported in the last 3 months |
| `issues_6m` | int | Count of issues reported in the last 6 months |
| `avg_fix_hours` | float | Average resolution time in hours for resolved issues |
| `status` | int (0/1/2) | Current device status: `working`=0, `maintenance`=1, `broken`=2 |

These features capture both static device attributes and dynamic behavioral patterns, enabling the model to learn correlations between maintenance history, issue frequency, and failure likelihood.

---

## 3. Random Forest Model Configuration

**Algorithm:** RandomForestClassifier (scikit-learn)  
**Hyperparameters:**

```python
RandomForestClassifier(
    n_estimators=300,      # 300 decision trees
    max_depth=15,          # Maximum tree depth to prevent overfitting
    min_samples_split=5,   # Minimum samples required to split an internal node
    random_state=42,       # Reproducible random seed
    class_weight='balanced'  # Adjust for imbalanced failure vs. non-failure classes
)
```

**Preprocessing:** StandardScaler is fit on training data and applied to both training and prediction features for normalization.

---

## 4. Training Pipeline

**Training Data:** 5000 synthetic samples stored in `services/smartlab_training.csv`.  
**Label:** Binary (`0` = no failure, `1` = failure predicted).  
**Pipeline Steps:**

1. Load CSV into numpy arrays (features `X`, labels `y`).
2. Validate that both classes exist in the dataset.
3. Fit `StandardScaler` on `X` and transform to `X_scaled`.
4. Train `RandomForestClassifier` on scaled data.
5. Persist model to `smartlab_rf_model.pkl` and scaler to `smartlab_rf_scaler.pkl` using `joblib.dump()`.
6. Return training metadata including sample counts, class distribution, and per-feature importance scores.

---

## 5. Model Persistence

Trained artifacts are saved to disk and reused across prediction runs:

| File | Purpose |
|------|---------|
| `services/smartlab_rf_model.pkl` | Serialized RandomForestClassifier |
| `services/smartlab_rf_scaler.pkl` | Serialized StandardScaler |
| `services/smartlab_training.csv` | 5000 synthetic training samples |

If model files are missing at prediction time, the system automatically retrains using the CSV data before generating predictions.

---

## 6. Node.js to Python Bridge

**File:** `services/ml_bridge.js`

Spawns the Python predictor script as a child process, capturing stdout/stderr, extracting JSON output, and returning a parsed JavaScript object.

```javascript
const { spawn } = require('child_process');
const path = require('path');

const PYTHON = 'python3';
const SCRIPT = path.join(__dirname, 'ml_predictor.py');

/**
 * Runs the Python ML predictor and returns parsed JSON.
 * @param {'train'|'predict'} mode
 */
function runModel(mode = 'predict') {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT, mode], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited ${code}: ${stderr || stdout}`));
      }
      try {
        // Extract JSON from stdout (find first { to last })
        const start = stdout.indexOf('{');
        const end = stdout.lastIndexOf('}');
        const jsonStr = (start !== -1 && end !== -1 && end > start)
          ? stdout.slice(start, end + 1)
          : stdout;
        const result = JSON.parse(jsonStr);
        resolve(result);
      } catch (e) {
        reject(new Error(`Invalid JSON from Python: ${stdout}\n${stderr}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

module.exports = { runModel };
```

**Modes:**
- `'train'` — Trains the model and outputs training metadata.
- `'predict'` — Loads model, extracts live DB features, and outputs predictions.

---

## 7. Prediction API Endpoint

**File:** `routes/alerts.js`

The alerts router exposes endpoints for retrieving predictions and converting them into actionable alerts.

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

**Endpoints:**

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/alerts` | List alerts with optional filters | admin, technician |
| GET | `/api/alerts/predictions` | Get raw ML predictions for all devices | admin, technician |
| POST | `/api/alerts/predictions/run` | Run model and create alerts for medium+ risk | admin, technician |
| PATCH | `/api/alerts/read-all` | Mark all alerts as read | admin, technician |
| PATCH | `/api/alerts/:id/read` | Mark one alert as read | admin, technician |

**Alert Creation Logic:**
- Only predictions with score ≥ 30 are converted to alerts.
- Duplicate prevention: only one unread `prediction` alert per device per day.
- Severity mapping: `score >= 60` → high, `score >= 40` → medium, else low.

---

## 8. ML Predictor — Complete Python Script

**File:** `services/ml_predictor.py` (206 lines)

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_predictor.py — Pretrained Random Forest model for device failure prediction.
Trains on 5000 synthetic CSV samples, predicts on live DB data.
"""
import sys
import io
import json
import csv
import sqlite3
import os
from datetime import datetime, timedelta

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'smartlab.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), 'smartlab_training.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'smartlab_rf_model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'smartlab_rf_scaler.pkl')

def get_connection():
    return sqlite3.connect(DB_PATH)

def load_csv_data():
    """Load 5000 training samples from CSV. Returns X, y."""
    X = []
    y = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            X.append([
                float(row['age_years']),
                float(row['days_since_maint']),
                int(row['issues_3m']),
                int(row['issues_6m']),
                float(row['avg_fix_hours']),
                int(row['status']),
            ])
            y.append(int(row['label']))
    return np.array(X), np.array(y)

def extract_db_features(conn):
    """Extract features from the live database for prediction."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices")
    devices = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    device_rows = [dict(zip(cols, row)) for row in devices]

    now = datetime.now()
    three_months_ago = (now - timedelta(days=90)).strftime('%Y-%m-%d')
    six_months_ago = (now - timedelta(days=180)).strftime('%Y-%m-%d')

    X = []
    device_info = []

    for d in device_rows:
        age = float(d.get('age_years') or 0)

        last_maint = d.get('last_maintenance')
        if last_maint:
            days_since_maint = (now - datetime.strptime(last_maint, '%Y-%m-%d')).days
        else:
            days_since_maint = 9999

        cursor.execute(
            "SELECT COUNT(*) FROM issues WHERE device_id = ? AND created_at >= ?",
            (d['id'], three_months_ago)
        )
        issues_3m = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM issues WHERE device_id = ? AND created_at >= ?",
            (d['id'], six_months_ago)
        )
        issues_6m = cursor.fetchone()[0]

        cursor.execute(
            "SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) "
            "FROM issues WHERE device_id = ? AND status = 'resolved' AND resolved_at IS NOT NULL",
            (d['id'],)
        )
        avg_fix = cursor.fetchone()[0] or 0

        status_map = {'working': 0, 'maintenance': 1, 'broken': 2}
        status_enc = status_map.get(d.get('status', 'working'), 0)

        X.append([
            age,
            days_since_maint,
            issues_3m,
            issues_6m,
            avg_fix,
            status_enc,
        ])

        device_info.append({
            'id': d['id'],
            'name': d['name'],
            'type': d['type'],
        })

    return np.array(X), device_info

def _train_internal():
    """Train and save model using CSV data."""
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Training CSV not found: {CSV_PATH}")

    X, y = load_csv_data()

    if len(np.unique(y)) < 2:
        raise ValueError("Not enough class variety to train model")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=15,
        min_samples_split=5,
        random_state=42,
        class_weight='balanced'
    )
    model.fit(X_scaled, y)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    feature_names = ['age_years', 'days_since_maint', 'issues_3m', 'issues_6m', 'avg_fix_hours', 'status']
    importances = dict(zip(feature_names, model.feature_importances_.tolist()))
    return {
        "status": "trained",
        "samples": len(y),
        "positive_class": int(y.sum()),
        "negative_class": int(len(y) - y.sum()),
        "feature_importances": importances
    }

def train():
    result = _train_internal()
    print(json.dumps(result, ensure_ascii=False))

def predict():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        _train_internal()

    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    conn = get_connection()
    X, device_info = extract_db_features(conn)
    conn.close()

    X_scaled = scaler.transform(X)
    probs = model.predict_proba(X_scaled)[:, 1]

    predictions = []
    for info, prob in zip(device_info, probs):
        score = round(prob * 100)
        if score >= 75:
            probability = 'عالي جداً'
            severity = 'high'
        elif score >= 60:
            probability = 'عالٍ'
            severity = 'high'
        elif score >= 40:
            probability = 'متوسط'
            severity = 'medium'
        elif score >= 20:
            probability = 'منخفض'
            severity = 'low'
        else:
            probability = 'منخفض جداً'
            severity = 'low'

        predictions.append({
            "device_id": info['id'],
            "device_name": info['name'],
            "device_type": info['type'],
            "score": score,
            "probability": probability,
            "severity": severity,
            "raw_probability": round(float(prob), 4)
        })

    predictions.sort(key=lambda x: x['score'], reverse=True)
    print(json.dumps({"predictions": predictions}, ensure_ascii=False))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        predict()
    elif sys.argv[1] == 'train':
        train()
    elif sys.argv[1] == 'predict':
        predict()
    else:
        predict()
```

**Script Behavior:**
- No arguments or unknown argument → runs prediction.
- `train` argument → trains model, prints training metadata JSON.
- `predict` argument → loads model, extracts features, prints predictions JSON sorted by risk score descending.

**Probability to Severity Mapping:**

| Score Range | Arabic Label | Severity |
|-------------|--------------|----------|
| ≥ 75 | عالي جداً | high |
| 60–74 | عالٍ | high |
| 40–59 | متوسط | medium |
| 20–39 | منخفض | low |
| < 20 | منخفض جداً | low |

---

## 9. Architecture Summary

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Node.js Server │────▶│  ml_bridge   │────▶│  ml_predictor   │
│  (Express)      │     │  (spawn)     │     │  (Python)       │
└─────────────────┘     └──────────────┘     └─────────────────┘
        │                                              │
        ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│  routes/alerts  │◀─────────────────────────│  Predictions    │
│  (REST API)     │     JSON stdout          │  (sorted)       │
└─────────────────┘                          └─────────────────┘
        │
        ▼
┌─────────────────┐
│  Alerts Table   │
│  (SQLite)       │
└─────────────────┘
```

The predictive maintenance module enables SmartLab to shift from reactive repairs to proactive maintenance, reducing downtime and extending device lifespan through data-driven risk assessment.
