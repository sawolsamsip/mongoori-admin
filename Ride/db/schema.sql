PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS admin_user (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT NOT NULL UNIQUE CHECK(length(vin) = 17),
    make TEXT,
    model TEXT,
    model_year INTEGER,
    trim TEXT,
    exterior TEXT,
    interior TEXT,
    plate_number TEXT,
    mileage INTEGER,
    software TEXT,

    vehicle_status TEXT NOT NULL 
        CHECK(vehicle_status IN ('Active', 'Maintenance', 'Archived')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warranty_type (
    warranty_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('purchase', 'subscription')),
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vehicle_warranty (
    vehicle_warranty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    warranty_type_id INTEGER NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('purchase', 'subscription')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(vehicle_id) REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY(warranty_type_id) REFERENCES warranty_type(warranty_type_id)
);

CREATE TABLE IF NOT EXISTS warranty_purchase (
    vehicle_warranty_id INTEGER PRIMARY KEY,
    expire_date DATE,
    expire_miles INTEGER,
    FOREIGN KEY(vehicle_warranty_id) REFERENCES vehicle_warranty(vehicle_warranty_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warranty_subscription (
    vehicle_warranty_id INTEGER PRIMARY KEY,
    start_date DATE,
    end_date DATE,
    monthly_cost REAL,
    FOREIGN KEY(vehicle_warranty_id) REFERENCES vehicle_warranty(vehicle_warranty_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS colors (
    color_id INTEGER PRIMARY KEY,
    color_name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS color_group (
    group_id INTEGER,
    color_id INTEGER,
    FOREIGN KEY(color_id) REFERENCES colors(color_id),
    UNIQUE(group_id, color_id)
);

CREATE TABLE IF NOT EXISTS model_year_trim_exterior (
    dyt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    trim_name TEXT NOT NULL,
    color_group INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    UNIQUE (model_name, "year", trim_name, color_group)
);

CREATE TABLE IF NOT EXISTS interior (
    interior_id INTEGER PRIMARY KEY AUTOINCREMENT,
    interior_name TEXT UNIQUE NOT NULL
);

-- Parking lots
CREATE TABLE IF NOT EXISTS parking_lot (
    parking_lot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,

    address_line1 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT,

    status TEXT NOT NULL
        CHECK (status IN ('active', 'inactive'))
        DEFAULT 'active',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,

    UNIQUE (address_line1, city, state)
);


CREATE TABLE IF NOT EXISTS vehicle_parking (
    vehicle_parking_id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehicle_id INTEGER NOT NULL,
    parking_lot_id INTEGER NOT NULL,

    parking_from DATE NOT NULL,
    parking_to   DATE,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id) ON DELETE RESTRICT,

    FOREIGN KEY (parking_lot_id)
        REFERENCES parking_lot(parking_lot_id) ON DELETE RESTRICT,

    CHECK (
        parking_to IS NULL
        OR parking_to >= parking_from
    )
);

CREATE UNIQUE INDEX uniq_vehicle_active_parking
ON vehicle_parking(vehicle_id)
WHERE parking_to IS NULL;

-- Operation location
CREATE TABLE IF NOT EXISTS vehicle_operation_location (
    vehicle_operation_location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    parking_lot_id INTEGER NOT NULL,
    active_from DATE NOT NULL,
    active_to DATE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id),
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lot(parking_lot_id),

    CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE UNIQUE INDEX uniq_vehicle_active_operation_location
ON vehicle_operation_location(vehicle_id)
WHERE active_to IS NULL;



-- Fleet
-- Fleet Service
CREATE TABLE fleet_service (
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

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE,

    FOREIGN KEY (fleet_service_id)
        REFERENCES fleet_service(fleet_service_id)
        ON DELETE RESTRICT,

    CHECK (
        registered_to IS NULL
        OR registered_to >= registered_from
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_active_fleet
ON vehicle_fleet(vehicle_id, fleet_service_id)
WHERE registered_to IS NULL;

-- Finance

-- finance_category
CREATE TABLE IF NOT EXISTS finance_management_category (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cost','revenue')),
    scope TEXT NOT NULL CHECK (scope IN ('vehicle')),

    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS finance_operation_category (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cost','revenue')),
    scope TEXT NOT NULL CHECK (scope IN ('vehicle','fleet','global')),

    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (name, scope)
);


-- finance_transaction
CREATE TABLE IF NOT EXISTS finance_management_transaction (
    management_id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehicle_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,

    payment_type TEXT NOT NULL
        CHECK (payment_type IN ('one_time','monthly','installment')),

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
        OR (payment_type = 'monthly' AND monthly_amount IS NOT NULL AND start_date IS NOT NULL)
        OR (payment_type = 'installment' AND total_amount IS NOT NULL AND months IS NOT NULL AND start_date IS NOT NULL)
    ),

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE,

    FOREIGN KEY (category_id)
        REFERENCES finance_management_category(category_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mgmt_tx_vehicle_date
ON finance_management_transaction(vehicle_id, event_date);

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


CREATE INDEX IF NOT EXISTS idx_tx_vehicle
ON finance_operation_transaction(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_tx_fleet
ON finance_operation_transaction(fleet_service_id);

CREATE INDEX IF NOT EXISTS idx_tx_date
ON finance_operation_transaction(transaction_date);

CREATE INDEX idx_mgmt_tx_date
ON finance_management_transaction(transaction_date);

CREATE INDEX idx_mgmt_contract_vehicle
ON finance_management_contract(vehicle_id);




-- V2 platform integration

CREATE TABLE IF NOT EXISTS vehicle_platform (
    vehicle_platform_id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identifiers
    platform_car_id TEXT NOT NULL,          -- Mongo Car._id
    vin TEXT,                               -- Tesla VIN
    tesla_vehicle_id TEXT,                  -- Tesla vehicle id

    -- Display (management UI)
    model TEXT,                            
    model_year INTEGER,                    
    trim TEXT,                              

    -- Rental availability (from platform)
    is_available INTEGER NOT NULL DEFAULT 0,     -- 0/1 from platform isAvaliable
    platform_updated_at TEXT,                    

    -- Management lifecycle
    vehicle_status TEXT NOT NULL DEFAULT 'Active'
        CHECK (vehicle_status IN ('Active','Archived')),

    -- Sync metadata
    last_sync_at TEXT NOT NULL,              
    last_seen_at TEXT NOT NULL,              

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_platform_platform_car_id
ON vehicle_platform(platform_car_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicle_platform_vin
ON vehicle_platform(vin)
WHERE vin IS NOT NULL AND vin <> '';

CREATE INDEX IF NOT EXISTS idx_vehicle_platform_status
ON vehicle_platform(vehicle_status);

CREATE INDEX IF NOT EXISTS idx_vehicle_platform_last_seen
ON vehicle_platform(last_seen_at);