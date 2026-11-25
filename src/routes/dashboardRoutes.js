const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/stats', DashboardController.getStats);

module.exports = router;
