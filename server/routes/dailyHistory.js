/**
 * @fileoverview BakeFlow ERP — routes/dailyHistory.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/dailyHistoryController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',       ctrl.getAllDailyHistory);
router.get('/:date',  ctrl.getDailyHistory);

module.exports = router;
