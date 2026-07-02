const express = require('express');
const { body, param } = require('express-validator');
const inquiryController = require('../controllers/inquiry');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    validateRequest,
  ],
  inquiryController.createInquiry
);

router.use(authenticate);

router.get('/', inquiryController.listInquiries);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Valid inquiry id is required'), validateRequest],
  inquiryController.getInquiry
);
router.put(
  '/:id',
  [param('id').isInt().withMessage('Valid inquiry id is required'), validateRequest],
  inquiryController.updateInquiry
);
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Valid inquiry id is required'), validateRequest],
  inquiryController.deleteInquiry
);

router.patch(
  '/:id/reply',
  authorizeRoles('admin'),
  [
    param('id').isInt().withMessage('Valid inquiry id is required'),
    body('response').trim().notEmpty().withMessage('Response is required'),
    validateRequest,
  ],
  inquiryController.updateInquiry
);

module.exports = router;