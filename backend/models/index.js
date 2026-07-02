const sequelize = require('../config/database');
const User = require('./user');
const Category = require('./category');
const Cart = require('./cart');
const CartItem = require('./cartItem');
const Item = require('./item');
const Stock = require('./stock');
const Order = require('./order');
const OrderItem = require('./orderItem');
const Transaction = require('./transaction');
const Reservation = require('./reservation');
const Inquiry = require('./inquiry');

Category.hasMany(Item, {
  foreignKey: 'categoryId',
  as: 'items',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
Item.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
});

User.hasMany(Item, {
  foreignKey: 'createdBy',
  as: 'createdItems',
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL',
});
Item.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
});

User.hasOne(Cart, {
  foreignKey: 'userId',
  as: 'cart',
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
});
Cart.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Cart.hasMany(CartItem, {
  foreignKey: 'cartId',
  as: 'items',
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
});
CartItem.belongsTo(Cart, {
  foreignKey: 'cartId',
  as: 'cart',
});

Item.hasMany(CartItem, {
  foreignKey: 'itemId',
  as: 'cartItems',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
CartItem.belongsTo(Item, {
  foreignKey: 'itemId',
  as: 'item',
});

Item.hasOne(Stock, {
  foreignKey: 'itemId',
  as: 'stock',
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
});
Stock.belongsTo(Item, {
  foreignKey: 'itemId',
  as: 'item',
});

User.hasMany(Order, {
  foreignKey: 'userId',
  as: 'orders',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
Order.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Order.hasMany(OrderItem, {
  foreignKey: 'orderId',
  as: 'items',
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
});
OrderItem.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

Item.hasMany(OrderItem, {
  foreignKey: 'itemId',
  as: 'orderItems',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
OrderItem.belongsTo(Item, {
  foreignKey: 'itemId',
  as: 'item',
});

Order.hasMany(Transaction, {
  foreignKey: 'orderId',
  as: 'transactions',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
Transaction.belongsTo(Order, {
  foreignKey: 'orderId',
  as: 'order',
});

User.hasMany(Transaction, {
  foreignKey: 'userId',
  as: 'transactions',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
Transaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Reservation, {
  foreignKey: 'userId',
  as: 'reservations',
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});
Reservation.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

Item.hasMany(Reservation, {
  foreignKey: 'itemId',
  as: 'reservations',
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL',
});
Reservation.belongsTo(Item, {
  foreignKey: 'itemId',
  as: 'item',
});

User.hasMany(Inquiry, {
  foreignKey: 'userId',
  as: 'inquiries',
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL',
});
Inquiry.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(Inquiry, {
  foreignKey: 'repliedBy',
  as: 'repliedInquiries',
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL',
});
Inquiry.belongsTo(User, {
  foreignKey: 'repliedBy',
  as: 'replier',
});

module.exports = {
  sequelize,
  User,
  Category,
  Cart,
  CartItem,
  Item,
  Stock,
  Order,
  OrderItem,
  Transaction,
  Reservation,
  Inquiry,
};