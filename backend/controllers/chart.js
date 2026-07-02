const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize, Order, OrderItem, Item, Category, Stock } = require('../models');

function chartPalette(index) {
  const colors = [
    '#8b5cf6',
    '#0f766e',
    '#f59e0b',
    '#ef4444',
    '#2563eb',
    '#10b981',
    '#db2777',
    '#7c3aed',
    '#14b8a6',
    '#dc2626',
  ];

  return colors[index % colors.length];
}

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

async function salesBar(req, res) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const results = await sequelize.query(
      `
        SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS label,
               ${REVENUE_EXPRESSION} AS value
        FROM orders o
        ${ORDER_ITEMS_JOIN}
        WHERE ${whereClause} AND o.order_date >= :yearStart AND o.order_date <= :yearEnd
        GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
        ORDER BY label ASC
      `,
      {
        replacements: { ...replacements, yearStart: `${year}-01-01`, yearEnd: `${year}-12-31` },
        type: QueryTypes.SELECT,
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        labels: results.map((row) => row.label),
        datasets: [{
          label: `Sales ${year}`,
          data: results.map((row) => Number(row.value || 0)),
          backgroundColor: results.map((_, index) => chartPalette(index)),
          borderColor: '#111827',
          borderWidth: 1,
        }],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load sales bar chart', error: error.message });
  }
}

async function salesLine(req, res) {
  try {
    const year = req.query.year || new Date().getFullYear();
    const { whereClause, replacements } = buildRevenueFilters(req.query);

    const results = await sequelize.query(
      `
        SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS label,
               ${REVENUE_EXPRESSION} AS value
        FROM orders o
        ${ORDER_ITEMS_JOIN}
        WHERE ${whereClause} AND o.order_date >= :yearStart AND o.order_date <= :yearEnd
        GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
        ORDER BY label ASC
      `,
      {
        replacements: { ...replacements, yearStart: `${year}-01-01`, yearEnd: `${year}-12-31` },
        type: QueryTypes.SELECT,
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        labels: results.map((row) => row.label),
        datasets: [{
          label: `Revenue ${year}`,
          data: results.map((row) => Number(row.value || 0)),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15, 118, 110, 0.18)',
          tension: 0.35,
          fill: true,
        }],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load sales line chart', error: error.message });
  }
}

async function categoryPie(req, res) {
  try {
    const results = await OrderItem.findAll({
      attributes: [
        [col('item.category_id'), 'categoryId'],
        [fn('SUM', literal('order_items.quantity * order_items.price')), 'value'],
      ],
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'], include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }] }],
      group: ['item.category_id', 'item.id', 'item->category.id'],
      order: [[literal('value'), 'DESC']],
      raw: false,
      nest: true,
    });

    const labels = results.map((row) => row.item?.category?.name || 'Uncategorized');
    const data = results.map((row) => Number(row.get('value') || 0));

    return res.status(200).json({
      success: true,
      data: {
        labels,
        datasets: [{
          label: 'Category Revenue',
          data,
          backgroundColor: data.map((_, index) => chartPalette(index)),
          borderColor: '#ffffff',
          borderWidth: 2,
        }],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load category pie chart', error: error.message });
  }
}

async function productBar(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);
    const results = await OrderItem.findAll({
      attributes: [
        [col('itemId'), 'itemId'],
        [fn('SUM', col('quantity')), 'value'],
      ],
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
      group: ['itemId', 'item.id'],
      order: [[literal('value'), 'DESC']],
      limit,
      raw: false,
      nest: true,
    });

    const labels = results.map((row) => row.item?.name || `Item ${row.get('itemId')}`);
    const data = results.map((row) => Number(row.get('value') || 0));

    return res.status(200).json({
      success: true,
      data: {
        labels,
        datasets: [{
          label: 'Units Sold',
          data,
          backgroundColor: data.map((_, index) => chartPalette(index)),
          borderColor: '#111827',
          borderWidth: 1,
        }],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load product bar chart', error: error.message });
  }
}

async function inventoryBar(_req, res) {
  try {
    const results = await Stock.findAll({
      include: [{ model: Item, as: 'item', attributes: ['id', 'name'] }],
      order: [['quantity', 'ASC']],
      raw: false,
    });

    const labels = results.map((row) => row.item?.name || `Item ${row.itemId}`);
    const data = results.map((row) => Number(row.quantity || 0));

    return res.status(200).json({
      success: true,
      data: {
        labels,
        datasets: [{
          label: 'Available Stock',
          data,
          backgroundColor: data.map((quantity, index) => (quantity <= 5 ? '#ef4444' : chartPalette(index))),
          borderColor: '#111827',
          borderWidth: 1,
        }],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load inventory bar chart', error: error.message });
  }
}

module.exports = {
  salesBar,
  salesLine,
  categoryPie,
  productBar,
  inventoryBar,
};