CREATE TABLE IF NOT EXISTS shipment_modes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(40) NOT NULL,
    code VARCHAR(40) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_shipment_modes_name (name),
    UNIQUE KEY uq_shipment_modes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS countries (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_countries_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prw_statuses (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_prw_statuses_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materials (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_materials_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @ports_active_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ports'
      AND column_name = 'is_active'
);
SET @ports_active_ddl = IF(
    @ports_active_exists = 0,
    'ALTER TABLE ports ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1'
);
PREPARE ports_active_stmt FROM @ports_active_ddl;
EXECUTE ports_active_stmt;
DEALLOCATE PREPARE ports_active_stmt;

SET @mode_code_type = (
    SELECT DATA_TYPE
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'shipment_modes'
      AND column_name = 'code'
);
SET @mode_code_ddl = IF(
    @mode_code_type = 'enum',
    'ALTER TABLE shipment_modes MODIFY code VARCHAR(40) NOT NULL',
    'SELECT 1'
);
PREPARE mode_code_stmt FROM @mode_code_ddl;
EXECUTE mode_code_stmt;
DEALLOCATE PREPARE mode_code_stmt;

SET @shipment_mode_type = (
    SELECT DATA_TYPE
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'shipments'
      AND column_name = 'mode_of_shipment'
);
SET @shipment_mode_ddl = IF(
    @shipment_mode_type = 'enum',
    'ALTER TABLE shipments MODIFY mode_of_shipment VARCHAR(40) NOT NULL',
    'SELECT 1'
);
PREPARE shipment_mode_stmt FROM @shipment_mode_ddl;
EXECUTE shipment_mode_stmt;
DEALLOCATE PREPARE shipment_mode_stmt;

UPDATE shipment_modes
SET is_active = 0
WHERE LOWER(name) = 'others' OR code = 'OTHERS';

INSERT IGNORE INTO shipment_modes (name, code) VALUES
    ('Sea', 'SEA'),
    ('Air', 'AIR');

INSERT IGNORE INTO prw_statuses (name) VALUES
    ('PAID'),
    ('NOT PAID'),
    ('PARTIAL'),
    ('ADVANCE'),
    ('2 WAY'),
    ('SR DATE');
