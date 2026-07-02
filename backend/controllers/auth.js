const bcrypt = require('bcrypt');
const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const { publicUser } = require('../utils/helpers');

async function register(req, res) {
  try {
    const { name, email, password, phone, address } = req.body;

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
      role: 'customer',
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid login credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is inactive' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid login credentials' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    user.token = token;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
}

async function logout(req, res) {
  try {
    req.user.token = null;
    await req.user.save();

    return res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Logout failed', error: error.message });
  }
}

async function profile(req, res) {
  return res.status(200).json({
    success: true,
    data: publicUser(req.user),
  });
}

async function updateProfile(req, res) {
  try {
    const user = req.user;
    const { name, phone, address, password } = req.body;

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
}

module.exports = {
  register,
  login,
  logout,
  profile,
  updateProfile,
};