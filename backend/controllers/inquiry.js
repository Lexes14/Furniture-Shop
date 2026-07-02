const { Op } = require('sequelize');
const { Inquiry, User } = require('../models');
const { normalizeSearch, paginate } = require('../utils/helpers');

async function listInquiries(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { status } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    if (req.user?.role !== 'admin') {
      where.userId = req.user?.id;
    }

    const { rows, count } = await Inquiry.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'replier', attributes: ['id', 'name', 'email', 'role'], required: false },
      ],
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
    return res.status(500).json({ success: false, message: 'Failed to fetch inquiries', error: error.message });
  }
}

async function getInquiry(req, res) {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'replier', attributes: ['id', 'name', 'email', 'role'], required: false },
      ],
    });

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    if (req.user?.role !== 'admin' && inquiry.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: inquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch inquiry', error: error.message });
  }
}

async function createInquiry(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    const inquiry = await Inquiry.create({
      userId: req.user?.id || null,
      name,
      email,
      subject,
      message,
      status: 'pending',
    });

    return res.status(201).json({ success: true, message: 'Inquiry created successfully', data: inquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create inquiry', error: error.message });
  }
}

async function updateInquiry(req, res) {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    if (req.user?.role !== 'admin' && inquiry.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, subject, message, status, response } = req.body;

    if (req.user?.role !== 'admin') {
      if (name !== undefined) inquiry.name = name;
      if (email !== undefined) inquiry.email = email;
      if (subject !== undefined) inquiry.subject = subject;
      if (message !== undefined) inquiry.message = message;
    } else {
      if (name !== undefined) inquiry.name = name;
      if (email !== undefined) inquiry.email = email;
      if (subject !== undefined) inquiry.subject = subject;
      if (message !== undefined) inquiry.message = message;
      if (status !== undefined) inquiry.status = status;
      if (response !== undefined) inquiry.response = response;
      if (response !== undefined) inquiry.repliedBy = req.user.id;
      if (response !== undefined) inquiry.repliedAt = new Date();
      if (status === 'replied' && response === undefined && inquiry.response) {
        inquiry.repliedBy = req.user.id;
        inquiry.repliedAt = new Date();
      }
    }

    await inquiry.save();

    return res.status(200).json({ success: true, message: 'Inquiry updated successfully', data: inquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update inquiry', error: error.message });
  }
}

async function deleteInquiry(req, res) {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    if (req.user?.role !== 'admin' && inquiry.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await inquiry.destroy();

    return res.status(200).json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete inquiry', error: error.message });
  }
}

module.exports = {
  listInquiries,
  getInquiry,
  createInquiry,
  updateInquiry,
  deleteInquiry,
};
