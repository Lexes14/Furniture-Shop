const express = require('express');
const { body, param } = require('express-validator');
const reservationController = require('../controllers/reservation');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

router.use(authenticate);

router.get('/', reservationController.listReservations);
router.get(
    '/:id',
    [param('id').isInt().withMessage('Valid reservation id is required'), validateRequest],
    reservationController.getReservation
);
router.post(
    '/',
    [
        body('reservationDate').isDate().withMessage('Reservation date is required'),
        body('reservationTime').matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).withMessage('Valid reservation time is required'),
        validateRequest,
    ],
    reservationController.createReservation
);
router.put(
    '/:id',
    [param('id').isInt().withMessage('Valid reservation id is required'), validateRequest],
    reservationController.updateReservation
);
router.delete(
    '/:id',
    [param('id').isInt().withMessage('Valid reservation id is required'), validateRequest],
    reservationController.deleteReservation
);

router.patch(
    '/:id/status',
    authorizeRoles('admin'),
    [
        param('id').isInt().withMessage('Valid reservation id is required'),
        body('status').isIn(['pending', 'approved', 'cancelled', 'completed']).withMessage('Valid status is required'),
        validateRequest,
    ],
    reservationController.updateReservation
);

module.exports = router;