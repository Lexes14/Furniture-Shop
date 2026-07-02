const express = require('express');
const { body, param } = require('express-validator');
const categoryController = require('../controllers/category');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.get('/', categoryController.listCategories);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid category id is required'), validateRequest],
  categoryController.getCategory
);

router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  [body('name').trim().notEmpty().withMessage('Name is required'), validateRequest],
  categoryController.createCategory
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  [param('id').isInt().withMessage('Valid category id is required'), validateRequest],
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  [param('id').isInt().withMessage('Valid category id is required'), validateRequest],
  categoryController.deleteCategory
);

module.exports = router;