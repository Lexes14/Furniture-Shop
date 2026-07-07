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

function computeGrandTotal(order) {
  const items = order.items || (order.get ? order.get('items') : []) || [];
  const itemsTotal = items.reduce((sum, orderItem) => {
    const quantity = Number(orderItem.quantity || 0);
    const price = Number(orderItem.price || 0);
    return sum + (quantity * price);
  }, 0);

  return Number((itemsTotal + Number(order.shippingFee || 0)).toFixed(2));
}

//ito ang taga build ng receipt data na gagamitin sa pag-generate ng PDF receipt at sa email notification
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

//ito ang function na nagha-handle ng pag-send ng email notification kapag nagbago ang status ng transaction.
async function safeNotifyTransactionStatus(notifyFn) {
  try {
    await notifyFn();
  } catch (notifyError) {
    // eslint-disable-next-line no-console
    console.error('[transaction notification] Failed to send status email/receipt:', notifyError.message);
  }
}

//ito ang function na nagha-handle ng pag-send ng email notification kapag nagbago ang status ng transaction at may kasamang PDF receipt.
async function sendFullReceiptNotification({ orderId, recipientEmail, title, message }) {
  const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');//ito ay nagse-set ng path kung saan ise-save ang mga PDF receipt
  await ensureNotificationDirectory(receiptsDir);//setup ng directory kung saan ise-save ang mga PDF receipt

  //fetch order kasama ang mga items at user details para sa email at PDF receipt
  const orderWithItems = await Order.findByPk(orderId, {
    include: [
      { model: OrderItem, as: 'items', include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }] },
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
    ],
  });

  //build the receipt data and generate the PDF receipt
  const receiptData = buildOrderReceiptData(orderWithItems);
  const receiptPath = await buildOrderReceiptPdf(receiptData, receiptsDir);

  await sendOrderReceiptEmail({
    to: recipientEmail,
    title,
    message,
    order: receiptData,
    attachments: [{ filename: `order-${orderWithItems.orderNumber}.pdf`, path: receiptPath }],
  });
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
      meta: { page, limit, total: count, pages: Math.ceil(count / limit) },
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

//ito ay para sa pag-consume ng reserved stock kapag nagbago ang status ng transaction sa 'paid', para hindi ma-overbook ang stock ng item
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
  const dbTransaction = await sequelize.transaction();//ito ay nagsesetup ng db transac para sa create transaction
  try {
    const { orderId, amount, paymentMethod, remarks, status = 'pending', receiptPath = null } = req.body;//kinukuha lang ang mga data na galing sa request body

    // Check if the order exists and belongs to the user (if not admin)
    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Item, as: 'item' }] }],
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    //dito niyo kino-compare kung may order ba na may ganitong orderId, kung wala, magro-rollback sa transaction at magre-return ng 400 error
    if (!order) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Order not found' });
    }

    //dito niyo kino-compare kung ang user na nagre-request ay admin o hindi, kung hindi admin, kino-compare niyo kung ang order ay pag-aari 
    // ng user na nagre-request, kung hindi, magro-rollback sa transaction at magre-return ng 403 error
    if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
      await dbTransaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if a transaction already exists for this order
    const existingTransaction = await Transaction.findOne({ where: { orderId }, transaction: dbTransaction });
    if (existingTransaction) {
      await dbTransaction.rollback();
      return res.status(409).json({ success: false, message: 'Transaction already exists for this order' });
    }

    // Create the transaction record
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

    // If the transaction is marked as 'paid', consume the reserved stock and update the order status to 'approved'
    if (status === 'paid') {
      await consumeReservedStock(order.items, dbTransaction);
      order.status = 'approved';
      await order.save({ transaction: dbTransaction });
    }

    await dbTransaction.commit();

    const createdTransaction = await Transaction.findByPk(transactionRecord.id, { include: transactionIncludes() });

    if (createdTransaction?.user?.email && createdTransaction.status === 'paid') {
      await safeNotifyTransactionStatus(async () => {
        await sendFullReceiptNotification({
          orderId: order.id,
          recipientEmail: createdTransaction.user.email,
          title: 'Payment received',
          message: `Your payment for order ${order.orderNumber} has been received.`,
        });
      });
    }

    return res.status(201).json({ success: true, message: 'Transaction created successfully', data: createdTransaction });
  } catch (error) {
    await dbTransaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to create transaction', error: error.message });
  }
}

// This function updates an existing transaction and handles stock adjustments and email notifications based on status changes.
async function updateTransaction(req, res) {
  const dbTransaction = await sequelize.transaction();//ito ay nagsesetup ng db transac para sa update transaction
  try {
    const transactionRecord = await Transaction.findByPk(req.params.id, {
      include: transactionIncludes(),
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    //kapag walang transaction record na may ganitong id, magro-rollback sa transaction at magre-return ng 404 error
    if (!transactionRecord) {
      await dbTransaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    //check kung ang user na nagre-request ay admin o hindi, kung hindi admin, kino-compare niya kung ang transaction ay pag-aari
    if (req.user?.role !== 'admin' && transactionRecord.userId !== req.user?.id) {
      await dbTransaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { amount, paymentMethod, status, receiptPath, remarks } = req.body;//kinukuha lang ang mga data na galing sa request body
    const previousStatus = transactionRecord.status;//ito ay nagse-set ng previous status ng transaction bago i-update

    //kapag mayroong bagong value para sa amount, paymentMethod, receiptPath, at remarks, i-update ang transaction record
    if (amount !== undefined) transactionRecord.amount = amount;
    if (paymentMethod !== undefined) transactionRecord.paymentMethod = paymentMethod;
    if (receiptPath !== undefined) transactionRecord.receiptPath = receiptPath;
    if (remarks !== undefined) transactionRecord.remarks = remarks;

    if (status !== undefined) {
      transactionRecord.status = status;
      //kapag ang user ay hindi admin at ang bagong status ay hindi 'pending', i-rollback ang transaction at magre-return ng 403 error
      if (req.user?.role !== 'admin' && status !== 'pending') {
        await dbTransaction.rollback();
        return res.status(403).json({ success: false, message: 'Only admins can finalize payments' });
      }
    }

    await transactionRecord.save({ transaction: dbTransaction });//ito ay nagse-save ng updated transaction record sa database

    // Check if the order exists and fetch its items for stock adjustments
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

    await dbTransaction.commit();//ito ay nagco-commit ng transaction sa database, ibig sabihin lahat ng changes ay mase-save na sa database

    const updatedTransaction = await Transaction.findByPk(transactionRecord.id, { include: transactionIncludes() });
    const statusChanged = status && status !== previousStatus;

    // whenever an UPDATE causes the transaction to become
    // 'paid' or 'refunded', send the SAME full itemized receipt email (with
    // PDF attached) that createTransaction() already sends — not just a
    // plain text message. Runs AFTER commit(), wrapped so a failed email
    // never causes the API to report the update itself as failed.
    if (updatedTransaction?.user?.email && statusChanged) {
      if (status === 'paid') {
        await safeNotifyTransactionStatus(async () => {
          await sendFullReceiptNotification({
            orderId: order.id,
            recipientEmail: updatedTransaction.user.email,
            title: 'Payment received',
            message: `Your payment for order ${updatedTransaction.order?.orderNumber || order.orderNumber} has been received.`,
          });
        });
      } else if (status === 'refunded') {
        await safeNotifyTransactionStatus(async () => {
          await sendFullReceiptNotification({
            orderId: order.id,
            recipientEmail: updatedTransaction.user.email,
            title: 'Payment refunded',
            message: `Your payment for order ${updatedTransaction.order?.orderNumber || order.orderNumber} has been refunded. Please keep this receipt for your records.`,
          });
        });
      } else if (status === 'failed') {
        await safeNotifyTransactionStatus(async () => {
          await sendStatusEmail({
            to: updatedTransaction.user.email,
            title: 'Payment failed',
            message: `Your payment for order ${updatedTransaction.order?.orderNumber || order.orderNumber} could not be processed. Please try again or contact support.`,
          });
        });
      }
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