require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;

// ── Cron Job for predictive alerts ─────────────────────────────
require('./services/predictive');

app.listen(PORT, () => {
  console.log(`🚀 Smart Lab running at http://localhost:${PORT}`);
});
