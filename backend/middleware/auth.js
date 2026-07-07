const { User } = require('../models');
const { verifyToken } = require('../utils/jwt');

//dito nangyayari ang pag-authenticate ng user sa bawat request sa backend, gamit ang JWT token na galing sa frontend
async function authenticate(req, res, next) {
//iba't ibang posibleng sources: authorization header, x-access-token header, o request body
  const authHeader = req.headers.authorization || '';
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenFromHeader || req.headers['x-access-token'] || req.body?.token; 

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required' });
  }

  //ginagamit ang verifyToken function mula sa utils/jwt.js para i-verify ang JWT token na galing sa frontend, 
  // gamit ang secret key na nasa environment variable
  try {
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id);

    if (!user || user.status !== 'active' || user.token !== token) {
      return res.status(401).json({ success: false, message: 'Token is invalid or expired' });
    }

    req.user = user;
    req.token = token;
    //after successful authentication, tatawagin ang next() function para ipasa ang control sa susunod na middleware o route handler
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token verification failed' });
  }
}

module.exports = {
  authenticate,
};