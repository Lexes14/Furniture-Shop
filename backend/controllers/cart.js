const { sequelize, Cart, CartItem, Item, Stock, Category } = require('../models');

async function getOrCreateCart(userId, transaction) {
  const [cart] = await Cart.findOrCreate({
    where: { userId },
    defaults: { userId, status: 'active' },
    transaction,
  });

  return cart;
}

async function fetchCart(userId) {
  return Cart.findOne({
    where: { userId },
    include: [{
      model: CartItem,
      as: 'items',
      include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
    }],
  });
}

function computeCartTotals(cart) {
  const items = cart?.items || [];
  const totals = items.reduce((accumulator, cartItem) => {
    const quantity = Number(cartItem.quantity) || 0;
    const unitPrice = Number(cartItem.unitPrice) || 0;
    const subtotal = Number(cartItem.subtotal) || quantity * unitPrice;
    accumulator.quantity += quantity;
    accumulator.subtotal += subtotal;
    return accumulator;
  }, { quantity: 0, subtotal: 0 });

  return {
    totalItems: totals.quantity,
    subtotal: Number(totals.subtotal.toFixed(2)),
  };
}

async function getCart(req, res) {
  try {
    const cart = await fetchCart(req.user.id);
    if (!cart) {
      return res.status(200).json({ success: true, data: { items: [], totalItems: 0, subtotal: 0 } });
    }

    const totals = computeCartTotals(cart);
    return res.status(200).json({ success: true, data: { ...cart.toJSON(), ...totals } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch cart', error: error.message });
  }
}

async function addItem(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { itemId, quantity } = req.body;
    const requestedQuantity = Number(quantity || 1);

    const item = await Item.findByPk(itemId, { transaction });
    if (!item) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Item not found' });
    }

    const stock = await Stock.findOne({ where: { itemId }, transaction });
    const availableQuantity = Number(stock?.quantity || 0) - Number(stock?.reservedQuantity || 0);

    const cart = await getOrCreateCart(req.user.id, transaction);
    const existingCartItem = await CartItem.findOne({
      where: { cartId: cart.id, itemId },
      transaction,
    });

    const newQuantity = requestedQuantity + Number(existingCartItem?.quantity || 0);
    if (availableQuantity < newQuantity) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }

    if (existingCartItem) {
      existingCartItem.quantity = newQuantity;
      existingCartItem.unitPrice = item.price;
      existingCartItem.subtotal = Number(item.price) * newQuantity;
      await existingCartItem.save({ transaction });
    } else {
      await CartItem.create({
        cartId: cart.id,
        itemId,
        quantity: requestedQuantity,
        unitPrice: item.price,
        subtotal: Number(item.price) * requestedQuantity,
      }, { transaction });
    }

    await transaction.commit();

    const updatedCart = await fetchCart(req.user.id);
    const totals = computeCartTotals(updatedCart);

    return res.status(201).json({ success: true, message: 'Item added to cart', data: { ...updatedCart.toJSON(), ...totals } });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to add item to cart', error: error.message });
  }
}

async function updateItem(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const cart = await getOrCreateCart(req.user.id, transaction);
    const cartItem = await CartItem.findOne({ where: { id: req.params.id, cartId: cart.id }, transaction });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    const requestedQuantity = Number(req.body.quantity);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const stock = await Stock.findOne({ where: { itemId: cartItem.itemId }, transaction });
    const availableQuantity = Number(stock?.quantity || 0) - Number(stock?.reservedQuantity || 0);
    if (availableQuantity < requestedQuantity) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient stock available' });
    }

    cartItem.quantity = requestedQuantity;
    cartItem.subtotal = Number(cartItem.unitPrice) * requestedQuantity;
    await cartItem.save({ transaction });

    await transaction.commit();

    const updatedCart = await fetchCart(req.user.id);
    const totals = computeCartTotals(updatedCart);
    return res.status(200).json({ success: true, message: 'Cart item updated successfully', data: { ...updatedCart.toJSON(), ...totals } });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to update cart item', error: error.message });
  }
}

async function removeItem(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const cart = await getOrCreateCart(req.user.id, transaction);
    const cartItem = await CartItem.findOne({ where: { id: req.params.id, cartId: cart.id }, transaction });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    await cartItem.destroy({ transaction });
    await transaction.commit();

    const updatedCart = await fetchCart(req.user.id);
    const totals = computeCartTotals(updatedCart);
    return res.status(200).json({ success: true, message: 'Cart item removed successfully', data: { ...updatedCart.toJSON(), ...totals } });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to remove cart item', error: error.message });
  }
}

async function clearCart(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const cart = await getOrCreateCart(req.user.id, transaction);
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await transaction.commit();

    return res.status(200).json({ success: true, message: 'Cart cleared successfully', data: { items: [], totalItems: 0, subtotal: 0 } });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: 'Failed to clear cart', error: error.message });
  }
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};