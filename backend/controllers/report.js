const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize, Order, OrderItem, Item, Category, Transaction, Stock, User } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

function parseLimit(value, fallback = 10) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 100);
}

// Revenue (grandTotal) is no longer a stored column, so it's computed here
// as: shipping_fee + SUM(order_items.quantity * order_items.price) per order.
// This derived table pre-sums order_items PER ORDER first, then joins 1:1 to
// orders — this avoids duplicating/double-counting shipping_fee, which would
// happen with a naive direct JOIN between orders and order_items.
const ORDER_ITEMS_JOIN = `
  LEFT JOIN (
    SELECT order_id, SUM(quantity * price) AS items_total
    FROM order_items
    GROUP BY order_id
  ) oi ON oi.order_id = o.id
`;
const REVENUE_EXPRESSION = 'COALESCE(SUM(o.shipping_fee + COALESCE(oi.items_total, 0)), 0)';

function buildRevenueFilters(query) {
  const conditions = [`o.status IN ('approved', 'delivered')`];
  const replacements = {};

  if (query.startDate) {
    conditions.push('o.order_date >= :startDate');
    replacements.startDate = query.startDate;
  }
  if (query.endDate) {
    conditions.push('o.order_date <= :endDate');
    replacements.endDate = query.endDate;
  }

  return { whereClause: conditions.join(' AND '), replacements };
}

async function overview(req, res) {
  try {
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const [totalUsers, totalOrders, totalTransactions, totalProducts, totalCategories, lowStockItems, pendingOrders, revenueRows] = await Promise.all([
      User.count(),
      Order.count(),
      Transaction.count(),
      Item.count(),
      Category.count(),
      Stock.count({ where: { quantity: { [Op.lte]: literal('low_stock_level') } } }),
      Order.count({ where: { status: 'pending' } }),
      sequelize.query(
        `SELECT ${REVENUE_EXPRESSION} AS revenue FROM orders o ${ORDER_ITEMS_JOIN} WHERE ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalOrders,
        totalTransactions,
        totalProducts,
        totalCategories,
        lowStockItems,
        pendingOrders,
        revenue: Number(revenueRows?.[0]?.revenue || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load report overview', error: error.message });
  }
}

async function dailySales(req, res) {
  try {
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const results = await sequelize.query(
      `
        SELECT DATE(o.order_date) AS date,
               COUNT(o.id) AS orders,
               ${REVENUE_EXPRESSION} AS revenue
        FROM orders o
        ${ORDER_ITEMS_JOIN}
        WHERE ${whereClause}
        GROUP BY DATE(o.order_date)
        ORDER BY DATE(o.order_date) ASC
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load daily sales report', error: error.message });
  }
}

async function monthlySales(req, res) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const results = await sequelize.query(
      `
        SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS month,
               COUNT(o.id) AS orders,
               ${REVENUE_EXPRESSION} AS revenue
        FROM orders o
        ${ORDER_ITEMS_JOIN}
        WHERE ${whereClause} AND o.order_date >= :yearStart AND o.order_date <= :yearEnd
        GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
        ORDER BY month ASC
      `,
      {
        replacements: { ...replacements, yearStart: `${year}-01-01`, yearEnd: `${year}-12-31` },
        type: QueryTypes.SELECT,
      }
    );

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load monthly sales report', error: error.message });
  }
}

async function yearlySales(req, res) {
  try {
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const results = await sequelize.query(
      `
        SELECT YEAR(o.order_date) AS year,
               COUNT(o.id) AS orders,
               ${REVENUE_EXPRESSION} AS revenue
        FROM orders o
        ${ORDER_ITEMS_JOIN}
        WHERE ${whereClause}
        GROUP BY YEAR(o.order_date)
        ORDER BY YEAR(o.order_date) ASC
      `,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load yearly sales report', error: error.message });
  }
}

async function bestSellingProducts(req, res) {
  try {
    const limit = parseLimit(req.query.limit, 10);
    const results = await OrderItem.findAll({
      attributes: [
        'itemId',
        [fn('SUM', col('quantity')), 'unitsSold'],
        [fn('SUM', literal('order_items.quantity * order_items.price')), 'revenue'],
      ],
      include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
      group: ['itemId', 'item.id', 'item->category.id'],
      order: [[literal('unitsSold'), 'DESC']],
      limit,
      raw: false,
      nest: true,
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load best selling products report', error: error.message });
  }
}

async function bestSellingCategories(req, res) {
  try {
    const limit = parseLimit(req.query.limit, 10);
    const results = await OrderItem.findAll({
      attributes: [
        [col('item.category_id'), 'categoryId'],
        [fn('SUM', col('quantity')), 'unitsSold'],
        [fn('SUM', literal('order_items.quantity * order_items.price')), 'revenue'],
      ],
      include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
      group: ['item.category_id', 'item->category.id'],
      order: [[literal('unitsSold'), 'DESC']],
      limit,
      raw: false,
      nest: true,
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load best selling categories report', error: error.message });
  }
}

async function inventoryReport(_req, res) {
  try {
    const results = await Stock.findAll({
      include: [{ model: Item, as: 'item', include: [{ model: Category, as: 'category' }] }],
      order: [['quantity', 'ASC']],
      raw: false,
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load inventory report', error: error.message });
  }
}

async function transactionsReport(req, res) {
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

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: [{
        model: Order,
        as: 'order',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
      }, { model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
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
    return res.status(500).json({ success: false, message: 'Failed to load transactions report', error: error.message });
  }
}

module.exports = {
  overview,
  dailySales,
  monthlySales,
  yearlySales,
  bestSellingProducts,
  bestSellingCategories,
  inventoryReport,
  transactionsReport,
};