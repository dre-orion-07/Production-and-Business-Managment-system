/**
 * @fileoverview BakeFlow ERP — middleware/auth.js
 * JWT verification middleware. Reads token from HttpOnly cookie.
 * Attaches req.userId to all protected routes.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware that verifies the JWT from the 'bakeflow_token' HttpOnly cookie.
 * Responds with 401 if missing or invalid.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.bakeflow_token;

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
