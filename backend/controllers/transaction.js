const { Op } = require('sequelize');
const { sequelize, Transaction, Order, OrderItem, Item, Category, Stock, User } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');
const { sendStatusEmail, sendOrderReceiptEmail } = require('../utils/email');
const { buildOrderReceiptPdf, ensureNotificationDirectory } = require('../utils/notificationFiles');
const path = require('path');

function generateTransactionNumber() {
  return `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function transactionIncludes() {
  return [
    { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
    {
      model: Order,
      as: 'order',
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
      }],
    },
  ];
}

// Same computation logic as controllers/order.js — kept as a local duplicate
// to match this codebase's existing convention (see consumeReservedStock,
// which is also duplicated between order.js and transaction.js).
function computeGrandTotal(order) {
  const items = order.items || (order.get ? order.get('items') : []) || [];
  const itemsTotal = items.reduce((sum, orderItem) => {
    const quantity = Number(orderItem.quantity || 0);
    const price = Number(orderItem.price || 0);
    return sum + (quantity * price);
  }, 0);

  return Number((itemsTotal + Number(order.shippingFee || 0)).toFixed(2));
}

// Builds the same flat item/totals object shape as order.js's
// buildOrderReceiptData(), used for both the PDF and the email table.
function buildOrderReceiptData(order) {
  const grandTotal = computeGrandTotal(order);
  const shippingFee = Number(order.shippingFee || 0);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    shippingAddress: order.shippingAddress,
    shippingFee,
    subtotal: Number((grandTotal - shippingFee).toFixed(2)),
    grandTotal,
    user: order.user ? { name: order.user.name, email: order.user.email } : null,
    items: (order.items || []).map((orderItem) => ({
      name: orderItem.item?.name || 'Item',
      quantity: orderItem.quantity,
      price: Number(orderItem.price || 0),
      subtotal: Number(orderItem.quantity || 0) * Number(orderItem.price || 0),
    })),
  };
}

// Wraps a notification step so a failure here never cascades into the outer
// catch block and tries to roll back an already-committed transaction.
async function safeNotifyTransactionStatus(notifyFn) {
  try {
    await notifyFn();
  } catch (notifyError) {
    // eslint-disable-next-line no-console
    console.error('[transaction notification] Failed to send status email/receipt:', notifyError.message);
  }
}

async function listTransactions(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { status, paymentMethod } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { transactionNumber: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
        { '$order.orderNumber$': { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    if (req.user?.role !== 'admin') {
      where.userId = req.user?.id;
    }

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: transactionIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
  }
}

async function getTransaction(req, res) {
  try {
    const transaction = await Transaction.findByPk(req.params.id, { include: transactionIncludes() });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (req.user?.role !== 'admin' && transaction.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch transaction', error: error.message });
  }
}

async function consumeReservedStock(orderItems, transaction) {
  for (const orderItem of orderItems) {
    await Stock.decrement('reservedQuantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
    await Stock.decrement('quantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
  }
}

async function restoreConsumedStock(orderItems, transaction) {
  for (const orderItem of orderItems) {
    await Stock.increment('quantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
  }
}

async function createTransaction(req, res) {
  const dbTransaction = await sequelize.transaction();
  try {
    const { orderId, amount, paymentMethod, remarks, status = 'pending', receiptPath = null } = req.body;

    const order = await Order.findByPk(orderId, {
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{ model: Item, as: 'item' }],
      }],
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!order) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
      await dbTransaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingTransaction = await Transaction.findOne({ where: { orderId }, transaction: dbTransaction });
    if (existingTransaction) {
      await dbTransaction.rollback();
      return res.status(409).json({ success: false, message: 'Transaction already exists for this order' });
    }

    const transactionRecord = await Transaction.create({
      transactionNumber: generateTransactionNumber(),
      orderId,
      userId: order.userId,
      amount: amount ?? computeGrandTotal(order),
      paymentMethod: paymentMethod || order.paymentMethod || 'cash_on_delivery',
      status,
      receiptPath,
      remarks: remarks || null,
    }, { transaction: dbTransaction });

    if (status === 'paid') {
      await consumeReservedStock(order.items, dbTransaction);
      order.status = 'approved';
      await order.save({ transaction: dbTransaction });
    }

    await dbTransaction.commit();

    const createdTransaction = await Transaction.findByPk(transactionRecord.id, { include: transactionIncludes() });

    // Runs after commit() — wrapped so a failure here can't trigger a
    // rollback of an already-committed transaction.
    if (createdTransaction?.user?.email && createdTransaction.status === 'paid') {
      await safeNotifyTransactionStatus(async () => {
        const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        await ensureNotificationDirectory(receiptsDir);
        const orderWithItems = await Order.findByPk(order.id, {
          include: [
            { model: OrderItem, as: 'items', include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }] },
            { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
          ],
        });

        const receiptData = buildOrderReceiptData(orderWithItems);
        const receiptPath = await buildOrderReceiptPdf(receiptData, receiptsDir);

        await sendOrderReceiptEmail({
          to: createdTransaction.user.email,
          title: 'Payment received',
          message: `Your payment for order ${order.orderNumber} has been received.`,
          order: receiptData,
          attachments: [{ filename: `order-${order.orderNumber}.pdf`, path: receiptPath }],
        });
      });
    }

    return res.status(201).json({ success: true, message: 'Transaction created successfully', data: createdTransaction });
  } catch (error) {
    await dbTransaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to create transaction', error: error.message });
  }
}

async function updateTransaction(req, res) {
  const dbTransaction = await sequelize.transaction();
  try {
    const transactionRecord = await Transaction.findByPk(req.params.id, {
      include: transactionIncludes(),
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!transactionRecord) {
      await dbTransaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (req.user?.role !== 'admin' && transactionRecord.userId !== req.user?.id) {
      await dbTransaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { amount, paymentMethod, status, receiptPath, remarks } = req.body;
    const previousStatus = transactionRecord.status;

    if (amount !== undefined) transactionRecord.amount = amount;
    if (paymentMethod !== undefined) transactionRecord.paymentMethod = paymentMethod;
    if (receiptPath !== undefined) transactionRecord.receiptPath = receiptPath;
    if (remarks !== undefined) transactionRecord.remarks = remarks;

    if (status !== undefined) {
      transactionRecord.status = status;
      if (req.user?.role !== 'admin' && status !== 'pending') {
        await dbTransaction.rollback();
        return res.status(403).json({ success: false, message: 'Only admins can finalize payments' });
      }
    }

    await transactionRecord.save({ transaction: dbTransaction });

    const order = await Order.findByPk(transactionRecord.orderId, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (status && status !== previousStatus) {
      if (status === 'paid') {
        await consumeReservedStock(order.items, dbTransaction);
        order.status = 'approved';
        await order.save({ transaction: dbTransaction });
      }

      if (status === 'refunded' && previousStatus === 'paid') {
        await restoreConsumedStock(order.items, dbTransaction);
        order.status = 'cancelled';
        await order.save({ transaction: dbTransaction });
      }

      if (status === 'failed' && previousStatus === 'pending') {
        order.status = 'cancelled';
        await order.save({ transaction: dbTransaction });
      }
    }

    await dbTransaction.commit();

    const updatedTransaction = await Transaction.findByPk(transactionRecord.id, { include: transactionIncludes() });

    // Refund notification stays as a simple status email — no itemized
    // table needed here since the order has already been reverted.
    if (updatedTransaction?.user?.email && status && status !== previousStatus && status === 'refunded') {
      await safeNotifyTransactionStatus(async () => {
        await sendStatusEmail({
          to: updatedTransaction.user.email,
          title: 'Payment refunded',
          message: `Your payment for order ${updatedTransaction.order?.orderNumber || updatedTransaction.orderId} has been refunded. Please keep this email for your records.`,
        });
      });
    }

    return res.status(200).json({ success: true, message: 'Transaction updated successfully', data: updatedTransaction });
  } catch (error) {
    await dbTransaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to update transaction', error: error.message });
  }
}

async function deleteTransaction(req, res) {
  const dbTransaction = await sequelize.transaction();
  try {
    const transactionRecord = await Transaction.findByPk(req.params.id, {
      include: transactionIncludes(),
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!transactionRecord) {
      await dbTransaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (req.user?.role !== 'admin' && transactionRecord.userId !== req.user?.id) {
      await dbTransaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (transactionRecord.status === 'paid') {
      const order = await Order.findByPk(transactionRecord.orderId, {
        include: [{ model: OrderItem, as: 'items' }],
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE,
      });

      await restoreConsumedStock(order.items, dbTransaction);
      order.status = 'cancelled';
      await order.save({ transaction: dbTransaction });
    }

    await transactionRecord.destroy({ transaction: dbTransaction });
    await dbTransaction.commit();

    return res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    await dbTransaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to delete transaction', error: error.message });
  }
}

module.exports = {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};