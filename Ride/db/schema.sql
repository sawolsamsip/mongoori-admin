PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Admin
CREATE TABLE IF NOT EXISTS admin_user (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle (platform-based canonical vehicle table)
CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- External/platform identifiers
    platform_car_id TEXT NOT NULL,          -- Mongo Car._id
    vin TEXT,                               -- Tesla VIN
    tesla_vehicle_id TEXT,                  -- Tesla vehicle id
    plate_number TEXT,

    -- Display fields for management UI
    model TEXT,
    model_year INTEGER,
    trim TEXT,

    -- Platform state
    is_available INTEGER NOT NULL DEFAULT 0
        CHECK (is_available IN (0, 1)),
    platform_updated_at TEXT,

    -- Management lifecycle
    vehicle_status TEXT NOT NULL DEFAULT 'Active'
        CHECK (vehicle_status IN ('Active', 'Archived')),

    -- Sync metadata
    last_sync_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_platform_car_id
ON vehicle(platform_car_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_vin
ON vehicle(vin)
WHERE vin IS NOT NULL AND vin <> '';

CREATE INDEX IF NOT EXISTS idx_vehicle_status
ON vehicle(vehicle_status);

CREATE INDEX IF NOT EXISTS idx_vehicle_last_seen
ON vehicle(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_vehicle_plate_number
ON vehicle(plate_number);

CREATE INDEX IF NOT EXISTS idx_vehicle_is_available
ON vehicle(is_available);

-- Warranty
CREATE TABLE IF NOT EXISTS warranty_type (
    warranty_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('purchase', 'subscription')),
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS vehicle_warranty (
    vehicle_warranty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    warranty_type_id INTEGER NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('purchase', 'subscription')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE,

    FOREIGN KEY (warranty_type_id)
        REFERENCES warranty_type(warranty_type_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_warranty_vehicle
ON vehicle_warranty(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_warranty_type
ON vehicle_warranty(warranty_type_id);

CREATE TABLE IF NOT EXISTS warranty_purchase (
    vehicle_warranty_id INTEGER PRIMARY KEY,
    expire_date DATE,
    expire_miles INTEGER,

    FOREIGN KEY (vehicle_warranty_id)
        REFERENCES vehicle_warranty(vehicle_warranty_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warranty_subscription (
    vehicle_warranty_id INTEGER PRIMARY KEY,
    start_date DATE,
    end_date DATE,
    monthly_cost REAL,

    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),

    FOREIGN KEY (vehicle_warranty_id)
        REFERENCES vehicle_warranty(vehicle_warranty_id)
        ON DELETE CASCADE
);

-- Fleet
CREATE TABLE IF NOT EXISTS fleet_service (
    fleet_service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehicle_fleet (
    vehicle_fleet_id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehicle_id INTEGER NOT NULL,
    fleet_service_id INTEGER NOT NULL,

    registered_from DATE NOT NULL,
    registered_to DATE,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        registered_to IS NULL
        OR registered_to >= registered_from
    ),

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE RESTRICT,

    FOREIGN KEY (fleet_service_id)
        REFERENCES fleet_service(fleet_service_id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_active_fleet
ON vehicle_fleet(vehicle_id, fleet_service_id)
WHERE registered_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_fleet_vehicle
ON vehicle_fleet(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_fleet_service
ON vehicle_fleet(fleet_service_id);

-- Finance category
CREATE TABLE IF NOT EXISTS finance_management_category (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('cost', 'revenue')),
    scope TEXT NOT NULL
        CHECK (scope IN ('vehicle')),

    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS finance_operation_category (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('cost', 'revenue')),
    scope TEXT NOT NULL
        CHECK (scope IN ('vehicle', 'fleet', 'global')),

    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (name, scope)
);

-- Finance management transaction
CREATE TABLE IF NOT EXISTS finance_management_transaction (
    management_id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehicle_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,

    payment_type TEXT NOT NULL
        CHECK (payment_type IN ('one_time', 'monthly', 'installment')),

    event_date DATE NOT NULL,

    start_date DATE,
    end_date DATE,

    total_amount REAL,
    monthly_amount REAL,
    months INTEGER,

    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        start_date IS NULL
        OR end_date IS NULL
        OR end_date >= start_date
    ),

    CHECK (
        (payment_type = 'one_time' AND total_amount IS NOT NULL)
        OR
        (payment_type = 'monthly' AND monthly_amount IS NOT NULL AND start_date IS NOT NULL)
        OR
        (payment_type = 'installment' AND total_amount IS NOT NULL AND months IS NOT NULL AND start_date IS NOT NULL)
    ),

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE RESTRICT,

    FOREIGN KEY (category_id)
        REFERENCES finance_management_category(category_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mgmt_tx_vehicle_date
ON finance_management_transaction(vehicle_id, event_date);

CREATE INDEX IF NOT EXISTS idx_mgmt_tx_event_date
ON finance_management_transaction(event_date);

CREATE INDEX IF NOT EXISTS idx_mgmt_tx_category
ON finance_management_transaction(category_id);

-- Finance operation transaction
CREATE TABLE IF NOT EXISTS finance_operation_transaction (
    finance_id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehicle_id INTEGER,
    fleet_service_id INTEGER,
    category_id INTEGER NOT NULL,

    amount REAL NOT NULL,
    transaction_date DATE NOT NULL,

    note TEXT,
    reference_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE RESTRICT,

    FOREIGN KEY (fleet_service_id)
        REFERENCES fleet_service(fleet_service_id)
        ON DELETE RESTRICT,

    FOREIGN KEY (category_id)
        REFERENCES finance_operation_category(category_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_op_tx_vehicle
ON finance_operation_transaction(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_op_tx_fleet
ON finance_operation_transaction(fleet_service_id);

CREATE INDEX IF NOT EXISTS idx_op_tx_date
ON finance_operation_transaction(transaction_date);

CREATE INDEX IF NOT EXISTS idx_op_tx_category
ON finance_operation_transaction(category_id);