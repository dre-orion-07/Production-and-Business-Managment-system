/**
 * @fileoverview BakeFlow ERP — routes/finishedInventory.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/finishedInventoryController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',       ctrl.getAllFinishedInventory);
router.get('/:date',  ctrl.getFinishedInventory);
router.put('/:date',  ctrl.saveFinishedInventory);

module.exports = router;
