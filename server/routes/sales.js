/**
 * @fileoverview BakeFlow ERP — routes/sales.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/saleController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',          ctrl.getSales);
router.post('/',         ctrl.saveSale);
router.patch('/:id/void', ctrl.voidSale);

module.exports = router;
