-- Sales Order Item Notes & History Tables
-- Run this script to create the required tables

-- Main table for current notes state
CREATE TABLE IF NOT EXISTS app_sales_order_item_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido VARCHAR(20) NOT NULL,
  item VARCHAR(10) NOT NULL,
  nota TEXT,
  status ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO') DEFAULT 'PENDENTE',
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_pedido_item (pedido, item),
  INDEX idx_pedido (pedido),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- History table for audit trail
CREATE TABLE IF NOT EXISTS app_sales_order_item_notes_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido VARCHAR(20) NOT NULL,
  item VARCHAR(10) NOT NULL,
  action_type ENUM('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DELETED') NOT NULL,
  field_changed VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  user_name VARCHAR(100) NOT NULL,
  user_email VARCHAR(100),
  action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pedido_item (pedido, item),
  INDEX idx_timestamp (action_timestamp DESC),
  INDEX idx_action_type (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
