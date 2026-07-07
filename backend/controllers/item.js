const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { Item, Category, Stock } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

//heart ng multiple upload
  function parseImages(req) {
  // If no files are uploaded and no existingImages field is provided, return null to indicate no change
  const uploadedImages = (req.files || []).map((file) => file.filename);
  const existingImages = req.body.existingImages;
  const hasExistingImagesField = Object.prototype.hasOwnProperty.call(req.body, 'existingImages');

  if (!hasExistingImagesField && uploadedImages.length === 0) {
    return null;
  }
  //gumamit ng ternary operator para i-check kung ano ang type ng existingImages.
  //tinatanong kung array ba ito, kung hindi, kung string ba ito at may laman, 
  // kung oo, gagawin niya itong array by splitting by comma and trimming 
  // whitespace. If none of these conditions are met, it will return an empty array.
  const parsedExistingImages = Array.isArray(existingImages)
    ? existingImages
    : typeof existingImages === 'string' && existingImages.trim()
      ? existingImages.split(',').map((image) => image.trim()).filter(Boolean)
      : [];

  //pinagsama ang parsedExistingImages at uploadedImages arrays para makabuo ng final images array na ibabalik.
  return [...parsedExistingImages, ...uploadedImages];
}

//ito yung function na nagno-normalize ng images. Kung walang images, magbabalik ito ng empty array.
function normalizeImages(images) {
  if (!images) {
    return [];
  }

// kahit na ano pa ang format ng input (string, array, o null/undefined).
  if (Array.isArray(images)) {
    return images.filter(Boolean);
  }

// nagno-normalize ng images input para maging consistent na array of strings,
//  kahit na ano pa ang format ng input (string, array, o null/undefined).
  if (typeof images === 'string') {
    try {
    //chinecheck nya lang kung valid JSON string ba yung images, kung oo, ipaparse niya ito at ichecheck kung array ba ito.
    //  Kung hindi valid JSON, gagawin niya itong array by splitting by comma and trimming whitespace.
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    }
     catch (_error) {
      return images.split(',').map((image) => image.trim()).filter(Boolean);
    }
  }

  return [];
}

//ito yung function na nagde-delete ng product images. 
//ang fs.unlink ay ginagamit para tanggalin ang file sa filesystem.
function deleteProductImages(images) {
  normalizeImages(images).forEach((image) => {
    const imagePath = path.join(__dirname, '..', 'uploads', 'products', path.basename(image));
    fs.unlink(imagePath, () => { });
  });
}

function hasStockInput(body) {
  return body.quantity !== undefined || body.reservedQuantity !== undefined || body.lowStockLevel !== undefined || body.location !== undefined;
}

//ginagawa nito ang function na nagse-sync ng stock information sa database para sa isang item.
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

//ito naman yung function na nag-a-attach ng stock information sa bawat item.
function itemInclude() {
  return [
    { model: Category, as: 'category', required: false },
  ];
}

//ginagawa nito ang function na nag-a-attach ng stock information sa bawat item.
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
// ito yung function na nagc-create ng item, nagva-validate ng category at sku, nagpa-parse ng images, at nagse-save ng item sa database.
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
//create operation at nagsasave ng item sa database
    const images = parseImages(req);

    //sequelize insert operation para gumawa ng bagong item sa database gamit ang Item model
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

    await syncItemStock(item.id, req.body, req.user?.id);//ito yung function na nagse-sync ng stock information sa database para sa bagong item.

    const createdItem = await Item.findByPk(item.id, { include: itemInclude() }); //controller response
    await attachStocks(createdItem);
    return res.status(201).json({ success: true, message: 'Item created successfully', data: createdItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create item', error: error.message });
  }
}

//dito yung function na nag-u-update ng item, nagva-validate ng category at sku, nagpa-parse ng images, 
// at nagse-save ng updated item sa database.
async function updateItem(req, res) {
  try {
    //hinahanap ang item sa database gamit ang id mula sa request parameters. 
    const item = await Item.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    //kinukuha ang mga fields mula sa request body na gagamitin para i-update ang item.
    const { categoryId, name, sku, description, price, costPrice, featured, status } = req.body;

    //ito naman yung validation para sa categoryId. Kung may categoryId sa request body, hahanapin niya ito sa database.
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found' });
      }
      item.categoryId = categoryId;
    }

    //ito yung validation para sa sku. Kung may sku sa request body at iba ito sa kasalukuyang sku ng item,
    //  hahanapin niya kung may ibang item na may parehong sku.
    if (sku && sku !== item.sku) {
      const duplicateSku = await Item.findOne({ where: { sku, id: { [Op.ne]: item.id } } });
      if (duplicateSku) {
        return res.status(409).json({ success: false, message: 'SKU already exists' });
      }
      item.sku = sku;
    }

    //ito yung mga conditional updates para sa iba pang fields ng item. Kung may value sa request body, i-uupdate niya ang item.
    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;
    if (price !== undefined) item.price = price;
    if (costPrice !== undefined) item.costPrice = costPrice;
    if (featured !== undefined) item.featured = featured === true || featured === 'true' || featured === '1';
    if (status !== undefined) item.status = status;

    //ito yung update ng images ng item. Kinukuha niya ang images mula sa request gamit ang parseImages function.
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

//ito yung function na nagde-delete ng item. Hinahanap niya ang item sa database gamit ang id mula sa request parameters, at kung nahanap, ide-delete niya ito at ang mga associated images.
async function deleteItem(req, res) {
  try {
    //check kung may stock ang item bago idelete.
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