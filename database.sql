CREATE DATABASE IF NOT EXISTS furniture_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE furniture_shop;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  profile_image VARCHAR(255) DEFAULT NULL,
  role ENUM('admin','customer') NOT NULL DEFAULT 'customer',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  token TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  KEY idx_categories_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  images JSON DEFAULT NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_sku (sku),
  KEY idx_items_name (name),
  KEY idx_items_status (status),
  KEY idx_items_category (category_id),
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_items_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stocks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  low_stock_level INT NOT NULL DEFAULT 5,
  location VARCHAR(120) DEFAULT NULL,
  updated_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stocks_item (item_id),
  KEY idx_stocks_quantity (quantity),
  CONSTRAINT fk_stocks_item FOREIGN KEY (item_id) REFERENCES items (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_stocks_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(60) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','approved','cancelled','delivered') NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) DEFAULT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_date (order_date),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_item (item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_items_item FOREIGN KEY (item_id) REFERENCES items (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_number VARCHAR(60) NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  receipt_path VARCHAR(255) DEFAULT NULL,
  remarks TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_number (transaction_number),
  UNIQUE KEY uq_transactions_order (order_id),
  KEY idx_transactions_user (user_id),
  KEY idx_transactions_status (status),
  CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) REFERENCES orders (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_number VARCHAR(60) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED DEFAULT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  status ENUM('pending','approved','cancelled','completed') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservations_number (reservation_number),
  KEY idx_reservations_user (user_id),
  KEY idx_reservations_status (status),
  KEY idx_reservations_date (reservation_date),
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_item FOREIGN KEY (item_id) REFERENCES items (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('pending','replied','closed') NOT NULL DEFAULT 'pending',
  response TEXT DEFAULT NULL,
  replied_by INT UNSIGNED DEFAULT NULL,
  replied_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inquiries_status (status),
  KEY idx_inquiries_email (email),
  CONSTRAINT fk_inquiries_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_inquiries_replied_by FOREIGN KEY (replied_by) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('active','converted','abandoned') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user (user_id),
  KEY idx_carts_status (status),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_items_cart_item (cart_id, item_id),
  KEY idx_cart_items_cart (cart_id),
  KEY idx_cart_items_item (item_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_item FOREIGN KEY (item_id) REFERENCES items (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT INTO users (name, email, password, phone, address, profile_image, role, status)
SELECT 'Admin User', 'admin@furnitureshop.local', '$2b$10$AtMGI1oKT/FybKo6sAs2NupF71vqN.SIOIq6arGy/zlpWrAEbtVHC', '09170000000', 'Head Office', NULL, 'admin', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@furnitureshop.local');

INSERT INTO users (name, email, password, phone, address, profile_image, role, status)
SELECT 'Sample Customer One', 'customer1@furnitureshop.local', '$2b$10$AtMGI1oKT/FybKo6sAs2NupF71vqN.SIOIq6arGy/zlpWrAEbtVHC', '09170000001', 'Sample Address 1', NULL, 'customer', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer1@furnitureshop.local');

INSERT INTO users (name, email, password, phone, address, profile_image, role, status)
SELECT 'Sample Customer Two', 'customer2@furnitureshop.local', '$2b$10$AtMGI1oKT/FybKo6sAs2NupF71vqN.SIOIq6arGy/zlpWrAEbtVHC', '09170000002', 'Sample Address 2', NULL, 'customer', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer2@furnitureshop.local');

-- Demo password for the seeded accounts above is: password123
UPDATE users
SET password = '$2b$10$AtMGI1oKT/FybKo6sAs2NupF71vqN.SIOIq6arGy/zlpWrAEbtVHC', status = 'active'
WHERE email IN ('admin@furnitureshop.local', 'customer1@furnitureshop.local', 'customer2@furnitureshop.local');

INSERT INTO categories (name, description, image, status)
SELECT 'Sofas', 'Comfortable seating furniture.', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sofas');

INSERT INTO categories (name, description, image, status)
SELECT 'Tables', 'Coffee, dining, and office tables.', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Tables');

INSERT INTO categories (name, description, image, status)
SELECT 'Beds', 'Bedroom beds and frames.', NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Beds');

INSERT INTO items (category_id, name, sku, description, price, cost_price, images, featured, status, created_by)
SELECT c.id, 'Modern L-Shaped Sofa', 'SOFA-001', 'Modern L-shaped sofa with premium fabric.', 45000.00, 32000.00, JSON_ARRAY('sofa-1.jpg','sofa-2.jpg'), 1, 'active', u.id
FROM categories c
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE c.name = 'Sofas' AND NOT EXISTS (SELECT 1 FROM items WHERE sku = 'SOFA-001');

INSERT INTO items (category_id, name, sku, description, price, cost_price, images, featured, status, created_by)
SELECT c.id, 'Walnut Dining Table', 'TAB-001', 'Elegant walnut dining table for six seats.', 28000.00, 19000.00, JSON_ARRAY('table-1.jpg','table-2.jpg'), 1, 'active', u.id
FROM categories c
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE c.name = 'Tables' AND NOT EXISTS (SELECT 1 FROM items WHERE sku = 'TAB-001');

INSERT INTO items (category_id, name, sku, description, price, cost_price, images, featured, status, created_by)
SELECT c.id, 'Queen Size Bed Frame', 'BED-001', 'Sturdy queen size bed frame with modern finish.', 35000.00, 24000.00, JSON_ARRAY('bed-1.jpg','bed-2.jpg'), 0, 'active', u.id
FROM categories c
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE c.name = 'Beds' AND NOT EXISTS (SELECT 1 FROM items WHERE sku = 'BED-001');

INSERT INTO stocks (item_id, quantity, reserved_quantity, low_stock_level, location, updated_by)
SELECT i.id, 20, 0, 5, 'Main Warehouse', u.id
FROM items i
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE i.sku = 'SOFA-001' AND NOT EXISTS (SELECT 1 FROM stocks WHERE item_id = i.id);

INSERT INTO stocks (item_id, quantity, reserved_quantity, low_stock_level, location, updated_by)
SELECT i.id, 15, 0, 5, 'Main Warehouse', u.id
FROM items i
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE i.sku = 'TAB-001' AND NOT EXISTS (SELECT 1 FROM stocks WHERE item_id = i.id);

INSERT INTO stocks (item_id, quantity, reserved_quantity, low_stock_level, location, updated_by)
SELECT i.id, 10, 0, 5, 'Main Warehouse', u.id
FROM items i
JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE i.sku = 'BED-001' AND NOT EXISTS (SELECT 1 FROM stocks WHERE item_id = i.id);

INSERT INTO stocks (item_id, quantity, reserved_quantity, low_stock_level, location, updated_by)
SELECT i.id, 0, 0, 5, 'Main Warehouse', u.id
FROM items i
LEFT JOIN stocks s ON s.item_id = i.id
LEFT JOIN users u ON u.email = 'admin@furnitureshop.local'
WHERE s.id IS NULL;
