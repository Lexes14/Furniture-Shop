const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const { normalizeSearch, publicUser, paginate } = require('../utils/helpers');

async function listUsers(req, res) {
  try {
    const { page, limit, offset } = paginate(req.query);
    const search = normalizeSearch(req.query.search);
    const { role, status } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: rows.map(publicUser),
      meta: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
}

async function getUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, phone, address, role = 'customer', status = 'active' } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      address: address || null,
      role,
      status,
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
}

async function updateUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, email, password, phone, address, profileImage } = req.body;

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } });
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email is already registered' });
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
}

async function updateRole(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = req.body.role;
    await user.save();

    return res.status(200).json({ success: true, message: 'User role updated successfully', data: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update role', error: error.message });
  }
}

async function deactivateUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'inactive';
    await user.save();

    return res.status(200).json({ success: true, message: 'User deactivated successfully', data: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate user', error: error.message });
  }
}

async function activateUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'active';
    await user.save();

    return res.status(200).json({ success: true, message: 'User activated successfully', data: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to activate user', error: error.message });
  }
}

async function deleteUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (Number(req.user?.id) === Number(user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account while logged in' });
    }

    await user.destroy();

    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'User cannot be deleted because they still have linked orders, transactions, or reservations. Deactivate the user instead.',
      });
    }

    return res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateRole,
  deactivateUser,
  activateUser,
  deleteUser,
};
