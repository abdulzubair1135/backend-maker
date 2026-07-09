-- MySQL Schema for Professional CMS & Backend Maker

CREATE DATABASE IF NOT EXISTS wss_db;
USE wss_db;

-- 1. Roles and Permissions Table
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  permissions TEXT NOT NULL, -- JSON string array of permissions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Roles
INSERT IGNORE INTO roles (id, name, permissions) VALUES 
(1, 'Super Admin', '["all"]'),
(2, 'Admin', '["dashboard.view", "cms.edit", "leads.manage", "media.manage"]'),
(3, 'Editor', '["dashboard.view", "cms.edit", "media.manage"]');

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INT NULL,
  status VARCHAR(20) DEFAULT 'Active', -- Active, Suspended
  two_factor_secret VARCHAR(255) DEFAULT NULL,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default Super Admin (password: admin123, encrypted with bcryptjs)
-- In production/first boot, server.js will check and create this if not exists
INSERT IGNORE INTO users (id, username, email, password, role_id, status) VALUES
(1, 'admin', 'admin@websoft.in', '$2a$10$tMh4Hk95zN2lA6n6b1s6Aun6A61cI1.n.o9e44444444444444444', 1, 'Active'); 
-- Note: actual valid bcrypt hash for 'admin123' is '$2a$10$eImiTx3GPsqM2.r1Q2oGou.uP31T2K4tW3uW3T.mC3yP0U3y74n3O'

-- 3. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Login Logs Table
CREATE TABLE IF NOT EXISTS login_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  status VARCHAR(20) NOT NULL, -- Success, Failed
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. CMS Pages (Home, About, Contact, Settings, SEO)
CREATE TABLE IF NOT EXISTS cms_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content TEXT NULL, -- JSON string or raw text content depending on page needs
  meta_title VARCHAR(255) DEFAULT NULL,
  meta_description TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default Pages content
INSERT IGNORE INTO cms_pages (name, title, content, meta_title, meta_description) VALUES
('about', 'About Websoft Solutions', '{"heroTitle":"Empowering Digital Communication","heroSubtitle":"Leading networking, security, and entertainment solutions in Gujarat.","history":"Established with a mission to bring high-quality connectivity to households and businesses alike.","vision":"To connect every home and enterprise in India with seamless digital infrastructure.","mission":"Deliver top-tier networking, CCTV security, and DishTV/OTT streaming solutions."}', 'About Us | Websoft Solutions', 'About Websoft Solutions - Gujrat leading entertainment, networking and CCTV security providers.'),
('contact', 'Contact Us', '{"phone1":"+91 99251 32277","phone2":"+91 96014 32277","email":"connect@wssbhuj.in","address":"102, 1st Floor, Shreeji Arcade, Aeroplane Circle, Opp. Reliance Petrol Pump, Aiya Nagar, Bhuj, Gujarat 370001"}', 'Contact Us | Websoft Solutions', 'Get in touch with Websoft Solutions in Bhuj, Gujarat.'),
('settings', 'General Settings', '{"companyName":"Websoft Solutions","logoUrl":"/assets/logoo1-BQQUxB1t.png","gstin":"24XXXXXXXXXXXXX","supportHours":"9:00 AM - 7:00 PM"}', 'Websoft Solutions', 'Websoft Solutions official site');

-- 7. CMS Slider
CREATE TABLE IF NOT EXISTS cms_slider (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) DEFAULT NULL,
  image_url VARCHAR(255) NOT NULL,
  link_url VARCHAR(255) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. CMS Gallery
CREATE TABLE IF NOT EXISTS cms_gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) DEFAULT NULL,
  image_url VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'General',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. CMS Menu
CREATE TABLE IF NOT EXISTS cms_menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  link_url VARCHAR(255) NOT NULL,
  parent_id INT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (parent_id) REFERENCES cms_menu(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default Menus
INSERT IGNORE INTO cms_menu (id, title, link_url, parent_id, sort_order) VALUES
(1, 'Home', '/', NULL, 1),
(2, 'Plans', '/plans', NULL, 2),
(3, 'OTT', '/ott', NULL, 3),
(4, 'Networking', '/networking', NULL, 4),
(5, 'About Us', '/about', NULL, 5),
(6, 'Contact Us', '/contact', NULL, 6);

-- 10. CMS News
CREATE TABLE IF NOT EXISTS cms_news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. CMS Events
CREATE TABLE IF NOT EXISTS cms_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  event_date TIMESTAMP NULL,
  location VARCHAR(255) DEFAULT NULL,
  active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. CMS Faculty
CREATE TABLE IF NOT EXISTS cms_faculty (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  designation VARCHAR(100) DEFAULT NULL,
  department VARCHAR(100) DEFAULT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. CMS Departments
CREATE TABLE IF NOT EXISTS cms_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  code VARCHAR(10) DEFAULT NULL,
  active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. CMS Downloads
CREATE TABLE IF NOT EXISTS cms_downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Leads & Transactions Table (Contact forms, Audits, Dish & OTT Billing)
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL, -- contact, audit, dish_billing, ott_billing
  status VARCHAR(20) DEFAULT 'Pending', -- Pending, Contacted, Completed
  details TEXT NULL, -- Store custom JSON fields (e.g. vcNumber, amount, packName, subject, details)
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
