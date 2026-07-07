const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'furniture_shop_local_dev_secret';
}

//ito ay para sa pag-generate ng JWT token na gagamitin sa authentication, gamit ang secret key na nasa environment variable
function generateToken(payload) {
  //ang jwt.sign ay nagge-generate ng JWT token gamit ang payload at secret key, at may expiration time na 7 days kung walang nakaset sa environment variable
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

//ito ay para sa pag-verify ng JWT token na galing sa frontend, gamit ang secret key na nasa environment variable
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  generateToken,
  verifyToken,
};
