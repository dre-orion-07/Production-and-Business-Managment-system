/**
 * @fileoverview BakeFlow ERP — models/User.js
 * Single-bakery user model. Stores hashed password and bakery metadata.
 */

'use strict';

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  bakeryName: {
    type: String,
    default: 'BakeFlow Bakery',
    trim: true,
  },
  role: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
  },
});

// Never return passwordHash in JSON responses
UserSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
