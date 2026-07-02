const { Op } = require('sequelize');
const { Stock, Item, Category, User } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

async function listStocks(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { itemId, lowStock } = req.query;

    const where = {};

    if (itemId) {
      where.itemId = itemId;
    }

    if (lowStock === 'true' || lowStock === '1') {
      where.quantity = { [Op.lte]: 5 };
    }

    const include = [{
      model: Item,
      as: 'item',
      include: [{ model: Category, as: 'category' }],
    }];

    if (search) {
      include[0].where = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
        ],
      };
      include[0].required = true;
    }

    const { rows, count } = await Stock.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
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
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory', error: error.message });
  }
}

async function getStock(req, res) {
  try {
    const stock = await Stock.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }],
      }],
    });

    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }

    return res.status(200).json({ success: true, data: stock });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inventory record', error: error.message });
  }
}

async function createStock(req, res) {
  try {
    const { itemId, quantity, reservedQuantity, lowStockLevel, location, updatedBy } = req.body;
    const normalizedItemId = Number(itemId);

    const item = await Item.findByPk(normalizedItemId);
    if (!item) {
      return res.status(400).json({ success: false, message: 'Item not found' });
    }

    const existing = await Stock.findOne({ where: { itemId: normalizedItemId } });
    if (existing) {
      if (quantity !== undefined) existing.quantity = Number(quantity);
      if (reservedQuantity !== undefined) existing.reservedQuantity = Number(reservedQuantity);
      if (lowStockLevel !== undefined) existing.lowStockLevel = Number(lowStockLevel);
      if (location !== undefined) existing.location = location || null;
      existing.updatedBy = updatedBy || req.user?.id || existing.updatedBy;

      await existing.save();

      return res.status(200).json({ success: true, message: 'Inventory record updated successfully', data: existing });
    }

    const stock = await Stock.create({
      itemId: normalizedItemId,
      quantity: Number(quantity ?? 0),
      reservedQuantity: Number(reservedQuantity ?? 0),
      lowStockLevel: Number(lowStockLevel ?? 5),
      location: location || null,
      updatedBy: updatedBy || req.user?.id || null,
    });

    return res.status(201).json({ success: true, message: 'Inventory record created successfully', data: stock });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create inventory record', error: error.message });
  }
}

async function updateStock(req, res) {
  try {
    const stock = await Stock.findByPk(req.params.id);
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }

    const { itemId, quantity, reservedQuantity, lowStockLevel, location } = req.body;

    const normalizedItemId = itemId !== undefined ? Number(itemId) : undefined;

    if (normalizedItemId && normalizedItemId !== Number(stock.itemId)) {
      const item = await Item.findByPk(normalizedItemId);
      if (!item) {
        return res.status(400).json({ success: false, message: 'Item not found' });
      }

      const existing = await Stock.findOne({ where: { itemId: normalizedItemId, id: { [Op.ne]: stock.id } } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Inventory record already exists for this item' });
      }

      stock.itemId = normalizedItemId;
    }

    if (quantity !== undefined) stock.quantity = Number(quantity);
    if (reservedQuantity !== undefined) stock.reservedQuantity = Number(reservedQuantity);
    if (lowStockLevel !== undefined) stock.lowStockLevel = Number(lowStockLevel);
    if (location !== undefined) stock.location = location;
    stock.updatedBy = req.user?.id || stock.updatedBy;

    await stock.save();

    return res.status(200).json({ success: true, message: 'Inventory record updated successfully', data: stock });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update inventory record', error: error.message });
  }
}

async function deleteStock(req, res) {
  try {
    const stock = await Stock.findByPk(req.params.id);
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock record not found' });
    }

    await stock.destroy();

    return res.status(200).json({ success: true, message: 'Inventory record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete inventory record', error: error.message });
  }
}

module.exports = {
  listStocks,
  getStock,
  createStock,
  updateStock,
  deleteStock,
};
