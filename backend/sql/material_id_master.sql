-- Migration: Add materialIDMaster table and material_id column to shipments
-- Apply this migration to the configured CUMI MySQL database if not already done.

CREATE TABLE IF NOT EXISTS materialIDMaster (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Insert default Material ID if not already present
INSERT IGNORE INTO materialIDMaster (name) VALUES ('IC');

-- Add material_id column to shipments if not exists
ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS material_id VARCHAR(50) NOT NULL DEFAULT 'IC';
