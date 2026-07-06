/**
 * @fileoverview BakeFlow ERP — routes/ingredients.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/ingredientController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',                        ctrl.getAllIngredients);
router.put('/',                        ctrl.saveAllIngredients);
router.post('/custom',                 ctrl.addCustomIngredient);
router.delete('/custom/:key',          ctrl.removeCustomIngredient);
router.patch('/:key/adjust',           ctrl.adjustIngredient);
router.patch('/:key/restock',          ctrl.restockIngredient);

module.exports = router;
