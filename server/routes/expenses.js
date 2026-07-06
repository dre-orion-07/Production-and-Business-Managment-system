/**
 * @fileoverview BakeFlow ERP — routes/expenses.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/expenseController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',            ctrl.getExpenses);
router.post('/',           ctrl.saveExpense);
router.patch('/:id/void',  ctrl.voidExpense);

module.exports = router;
