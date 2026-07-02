const express = require('express');
const { body, param } = require('express-validator');
const stockController = require('../controllers/stock');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', stockController.listStocks);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid stock id is required'), validateRequest],
  stockController.getStock
);
router.post(
  '/',
  [
    body('itemId').isInt().withMessage('Item is required'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a valid number'),
    body('reservedQuantity').optional().isInt({ min: 0 }).withMessage('Reserved quantity must be a valid number'),
    body('lowStockLevel').optional().isInt({ min: 0 }).withMessage('Low stock level must be a valid number'),
    validateRequest,
  ],
  stockController.createStock
);
router.put(
  '/:id',
  [param('id').isInt().withMessage('Valid stock id is required'), validateRequest],
  stockController.updateStock
);
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Valid stock id is required'), validateRequest],
  stockController.deleteStock
);

module.exports = router;