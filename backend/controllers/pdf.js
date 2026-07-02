const fs = require('fs');
const path = require('path');
const { Order, OrderItem, Transaction, Reservation, Item, Category, User } = require('../models');
const { generateReceiptPDF } = require('../utils/generatePDF');
const { ensureNotificationDirectory } = require('../utils/notificationFiles');

function receiptsDirectory() {
  return path.join(__dirname, '..', 'uploads', 'receipts');
}

async function safeDownload(res, filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'PDF file not found' });
  }

  return res.download(filePath, fileName);
}

function isOwnerOrAdmin(req, ownerId) {
  return req.user?.role === 'admin' || req.user?.id === ownerId;
}

// subtotal/grandTotal are no longer stored columns on `orders` — this computes
// them the same way controllers/order.js does (SUM of order_items quantity*price,
// plus shippingFee), kept local to this file since it fetches the order directly
// via Order.findByPk rather than going through the order controller.
function computeOrderTotals(order) {
  const items = order.items || [];
  const itemsTotal = items.reduce((sum, orderItem) => {
    const quantity = Number(orderItem.quantity || 0);
    const price = Number(orderItem.price || 0);
    return sum + (quantity * price);
  }, 0);

  const shippingFee = Number(order.shippingFee || 0);
  const grandTotal = itemsTotal + shippingFee;

  return {
    subtotal: Number(itemsTotal.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}

function formatMoney(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

async function buildOrderPdf(order) {
  const filePath = path.join(receiptsDirectory(), `order-${order.orderNumber}.pdf`);
  await ensureNotificationDirectory(receiptsDirectory());

  const { subtotal, grandTotal } = computeOrderTotals(order);

  const details = [
    { label: 'Order Number', value: order.orderNumber },
    { label: 'Customer', value: order.user?.name || 'N/A' },
    { label: 'Email', value: order.user?.email || 'N/A' },
    { label: 'Status', value: order.status },
    { label: 'Payment Method', value: order.paymentMethod || 'N/A' },
    { label: 'Shipping Address', value: order.shippingAddress || 'N/A' },
  ];

  const items = (order.items || []).map((orderItem) => ({
    name: orderItem.item?.name || 'Item',
    quantity: orderItem.quantity,
    price: Number(orderItem.price || 0),
    subtotal: Number(orderItem.subtotal || 0),
  }));

  const summary = [
    { label: 'Subtotal', value: formatMoney(subtotal) },
    { label: 'Shipping Fee', value: formatMoney(order.shippingFee) },
    { label: 'Grand Total', value: formatMoney(grandTotal) },
  ];

  await generateReceiptPDF({
    filePath,
    title: 'Order Receipt',
    details,
    items,
    summary,
  });

  return filePath;
}

async function buildReservationPdf(reservation) {
  const filePath = path.join(receiptsDirectory(), `reservation-${reservation.reservationNumber}.pdf`);
  await ensureNotificationDirectory(receiptsDirectory());

  const details = [
    { label: 'Reservation Number', value: reservation.reservationNumber },
    { label: 'Customer', value: reservation.user?.name || 'N/A' },
    { label: 'Email', value: reservation.user?.email || 'N/A' },
    { label: 'Status', value: reservation.status },
    { label: 'Reservation Date', value: reservation.reservationDate },
    { label: 'Reservation Time', value: reservation.reservationTime },
    { label: 'Item', value: reservation.item?.name || 'N/A' },
    { label: 'Category', value: reservation.item?.category?.name || 'N/A' },
  ];

  await generateReceiptPDF({
    filePath,
    title: 'Reservation Receipt',
    details,
    summary: [],
  });

  return filePath;
}

async function buildTransactionPdf(transactionRecord) {
  const filePath = path.join(receiptsDirectory(), `transaction-${transactionRecord.transactionNumber}.pdf`);
  await ensureNotificationDirectory(receiptsDirectory());

  const details = [
    { label: 'Transaction Number', value: transactionRecord.transactionNumber },
    { label: 'Order Number', value: transactionRecord.order?.orderNumber || 'N/A' },
    { label: 'Customer', value: transactionRecord.user?.name || 'N/A' },
    { label: 'Email', value: transactionRecord.user?.email || 'N/A' },
    { label: 'Payment Method', value: transactionRecord.paymentMethod },
    { label: 'Status', value: transactionRecord.status },
    { label: 'Remarks', value: transactionRecord.remarks || 'N/A' },
  ];

  const summary = [
    { label: 'Amount', value: formatMoney(transactionRecord.amount) },
  ];

  await generateReceiptPDF({
    filePath,
    title: 'Transaction Receipt',
    details,
    summary,
  });

  return filePath;
}

async function downloadOrderReceipt(req, res) {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: OrderItem, as: 'items', include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }] },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!isOwnerOrAdmin(req, order.userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filePath = await buildOrderPdf(order);
    return safeDownload(res, filePath, `order-${order.orderNumber}.pdf`);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate order PDF', error: error.message });
  }
}

async function downloadReservationReceipt(req, res) {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: Item, as: 'item', required: false, include: [{ model: Category, as: 'category', required: false }] },
      ],
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (!isOwnerOrAdmin(req, reservation.userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filePath = await buildReservationPdf(reservation);
    return safeDownload(res, filePath, `reservation-${reservation.reservationNumber}.pdf`);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate reservation PDF', error: error.message });
  }
}

async function downloadTransactionReceipt(req, res) {
  try {
    const transactionRecord = await Transaction.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: Order, as: 'order', include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }] },
      ],
    });

    if (!transactionRecord) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (!isOwnerOrAdmin(req, transactionRecord.userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filePath = await buildTransactionPdf(transactionRecord);
    return safeDownload(res, filePath, `transaction-${transactionRecord.transactionNumber}.pdf`);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate transaction PDF', error: error.message });
  }
}

module.exports = {
  downloadOrderReceipt,
  downloadReservationReceipt,
  downloadTransactionReceipt,
};