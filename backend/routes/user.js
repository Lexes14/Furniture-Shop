const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/user');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.get('/', userController.listUsers);
router.get(
    '/:id',
    [param('id').isInt().withMessage('Valid user id is required'), validateRequest],
    userController.getUser
);
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').trim().isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        validateRequest,
    ],
    userController.createUser
);
router.put(
    '/:id',
    [param('id').isInt().withMessage('Valid user id is required'), validateRequest],
    userController.updateUser
);
router.patch(
    '/:id/role',
    [
        param('id').isInt().withMessage('Valid user id is required'),
        body('role').isIn(['admin', 'customer']).withMessage('Role must be admin or customer'),
        validateRequest,
    ],
    userController.updateRole
);
router.patch(
    '/:id/deactivate',
    [param('id').isInt().withMessage('Valid user id is required'), validateRequest],
    userController.deactivateUser
);
router.patch(
    '/:id/activate',
    [param('id').isInt().withMessage('Valid user id is required'), validateRequest],
    userController.activateUser
);
router.delete(
    '/:id',
    [param('id').isInt().withMessage('Valid user id is required'), validateRequest],
    userController.deleteUser
);

module.exports = router;