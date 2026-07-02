const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, Cart, CartItem, Item, Stock, Category, User } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');
const { sendOrderReceiptEmail } = require('../utils/email');
const { buildOrderReceiptPdf, ensureNotificationDirectory } = require('../utils/notificationFiles');
const path = require('path');

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function orderIncludes() {
  return [
    { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
    {
      model: OrderItem,
      as: 'items',
      include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
    },
  ];
}

// Computes subtotal/grandTotal on the fly from order.items (quantity x price)
// and attaches them to the Sequelize instance so API responses keep the exact
// same shape as before (data.subtotal / data.grandTotal still present),
// even though these are no longer stored columns.
function computeOrderTotals(order) {
  if (!order) {
    return order;
  }

  const items = order.items || (order.get ? order.get('items') : []) || [];
  const itemsTotal = items.reduce((sum, orderItem) => {
    const quantity = Number(orderItem.quantity || 0);
    const price = Number(orderItem.price || 0);
    return sum + (quantity * price);
  }, 0);

  const shippingFee = Number(order.shippingFee || 0);
  const grandTotal = itemsTotal + shippingFee;

  if (order.setDataValue) {
    order.setDataValue('subtotal', Number(itemsTotal.toFixed(2)));
    order.setDataValue('grandTotal', Number(grandTotal.toFixed(2)));
  }

  return order;
}

function attachOrderTotals(orders) {
  const rows = Array.isArray(orders) ? orders : [orders];
  rows.forEach((order) => computeOrderTotals(order));
  return orders;
}

// Builds the flat item list + totals object consumed by sendOrderReceiptEmail
// and buildOrderReceiptPdf — kept as a plain object so it can be reused for
// both an email HTML table and a PDF table without re-querying anything.
function buildOrderReceiptData(order) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    shippingAddress: order.shippingAddress,
    shippingFee: Number(order.shippingFee || 0),
    subtotal: Number(order.get('subtotal') || 0),
    grandTotal: Number(order.get('grandTotal') || 0),
    user: order.user ? { name: order.user.name, email: order.user.email } : null,
    items: (order.items || []).map((orderItem) => ({
      name: orderItem.item?.name || 'Item',
      quantity: orderItem.quantity,
      price: Number(orderItem.price || 0),
      subtotal: Number(orderItem.subtotal || 0),
    })),
  };
}

// Wraps a notification step (email + PDF receipt) so that a failure here
// NEVER cascades into the main transaction's catch block — the DB transaction
// is already committed by the time notifications run, so attempting to
// rollback it again would throw a second, more confusing error and mask
// the fact that the actual order operation succeeded.
async function safeNotifyOrderStatus(notifyFn) {
  try {
    await notifyFn();
  } catch (notifyError) {
    // eslint-disable-next-line no-console
    console.error('[order notification] Failed to send status email/receipt:', notifyError.message);
  }
}

async function listOrders(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { status } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { shippingAddress: { [Op.like]: `%${search}%` } },
        { paymentMethod: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (req.user?.role !== 'admin') {
      where.userId = req.user?.id;
    }

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: orderIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
    });

    attachOrderTotals(rows);

    return res.status(200).json({ success: true, data: rows, meta: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
}

async function getOrder(req, res) {
  try {
    const order = await Order.findByPk(req.params.id, { include: orderIncludes() });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    computeOrderTotals(order);

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch order', error: error.message });
  }
}

async function reserveStockForOrder(orderItems, transaction) {
  for (const orderItem of orderItems) {
    await Stock.increment('reservedQuantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
  }
}

async function releaseReservedStock(orderItems, transaction) {
  for (const orderItem of orderItems) {
    await Stock.decrement('reservedQuantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
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

async function restoreSoldStock(orderItems, transaction) {
  for (const orderItem of orderItems) {
    await Stock.increment('quantity', {
      by: Number(orderItem.quantity),
      where: { itemId: orderItem.itemId },
      transaction,
    });
  }
}

async function createOrder(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { shippingAddress, paymentMethod = 'cash_on_delivery', notes = null } = req.body;

    const cart = await Cart.findOne({
      where: { userId: req.user.id },
      include: [{ model: CartItem, as: 'items', include: [{ model: Item, as: 'item' }] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cart || cart.items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    for (const cartItem of cart.items) {
      const stock = await Stock.findOne({ where: { itemId: cartItem.itemId }, transaction, lock: transaction.LOCK.UPDATE });
      const availableQuantity = Number(stock?.quantity || 0) - Number(stock?.reservedQuantity || 0);
      if (availableQuantity < Number(cartItem.quantity)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Insufficient stock for item ${cartItem.item?.name || cartItem.itemId}` });
      }
    }

    // subtotal/grandTotal are computed here only to decide the shipping fee
    // threshold — they are NOT stored on the order record anymore.
    const subtotal = cart.items.reduce((sum, cartItem) => sum + Number(cartItem.subtotal), 0);
    const shippingFee = subtotal >= 50000 ? 0 : 500;

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: req.user.id,
      status: 'pending',
      shippingFee,
      paymentMethod,
      shippingAddress,
      notes,
    }, { transaction });

    for (const cartItem of cart.items) {
      await OrderItem.create({
        orderId: order.id,
        itemId: cartItem.itemId,
        quantity: cartItem.quantity,
        price: cartItem.unitPrice,
      }, { transaction });
    }

    await reserveStockForOrder(cart.items, transaction);
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await cart.update({ status: 'converted' }, { transaction });

    await transaction.commit();

    const createdOrder = await Order.findByPk(order.id, { include: orderIncludes() });
    computeOrderTotals(createdOrder);

    return res.status(201).json({ success: true, message: 'Order created successfully', data: createdOrder });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
  }
}

async function updateOrder(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { include: orderIncludes(), transaction, lock: transaction.LOCK.UPDATE });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { shippingAddress, paymentMethod, notes, status } = req.body;
    const originalStatus = order.status;

    if (shippingAddress !== undefined) order.shippingAddress = shippingAddress;
    if (paymentMethod !== undefined) order.paymentMethod = paymentMethod;
    if (notes !== undefined) order.notes = notes;

    if (status !== undefined) {
      if (req.user?.role !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Only admins can update order status' });
      }
      order.status = status;
    }

    await order.save({ transaction });

    if (status && status !== originalStatus) {
      if (originalStatus === 'pending' && status === 'cancelled') {
        await releaseReservedStock(order.items, transaction);
      }
      if (originalStatus === 'pending' && (status === 'approved' || status === 'delivered')) {
        await consumeReservedStock(order.items, transaction);
      }
      if ((originalStatus === 'approved' || originalStatus === 'delivered') && status === 'cancelled') {
        await restoreSoldStock(order.items, transaction);
      }
    }

    await transaction.commit();

    const updatedOrder = await Order.findByPk(order.id, { include: orderIncludes() });
    computeOrderTotals(updatedOrder);

    // Runs AFTER transaction.commit() — wrapped in safeNotifyOrderStatus()
    // so a failure here is logged, not surfaced as a failed API response.
    const shouldNotify = status && status !== originalStatus && ['approved', 'cancelled', 'delivered'].includes(status);
    if (shouldNotify && updatedOrder?.user?.email) {
      await safeNotifyOrderStatus(async () => {
        const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        await ensureNotificationDirectory(receiptsDir);
        const receiptData = buildOrderReceiptData(updatedOrder);
        const receiptPath = await buildOrderReceiptPdf(receiptData, receiptsDir);
        const attachmentName = `order-${updatedOrder.orderNumber}.pdf`;

        await sendOrderReceiptEmail({
          to: updatedOrder.user.email,
          title: `Order ${status}`,
          message: `Your order ${updatedOrder.orderNumber} has been ${status}.`,
          order: receiptData,
          attachments: [{ filename: attachmentName, path: receiptPath }],
        });
      });
    }

    return res.status(200).json({ success: true, message: 'Order updated successfully', data: updatedOrder });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
  }
}

async function deleteOrder(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { include: orderIncludes(), transaction, lock: transaction.LOCK.UPDATE });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role !== 'admin' && order.userId !== req.user?.id) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (order.status === 'pending') {
      await releaseReservedStock(order.items, transaction);
    } else if (order.status === 'approved' || order.status === 'delivered') {
      await restoreSoldStock(order.items, transaction);
    }

    computeOrderTotals(order);
    const receiptData = buildOrderReceiptData(order);

    await order.destroy({ transaction });
    await transaction.commit();

    // Runs AFTER commit() — same isolation reasoning as updateOrder() above.
    if (order?.user?.email && order?.status === 'cancelled') {
      await safeNotifyOrderStatus(async () => {
        const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        await ensureNotificationDirectory(receiptsDir);
        const cancelledReceiptData = { ...receiptData, status: 'cancelled' };
        const receiptPath = await buildOrderReceiptPdf(cancelledReceiptData, receiptsDir);

        await sendOrderReceiptEmail({
          to: order.user.email,
          title: 'Order cancelled',
          message: `Your order ${order.orderNumber} has been cancelled.`,
          order: cancelledReceiptData,
          attachments: [{ filename: `order-${order.orderNumber}.pdf`, path: receiptPath }],
        });
      });
    }

    return res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to delete order', error: error.message });
  }
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};