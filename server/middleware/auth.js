/**
 * @fileoverview BakeFlow ERP — middleware/auth.js
 * JWT verification middleware. Reads token from Authorization: Bearer header.
 * Attaches req.userId to all protected routes.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware that verifies the JWT from the 'Authorization' Bearer header.
 * Responds with 401 if missing or invalid.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid session. Please log in again.' });
  }
}

module.exports = { requireAuth };
