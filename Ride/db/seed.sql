-- WARRANTY TYPES for loading in web-page
INSERT INTO warranty_type (type_name, display_name, category, sort_order) VALUES
('Basic Vehicle Limited Warranty', 'Basic Vehicle', 'purchase', 1),
('Supplemental Restraint System Warranty', 'SRS Warranty', 'purchase', 2),
('Battery and Drive Unit Limited Warranty', 'Battery & Drive Unit', 'purchase', 3),
('Body Rust Limited Warranty', 'Rust Warranty', 'purchase', 4),
('ZEV Defect Warranty', 'ZEV Defect', 'purchase', 5),
('ZEV Performance Warranty', 'ZEV Performance.', 'purchase', 6),
('ZEV Long-Term Emission Parts Warranty', 'ZEV Emission', 'purchase', 7),
('High-Priced Propulsion-Related Parts ZEV Warranty', 'PRP ZEV', 'purchase', 8),
('Pre-Owned Vehicle Limited Warranty', 'CPO Warranty', 'purchase', 9),
('Parts, Body and Paint Repair Warranty', 'Parts & Paint', 'purchase', 10),
('Extended Service Agreement', 'Extended Service', 'subscription', 11);

-- Fleet Service
INSERT OR IGNORE INTO fleet_service (name) VALUES
('Mongoori'),
('ZEVO');


-- Finance Category

-- Finance Management Categories (COST)
INSERT INTO finance_management_category (name, type, scope, description) VALUES
('Vehicle Purchase Price', 'cost', 'vehicle', 'Base vehicle purchase price'),
('Dealer Fee',             'cost', 'vehicle', 'Dealer or documentation fee'),
('Sales Tax',              'cost', 'vehicle', 'Vehicle purchase sales tax'),
('Registration Fee',       'cost', 'vehicle', 'DMV registration and title fee'),
('Personal Insurance',     'cost', 'vehicle', 'Personal vehicle insurance premium'),
('Loan Interest',          'cost', 'vehicle', 'Interest paid for vehicle financing'),
('Other Cost',             'cost', 'vehicle', 'Uncategorized ownership-related cost');

-- Finance Management Categories (REVENUE)
INSERT INTO finance_management_category (name, type, scope, description) VALUES
('Vehicle Sale',           'revenue', 'vehicle', 'Revenue from selling the vehicle'),
('Other Revenue',          'revenue', 'vehicle', 'Uncategorized ownership-related revenue');



-- Finance Operation Categories (COST)
INSERT INTO finance_operation_category (name, type, scope, description) VALUES
('Platform Registration Fee', 'cost', 'vehicle', 'Platform registration or onboarding fee'),
('Platform Service Fee',      'cost', 'vehicle', 'Platform commission or service fee'),
('Platform Insurance',        'cost', 'vehicle', 'Insurance provided by rental platform'),
('Maintenance',               'cost', 'vehicle', 'Vehicle maintenance and repair'),
('Cleaning',                  'cost', 'vehicle', 'Cleaning and detailing cost'),
('Accident Deductible',       'cost', 'vehicle', 'Deductible paid due to accident'),
('Parking Fee',               'cost', 'vehicle', 'Parking or storage cost'),
('Toll',                      'cost', 'vehicle', 'Toll charges during operation'),
('Other Cost',                'cost', 'vehicle', 'Uncategorized operating cost');

-- Finance Operation Categories (REVENUE)

INSERT INTO finance_operation_category (name, type, scope, description) VALUES
('Rental Revenue',          'revenue', 'vehicle', 'Revenue generated from vehicle rental'),
('Other Revenue',           'revenue', 'vehicle', 'Uncategorized operating revenue');
