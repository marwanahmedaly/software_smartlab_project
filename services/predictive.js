const cron = require('node-cron');
const db   = require('../db/database');
const { runModel } = require('./ml_bridge');

/**
 * Creates an alert only if one does not already exist for the same device and type
 */
function createAlertIfNew(device_id, type, message, severity) {
  const existing = db.prepare(`
    SELECT id FROM alerts
    WHERE device_id = ? AND type = ? AND is_read = 0
      AND DATE(created_at) = DATE('now')
  `).get(device_id, type);

  if (!existing) {
    db.prepare('INSERT INTO alerts (device_id, type, message, severity) VALUES (?, ?, ?, ?)').run(device_id, type, message, severity);
    console.log(`🔔 New alert: ${message}`);
  }
}

async function runPredictiveCheck() {
  const devices = db.prepare('SELECT * FROM devices').all();
  const now     = new Date();

  for (const device of devices) {
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
  }

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
}

// Run on server startup
runPredictiveCheck().catch(err => console.error('Startup predictive check failed:', err.message));

// Schedule: every day at 8 AM
cron.schedule('0 8 * * *', () => {
  console.log('⏰ Running predictive alert check...');
  runPredictiveCheck().catch(err => console.error('Cron predictive check failed:', err.message));
});

console.log('✅ Predictive alert service running (Random Forest)');
