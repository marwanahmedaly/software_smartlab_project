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

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '..', 'smartlab.db'))
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
