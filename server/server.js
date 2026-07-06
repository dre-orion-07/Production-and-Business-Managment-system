/**
 * @fileoverview BakeFlow ERP — server.js
 * Express application entry point.
 * Connects to MongoDB, mounts all routes, and starts listening.
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const connectDB    = require('./config/db');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// ─────────────────────────────────────────────────────────────────────────────
// CORS — allow the frontend origin with credentials (cookies)
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5500')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (e.g. same-machine file:// or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,   // required for HttpOnly cookies
}));

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));   // 10 MB for backup imports
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/ingredients',        require('./routes/ingredients'));
app.use('/api/batch-mixes',        require('./routes/batchMixes'));
app.use('/api/production',         require('./routes/production'));
app.use('/api/finished-inventory', require('./routes/finishedInventory'));
app.use('/api/sales',              require('./routes/sales'));
app.use('/api/customers',          require('./routes/customers'));
app.use('/api/expenses',           require('./routes/expenses'));
app.use('/api/daily-history',      require('./routes/dailyHistory'));
app.use('/api/settings',           require('./routes/settings'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[BakeFlow Server] Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[BakeFlow Server] Listening on http://localhost:${PORT}`);
      console.log(`[BakeFlow Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[BakeFlow Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
