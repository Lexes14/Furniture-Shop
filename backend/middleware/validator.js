const { validationResult } = require('express-validator');

//ang vinavalidate nito ay ang mga request body at params na galing sa frontend, gamit ang express-validator
//ang express-validator ay isang library na ginagamit para sa pag-validate ng mga input sa Express.js applications
//ito yung mga nasa routes/item.js na may validateRequest middleware, tulad ng pag-validate ng item id, category id, name, sku, price, at cost price
//vinavalidate nito kung tama ang format ng mga input, at kung may kulang o mali, magbabalik ito ng error response sa frontend
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((error) => ({
      field: error.param,
      message: error.msg,
    })),
  });
}

module.exports = {
  validateRequest,
};