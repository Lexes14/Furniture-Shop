const express = require('express');
const pdfController = require('../controllers/pdf');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/orders/:id', pdfController.downloadOrderReceipt);
router.get('/reservations/:id', pdfController.downloadReservationReceipt);
router.get('/transactions/:id', pdfController.downloadTransactionReceipt);

module.exports = router;