const express = require('express');
const { body, param } = require('express-validator');
const itemController = require('../controllers/item');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');
const { productUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/', itemController.listItems);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.getItem
);

router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  productUpload.array('images', 10),
  [
    body('categoryId').isInt().withMessage('Category is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('sku').trim().notEmpty().withMessage('SKU is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a valid number'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a valid number'),
    validateRequest,
  ],
  itemController.createItem
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  productUpload.array('images', 10),
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.updateItem
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.deleteItem
);

module.exports = router;