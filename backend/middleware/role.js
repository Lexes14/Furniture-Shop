//ginagawa nito ay nagchecheck kung ang user ay mayroong tamang role para ma-access ang isang route, at kung wala, magre-return ito ng 403 Access Denied response
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return next();
  };
}

module.exports = {
  authorizeRoles,
};