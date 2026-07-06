/**
 * @fileoverview BakeFlow ERP — routes/customers.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/customerController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',               ctrl.getCustomers);
router.post('/',              ctrl.saveCustomer);
router.get('/:id',            ctrl.getCustomerById);
router.put('/:id',            ctrl.updateCustomer);
router.post('/:id/payment',   ctrl.recordPayment);

module.exports = router;
