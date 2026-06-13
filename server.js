require('dotenv').config();
const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Attach io to app for use in routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// ── Cron Job for predictive alerts ─────────────────────────────
require('./services/predictive');

server.listen(PORT, () => {
  console.log(`🚀 Smart Lab running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket server active`);
  console.log(`📖 API docs at http://localhost:${PORT}/api/docs`);
});
