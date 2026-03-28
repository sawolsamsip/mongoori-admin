# Vehicle Managemnet Web System Documentation

## 1. System Overview
1.1 Purpose
This system is a web-based administrative platform designed for fleet and vehicle operations management. It provides integrated management of vehicles, warranties, fleet services, operational status, subscriptions, and maintenance workflows.

1.2 System Goals
- Vehicle-centric data management
- Operation-oriented system design
- History-based data modeling
- Admin-oriented user interface
- Scalable and extensible architecture

1.3 Target Users
- Fleet administrators
- Operations managers
- Maintenance managers
- System operators

## 2. System Architecture
2.1 Frontend (Admin Web UI)
- AdminLTE + Bootstrap 5
- DataTables-based management UI
- Modal-driven interaction model

2.2 Backend (API Server)
- Python Flask
- Blueprint-based modular architecture
- REST-style API design

2.3 Database
- SQLite
- WAL Mode enabled
- Normalized relational schema

## 3. Technology Stack
3.1 Backend
- Language: Python
- Framework: Flask
- Architecture: Blueprint modularization
- Authentication: Session-based authentication

3.2 Frontend
- HTML5
- Bootstrap 5
- AdminLTE
- Vanilla JavaScript
- DataTables

3.3 Database
- SQLite

## 4. Core Domain Model
4.1 Core Entities
- Vehicle
- Warranty
- FleetService
- Finance
- AdminUser

4.2 Domain Philosophy
- Vehicle-centric design
- State-based modeling
- Temporal data modeling

## 5. Database Architecture
5.1 Core Tables
- admin_user
- vehicle
- warranty_type
- vehicle_warranty
- warranty_purchase
- warranty_subscription
- fleet_service
- vehicle_fleet

5.2 Data Modeling Principles
- History-table separation
- Active-row constraint pattern
- Partial index usage
- State-consistency constraints

## 6. API Architecture
6.1 API Design Principles
- REST-style resource design
- Resource-oriented URL structure
- State-based endpoints
- Hierarchical routing model

6.2 Core API Groups
- /api/auth/*
- /api/vehicles/*
- /api/warranties/*
- /api/fleets/*
- /api/finance/*

## 7. Frontend Architecture
7.1 Page Structure
Vehicle Operation View
Operational UI focused on real-time status, fleet connections, and quick actions.

Vehicle Management View
Management UI focused on vehicle master data, warranty control, fleet registration, and structural configuration.

Supporting Pages
- Dashboard
- Fleet Management

7.2 UI Design Principles
Action-row based UX
Grouped table views
Modal-centered workflows
AJAX-based asynchronous operations

## 8. Business Logic Model
8.1 Vehicle Lifecycle
Registration → Operation → Maintenance → Deactivation → Archiving

8.2 Warranty Lifecycle
Registration → Active → Expiration/Termination → History retention

8.3 Fleet Lifecycle
Registration → Service linkage → Operation → Termination

## 9. Security Model
- Admin authentication system
- Hashed password storage
- Session-based authentication

## 10. Deployment Architecture
10.1 Deployment Flow
Environment configuration
Dependency installation
Database initialization
Server startup

## 11. Operations
11.1 Admin Operations
- Admin account management
- Vehicle operations management
11.2 Data Operations
- Data integrity validation

