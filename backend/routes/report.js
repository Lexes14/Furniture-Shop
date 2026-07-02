const express = require('express');
const reportController = require('../controllers/report');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/overview', reportController.overview);
router.get('/daily-sales', reportController.dailySales);
router.get('/monthly-sales', reportController.monthlySales);
router.get('/yearly-sales', reportController.yearlySales);
router.get('/best-selling-products', reportController.bestSellingProducts);
router.get('/best-selling-categories', reportController.bestSellingCategories);
router.get('/inventory', reportController.inventoryReport);
router.get('/transactions', reportController.transactionsReport);

module.exports = router;