const express = require('express');
const { body, param } = require('express-validator');
const cartController = require('../controllers/cart');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate);

router.get('/', cartController.getCart);
router.post(
  '/items',
  [
    body('itemId').isInt().withMessage('Item is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validateRequest,
  ],
  cartController.addItem
);
router.put(
  '/items/:id',
  [
    param('id').isInt().withMessage('Valid cart item id is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validateRequest,
  ],
  cartController.updateItem
);
router.delete(
  '/items/:id',
  [param('id').isInt().withMessage('Valid cart item id is required'), validateRequest],
  cartController.removeItem
);
router.delete('/clear', cartController.clearCart);

module.exports = router;