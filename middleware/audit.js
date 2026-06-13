const db = require('../db/database');

/**
 * Log an activity to the audit_logs table
 * @param {number|null} userId
 * @param {string} action
 * @param {string} entityType
 * @param {number|null} entityId
 * @param {string|null} details
 * @param {string|null} ip
 */
function logActivity(userId, action, entityType, entityId = null, details = null, ip = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, entityType, entityId, details, ip);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

/**
 * Express middleware to log common actions
 */
function auditMiddleware(action, entityType, getEntityId = null) {
  return (req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      res.json = originalJson;
      const entityId = getEntityId ? getEntityId(req, body) : (req.params.id || null);
      const userId = req.user ? req.user.id : null;
      const ip = req.ip || req.connection.remoteAddress;
      const details = JSON.stringify({ body: req.body, params: req.params, query: req.query });
      logActivity(userId, action, entityType, entityId, details, ip);
      return res.json(body);
    };
    next();
  };
}

module.exports = { logActivity, auditMiddleware };