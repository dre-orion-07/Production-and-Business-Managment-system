/**
 * @fileoverview BakeFlow ERP — config/db.js
 * Mongoose connection with retry logic and connection event logging.
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGODB_URI environment variable.
 * Exits the process on fatal connection failure.
 * @returns {Promise<void>}
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[BakeFlow DB] MONGODB_URI is not set. Check your .env file.');
    process.exit(1);
  }

  mongoose.connection.on('connected', () => {
    console.log('[BakeFlow DB] MongoDB connected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[BakeFlow DB] Connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[BakeFlow DB] MongoDB disconnected.');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
}

module.exports = connectDB;
