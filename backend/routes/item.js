const express = require('express');
const { body, param } = require('express-validator');
const itemController = require('../controllers/item');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');
const { productUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/', itemController.listItems); //kukunin lahat ng items
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.getItem
); //kukunin ang item na may specific id

//ang route na ito ay para sa pag-create ng bagong item, na may authentication at 
// authorization para sa admin role, pati na rin ang pag-upload ng images gamit ang multer
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

//ang route na ito ay para sa pag-update ng item na may specific id, 
// na may authentication at authorization para sa admin role, pati na rin ang pag-upload ng images gamit ang multer
router.put(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  productUpload.array('images', 10),
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.updateItem
);

//ang route na ito ay para sa pag-delete ng item na may specific id,
// na may authentication at authorization para sa admin role
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  [param('id').isInt().withMessage('Valid item id is required'), validateRequest],
  itemController.deleteItem
);

//ang module.exports ay nag-e-export ng router para magamit sa ibang bahagi ng application
module.exports = router;
