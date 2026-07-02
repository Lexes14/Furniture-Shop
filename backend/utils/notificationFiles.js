const fs = require('fs');
const path = require('path');
const { generateReceiptPDF } = require('./generatePDF');

async function buildOrderReceiptPdf(order, directoryPath) {
  const filePath = path.join(directoryPath, `order-${order.orderNumber}.pdf`);

  const details = [
    { label: 'Order Number', value: order.orderNumber },
    { label: 'Customer', value: order.user?.name || 'Customer' },
    { label: 'Email', value: order.user?.email || 'N/A' },
    { label: 'Status', value: order.status },
    { label: 'Payment Method', value: order.paymentMethod || 'N/A' },
    { label: 'Shipping Address', value: order.shippingAddress || 'N/A' },
  ];

  const items = (order.items || []).map((orderItem) => ({
    name: orderItem.item?.name || 'Item',
    quantity: orderItem.quantity,
    price: Number(orderItem.price || 0),
    subtotal: Number(orderItem.subtotal ?? (orderItem.quantity * orderItem.price)) || 0,
  }));

  const summary = [
    { label: 'Subtotal', value: `PHP ${Number(order.subtotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { label: 'Shipping Fee', value: `PHP ${Number(order.shippingFee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { label: 'Grand Total', value: `PHP ${Number(order.grandTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
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

async function buildReservationReceiptPdf(reservation, directoryPath) {
  const filePath = path.join(directoryPath, `reservation-${reservation.reservationNumber}.pdf`);
  const details = [
    { label: 'Reservation Number', value: reservation.reservationNumber },
    { label: 'Customer', value: reservation.user?.name || 'Customer' },
    { label: 'Email', value: reservation.user?.email || 'N/A' },
    { label: 'Status', value: reservation.status },
    { label: 'Reservation Date', value: reservation.reservationDate },
    { label: 'Reservation Time', value: reservation.reservationTime },
    { label: 'Item', value: reservation.item?.name || 'N/A' },
  ];

  await generateReceiptPDF({
    filePath,
    title: 'Reservation Receipt',
    details,
    summary: [],
  });

  return filePath;
}

async function ensureNotificationDirectory(directoryPath) {
  await fs.promises.mkdir(directoryPath, { recursive: true });
}

module.exports = {
  buildOrderReceiptPdf,
  buildReservationReceiptPdf,
  ensureNotificationDirectory,
};