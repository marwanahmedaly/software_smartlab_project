/**
 * predictor.js — Simple failure prediction model
 * Uses a scoring model based on historical data patterns
 */
const db = require('../db/database');

/**
 * Calculates risk score (0-100) for each device based on:
 * 1. Device age
 * 2. Maintenance period
 * 3. Fault frequency
 * 4. Average repair time
 * 5. Current status
 */
function calculateRiskScore(device) {
  let score = 0;
  const now = new Date();

  // 1. Device age (0-25 points) — each year = ~3.5 points
  score += Math.min(device.age_years * 3.5, 25);

  // 2. Maintenance gap (0-25 points)
  if (device.last_maintenance) {
    const daysSince = (now - new Date(device.last_maintenance)) / (1000 * 60 * 60 * 24);
    score += Math.min(daysSince / 12, 25); // ~12 days = 1 point
  } else {
    score += 25; // Never maintained
  }

  // 3. Fault frequency in last 3 months (0-25 points)
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const recentIssues = db.prepare(`
    SELECT COUNT(*) as c FROM issues
    WHERE device_id = ? AND created_at >= ?
  `).get(device.id, threeMonthsAgo.toISOString().split('T')[0]).c;
  score += Math.min(recentIssues * 8, 25);

  // 4. Average repair time for device (0-15 points)
  const avgFix = db.prepare(`
    SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
    FROM issues WHERE device_id = ? AND status = 'resolved' AND resolved_at IS NOT NULL
  `).get(device.id).avg_hours;
  if (avgFix) {
    score += Math.min(avgFix / 8, 15); // every 8 hours = 1 point
  }

  // 5. Current status (0-10 points)
  if (device.status === 'broken') score += 10;
  else if (device.status === 'maintenance') score += 5;

  return Math.min(Math.round(score), 100);
}

/**
 * Calculates failure probability (0-100%) and determines alert severity
 */
function predictFailure(device) {
  const score = calculateRiskScore(device);

  let probability;
  if (score >= 80) probability = 'Very High';
  else if (score >= 60) probability = 'High';
  else if (score >= 40) probability = 'Medium';
  else if (score >= 20) probability = 'Low';
  else probability = 'Very Low';

  let severity;
  if (score >= 75) severity = 'high';
  else if (score >= 45) severity = 'medium';
  else severity = 'low';

  return { score, probability, severity };
}

/**
* Analyzes all devices and returns a list of predictions
*/
function predictAll() {
  const devices = db.prepare('SELECT * FROM devices').all();
  const predictions = [];

  for (const device of devices) {
    const pred = predictFailure(device);
    if (pred.score >= 30) { // Only show medium risk and above
      predictions.push({
        device_id: device.id,
        device_name: device.name,
        device_type: device.type,
        ...pred
      });
    }
  }

  // Sort descending by risk
  predictions.sort((a, b) => b.score - a.score);
  return predictions;
}

module.exports = { calculateRiskScore, predictFailure, predictAll };
