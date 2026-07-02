const express = require('express');
const { body, param } = require('express-validator');
const orderController = require('../controllers/order');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate);

router.get('/', orderController.listOrders);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid order id is required'), validateRequest],
  orderController.getOrder
);
router.post(
  '/',
  [
    body('shippingAddress').trim().notEmpty().withMessage('Shipping address is required'),
    body('paymentMethod').optional().trim().notEmpty().withMessage('Payment method is required'),
    validateRequest,
  ],
  orderController.createOrder
);
router.put(
  '/:id',
  [param('id').isInt().withMessage('Valid order id is required'), validateRequest],
  orderController.updateOrder
);
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Valid order id is required'), validateRequest],
  orderController.deleteOrder
);
router.patch(
  '/:id/status',
  authorizeRoles('admin'),
  [
    param('id').isInt().withMessage('Valid order id is required'),
    body('status').isIn(['pending', 'approved', 'cancelled', 'delivered']).withMessage('Valid status is required'),
    validateRequest,
  ],
  orderController.updateOrder
);

module.exports = router;