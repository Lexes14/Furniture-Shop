const { Op } = require('sequelize');
const { Category, Item } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

async function listCategories(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { status } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const { rows, count } = await Category.findAndCountAll({
      where,
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
    return res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
}

async function getCategory(req, res) {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [{ model: Item, as: 'items' }],
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch category', error: error.message });
  }
}

async function createCategory(req, res) {
  try {
    const { name, description, image, status } = req.body;

    const existingCategory = await Category.findOne({ where: { name } });
    if (existingCategory) {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }

    const category = await Category.create({
      name,
      description: description || null,
      image: image || null,
      status: status || 'active',
    });

    return res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
  }
}

async function updateCategory(req, res) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, image, status } = req.body;

    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ where: { name, id: { [Op.ne]: category.id } } });
      if (existingCategory) {
        return res.status(409).json({ success: false, message: 'Category already exists' });
      }
      category.name = name;
    }

    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (status !== undefined) category.status = status;

    await category.save();

    return res.status(200).json({ success: true, message: 'Category updated successfully', data: category });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
  }
}

async function deleteCategory(req, res) {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [{ model: Item, as: 'items' }],
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (category.items && category.items.length > 0) {
      return res.status(409).json({ success: false, message: 'Category cannot be deleted while items exist' });
    }

    await category.destroy();

    return res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
  }
}

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
