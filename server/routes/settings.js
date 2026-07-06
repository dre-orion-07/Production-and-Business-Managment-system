/**
 * @fileoverview BakeFlow ERP — routes/settings.js
 */
'use strict';

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/',                    ctrl.getSettings);
router.put('/',                    ctrl.saveSettings);
router.get('/export',              ctrl.exportBackup);
router.post('/import-localStorage', ctrl.importLocalStorageBackup);

module.exports = router;
