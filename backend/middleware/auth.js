const { User } = require('../models');
const { verifyToken } = require('../utils/jwt');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenFromHeader || req.headers['x-access-token'] || req.body?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required' });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id);

    if (!user || user.status !== 'active' || user.token !== token) {
      return res.status(401).json({ success: false, message: 'Token is invalid or expired' });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token verification failed' });
  }
}

module.exports = {
  authenticate,
};