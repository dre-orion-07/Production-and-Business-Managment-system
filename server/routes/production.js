/**
 * @fileoverview BakeFlow ERP — routes/production.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/productionController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',  ctrl.getProductions);
router.post('/', ctrl.saveProduction);

module.exports = router;
