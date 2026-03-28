# Database Schema Documentation

## 1. Design Philosophy

The database is designed using history-based and state-based modeling principles. Instead of overwriting state, all domain changes are recorded as time-based records.

**Core principles:**

* History-based modeling (temporal records)
* State control via time ranges (`*_from`, `*_to`)
* Soft-state management (no hard deletes for operational data)
* Partial index constraints for active-state enforcement
* Domain separation by business responsibility

This structure enables:

* Full auditability
* State recovery
* Temporal queries
* Safe system evolution

---

## 2. Core Domains

* **Identity Domain**: admin_user
* **Vehicle Domain**: core vehicle identity and metadata
* **Warranty Domain**: warranty classification and lifecycle
* **Fleet Domain**: external service integrations
* **Finance Domain**: cost/revenue tracking

---

## 3. Domain Structure

### Identity Domain

#### admin_user

Represents system administrators.

* Stores authentication credentials
* Passwords are stored as hashes
* Used for session-based authentication

---

### Vehicle Domain

#### vehicle

Core identity table for physical vehicles.

* Immutable identifier: VIN (unique)
* Represents physical vehicle entity
* Status is high-level lifecycle state (Active/Maintenance/Archived)

**Design notes:**

* Operational state is separated into history tables
* No direct operational logic stored here

#### model_year_trim_exterior

Represents model configuration mapping.

* Controls valid combinations of model/year/trim/exterior
* Uses `color_group` abstraction for normalization

#### colors

Master color dictionary table.

#### color_group

Color grouping abstraction layer.

* Allows logical grouping of multiple colors
* Prevents hard-coding color logic

#### interior

Interior configuration master table.

---

### Warranty Domain

#### warranty_type

Master table for warranty definitions.

* Separates purchase vs subscription warranties
* Controls UI ordering and activation

#### vehicle_warranty

Association table between vehicle and warranty type.

* Acts as warranty root entity
* Enables polymorphic structure

#### warranty_purchase

Subtype table for purchase warranties.

* Stores expiration date and mileage
* One-to-one with `vehicle_warranty`

#### warranty_subscription

Subtype table for subscription warranties.

* Stores time-range validity
* Stores monthly cost
* One-to-one with `vehicle_warranty`

**Design pattern:**
Polymorphic association model (base + subtype tables)

---

### Fleet Domain

#### fleet_service

Master table for external fleet services.

#### vehicle_fleet

Fleet registration history table.

* Time-range based registration
* `registered_to IS NULL` = active service connection

**Constraint logic:**

* Partial unique index prevents duplicate active registrations

---

### Finance Domain

#### finance_category

Finance classification table.

* Type: cost / revenue
* Scope: vehicle / fleet / global

#### finance_transaction

Core finance ledger table.

**Scope logic:**

* vehicle scope → vehicle_id required
* fleet scope → fleet_service_id required
* global scope → both NULL

**Design goals:**

* Unified ledger model
* Multi-scope accounting support
* Domain-independent finance structure

---

## 4. State & History Management Model

### Active Row Pattern

Current state is always represented by:

```text
*_to IS NULL
```

Historical records are preserved by closing time ranges instead of updating rows.

---

## 5. Data Update Rules

### Fleet Registration Change

1. Close current row (`registered_to = today`)
2. Insert new registration

---

## 6. Referential Integrity Policy

* **CASCADE**: Used for pure ownership relations
* **RESTRICT**: Used for operational safety

**Design principle:**
Prevent destructive cascades on operational data

---

## 7. Maintenance Guidelines

* Schema changes must preserve history integrity
* No deletion of history tables
* Always extend, never overwrite
* New states should use time-range modeling

---

## 8. Migration Policy

* Backward-compatible changes only
* Additive schema evolution
* No destructive column removal

---

## 9. Operational Safety Rules

* Never update active rows directly
* Always close previous state
* Always insert new state
* Maintain historical continuity

---

## 10. Design Summary

This database is designed as a **temporal system**, not a CRUD system.

Core properties:

* History-first modeling
* State consistency
* Operational safety
* Auditability
* Scalability

The schema prioritizes long-term maintainability, traceability, and system evolution over short-term simplicity.
