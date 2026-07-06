/**
 * @fileoverview BakeFlow ERP — routes/batchMixes.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/batchMixController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',       ctrl.getBatchMixes);
router.post('/',      ctrl.createBatchMix);
router.get('/:id',    ctrl.getBatchMixById);
router.put('/:id',    ctrl.updateBatchMix);
router.delete('/:id', ctrl.deleteBatchMix);

module.exports = router;
