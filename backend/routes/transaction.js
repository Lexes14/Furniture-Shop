const express = require('express');
const { body, param } = require('express-validator');
const transactionController = require('../controllers/transaction');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate);

router.get('/', transactionController.listTransactions);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid transaction id is required'), validateRequest],
  transactionController.getTransaction
);
router.post(
  '/',
  [
    body('orderId').isInt().withMessage('Order is required'),
    body('paymentMethod').trim().notEmpty().withMessage('Payment method is required'),
    validateRequest,
  ],
  transactionController.createTransaction
);
router.put(
  '/:id',
  [param('id').isInt().withMessage('Valid transaction id is required'), validateRequest],
  transactionController.updateTransaction
);
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Valid transaction id is required'), validateRequest],
  transactionController.deleteTransaction
);
router.patch(
  '/:id/status',
  authorizeRoles('admin'),
  [
    param('id').isInt().withMessage('Valid transaction id is required'),
    body('status').isIn(['pending', 'paid', 'failed', 'refunded']).withMessage('Valid status is required'),
    validateRequest,
  ],
  transactionController.updateTransaction
);

module.exports = router;