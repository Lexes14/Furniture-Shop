const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { Item, Category, Stock } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

function parseImages(req) {
  const uploadedImages = (req.files || []).map((file) => file.filename);
  const existingImages = req.body.existingImages;
  const hasExistingImagesField = Object.prototype.hasOwnProperty.call(req.body, 'existingImages');

  if (!hasExistingImagesField && uploadedImages.length === 0) {
    return null;
  }

  const parsedExistingImages = Array.isArray(existingImages)
    ? existingImages
    : typeof existingImages === 'string' && existingImages.trim()
      ? existingImages.split(',').map((image) => image.trim()).filter(Boolean)
      : [];

  return [...parsedExistingImages, ...uploadedImages];
}

function normalizeImages(images) {
  if (!images) {
    return [];
  }

  if (Array.isArray(images)) {
    return images.filter(Boolean);
  }

  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (_error) {
      return images.split(',').map((image) => image.trim()).filter(Boolean);
    }
  }

  return [];
}

function deleteProductImages(images) {
  normalizeImages(images).forEach((image) => {
    const imagePath = path.join(__dirname, '..', 'uploads', 'products', path.basename(image));
    fs.unlink(imagePath, () => { });
  });
}

function hasStockInput(body) {
  return body.quantity !== undefined || body.reservedQuantity !== undefined || body.lowStockLevel !== undefined || body.location !== undefined;
}

async function syncItemStock(itemId, body, userId) {
  if (!hasStockInput(body)) {
    return null;
  }

  const [stock] = await Stock.findOrCreate({
    where: { itemId },
    defaults: {
      itemId,
      quantity: Number(body.quantity ?? 0),
      reservedQuantity: Number(body.reservedQuantity ?? 0),
      lowStockLevel: Number(body.lowStockLevel ?? 5),
      location: body.location || null,
      updatedBy: userId || null,
    },
  });

  if (body.quantity !== undefined) stock.quantity = Number(body.quantity);
  if (body.reservedQuantity !== undefined) stock.reservedQuantity = Number(body.reservedQuantity);
  if (body.lowStockLevel !== undefined) stock.lowStockLevel = Number(body.lowStockLevel);
  if (body.location !== undefined) stock.location = body.location || null;
  stock.updatedBy = userId || stock.updatedBy;

  await stock.save();
  return stock;
}

function itemInclude() {
  return [
    { model: Category, as: 'category', required: false },
  ];
}

async function attachStocks(items) {
  const rows = Array.isArray(items) ? items : [items];
  const itemIds = rows.map((item) => item?.id).filter(Boolean);

  if (itemIds.length === 0) {
    return items;
  }

  const stocks = await Stock.findAll({ where: { itemId: { [Op.in]: itemIds } } });
  const stockByItemId = new Map(stocks.map((stock) => [Number(stock.itemId), stock]));

  rows.forEach((item) => {
    if (item?.setDataValue) {
      item.setDataValue('stock', stockByItemId.get(Number(item.id)) || null);
    }
  });

  return items;
}

async function listItems(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { categoryId, status, featured } = req.query;
    const orderBy = req.query.sortBy || 'createdAt';
    const orderDirection = String(req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { '$category.name$': { [Op.like]: `%${search}%` } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
    }

    if (featured !== undefined && featured !== '') {
      where.featured = featured === 'true' || featured === '1';
    }

    const { rows, count } = await Item.findAndCountAll({
      where,
      include: itemInclude(),
      order: [[orderBy, orderDirection]],
      limit,
      offset,
      subQuery: false,
    });
    await attachStocks(rows);

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
    return res.status(500).json({ success: false, message: 'Failed to fetch items', error: error.message });
  }
}

async function getItem(req, res) {
  try {
    const item = await Item.findByPk(req.params.id, {
      include: itemInclude(),
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    await attachStocks(item);

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch item', error: error.message });
  }
}

async function createItem(req, res) {
  try {
    const { categoryId, name, sku, description, price, costPrice, featured, status, createdBy } = req.body;

    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category not found' });
    }

    const duplicateSku = await Item.findOne({ where: { sku } });
    if (duplicateSku) {
      return res.status(409).json({ success: false, message: 'SKU already exists' });
    }

    const images = parseImages(req);

    const item = await Item.create({
      categoryId,
      name,
      sku,
      description: description || null,
      price,
      costPrice,
      images,
      featured: featured === true || featured === 'true' || featured === '1',
      status: status || 'active',
      createdBy: createdBy || req.user?.id || null,
    });

    await syncItemStock(item.id, req.body, req.user?.id);

    const createdItem = await Item.findByPk(item.id, { include: itemInclude() });
    await attachStocks(createdItem);
    return res.status(201).json({ success: true, message: 'Item created successfully', data: createdItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create item', error: error.message });
  }
}

async function updateItem(req, res) {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const { categoryId, name, sku, description, price, costPrice, featured, status } = req.body;

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found' });
      }
      item.categoryId = categoryId;
    }

    if (sku && sku !== item.sku) {
      const duplicateSku = await Item.findOne({ where: { sku, id: { [Op.ne]: item.id } } });
      if (duplicateSku) {
        return res.status(409).json({ success: false, message: 'SKU already exists' });
      }
      item.sku = sku;
    }

    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;
    if (price !== undefined) item.price = price;
    if (costPrice !== undefined) item.costPrice = costPrice;
    if (featured !== undefined) item.featured = featured === true || featured === 'true' || featured === '1';
    if (status !== undefined) item.status = status;

    const images = parseImages(req);
    if (images !== null) {
      const removedImages = normalizeImages(item.images).filter((image) => !images.includes(image));
      item.images = images;
      deleteProductImages(removedImages);
    }

    await item.save();
    await syncItemStock(item.id, req.body, req.user?.id);

    const updatedItem = await Item.findByPk(item.id, { include: itemInclude() });
    await attachStocks(updatedItem);
    return res.status(200).json({ success: true, message: 'Item updated successfully', data: updatedItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update item', error: error.message });
  }
}

async function deleteItem(req, res) {
  try {
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const images = normalizeImages(item.images);
    await item.destroy();
    deleteProductImages(images);

    return res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete item', error: error.message });
  }
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
};