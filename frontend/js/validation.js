window.FurnitureShopValidation = {
  isFilled(value) {
    return String(value || '').trim().length > 0;
  },
  isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }
};