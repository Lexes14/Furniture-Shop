const express = require('express');
const chartController = require('../controllers/chart');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/sales-bar', chartController.salesBar);
router.get('/sales-line', chartController.salesLine);
router.get('/category-pie', chartController.categoryPie);
router.get('/product-bar', chartController.productBar);
router.get('/inventory-bar', chartController.inventoryBar);

module.exports = router;