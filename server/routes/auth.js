/**
 * @fileoverview BakeFlow ERP — routes/auth.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const { signup, login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/signup',  signup);
router.post('/login',   login);
router.post('/logout',  logout);
router.get('/me',       requireAuth, me);

module.exports = router;
