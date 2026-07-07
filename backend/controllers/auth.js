const bcrypt = require('bcrypt');
const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const { publicUser } = require('../utils/helpers');

//ito ay para sa pag-register ng user sa system, pati na rin ang pag-save ng user sa database
async function register(req, res) {
  try {
    const { name, email, password, phone, address } = req.body;//kukunin ang name, email, password, phone, at address mula sa request body ng frontend registration form

    const existingUser = await User.findOne({ where: { email } });//check nya if may existing user na may ganitong email sa database
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);//hash ang password gamit ang bcrypt, para hindi ma-store ang plain text password sa database
    //create ng bagong user sa database gamit ang User model, at isave ang hashed password sa database
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      address: address || null,
      role: 'customer',
      status: 'active',
    });

    //ibabalik ang success response sa frontend, kasama ang public user data (walang password at token) para sa security
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
}

//dito nangyayari ang GENERATE ng token at pag-login ng user sa system, pati na rin ang pag-save ng token sa database para sa session management
async function login(req, res) {
  try {
    const { email, password } = req.body; //kinukuha ang email at password mula sa request body ng frontend login form

    //check kung may user na may ganitong email sa database
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid login credentials' });
    }

    //check kung active ang user account
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is inactive' });
    }

      //comapre ang password na galing sa request body sa hashed password na nasa database gamit ang bcrypt
      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid login credentials' });
      }

    //jwt token generation gamit ang user id, email, at role bilang payload
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    user.token = token;
    await user.save(); //wait na iupdate ang user record sa database para i-save ang token

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

//ito ay para sa pag-logout ng user sa system, pati na rin ang pag-clear ng token sa database para sa session management
//kailangan inull ang token sa database para hindi na magamit ang token sa future requests
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