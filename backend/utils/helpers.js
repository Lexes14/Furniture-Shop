function paginate({ page = 1, limit = 10 }) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  return {
    page: safePage,
    limit: safeLimit,
    offset,
  };
}

function normalizeSearch(value) {
  return String(value || '').trim();
}

function buildSearchClause(value, fields) {
  const search = normalizeSearch(value);
  if (!search) {
    return {};
  }

  const { Op } = require('sequelize');
  return {
    [Op.or]: fields.map((field) => ({
      [field]: { [Op.like]: `%${search}%` },
    })),
  };
}

//ito ay para sa pag-filter ng user object na ibabalik sa frontend, para hindi ma-expose ang password at token ng user
function publicUser(user) {
  if (!user) {
    return null;
  }

  const plain = user.toJSON ? user.toJSON() : user;
  delete plain.password;
  delete plain.token;
  return plain;
}

module.exports = {
  paginate,
  normalizeSearch,
  buildSearchClause,
  publicUser,
};
