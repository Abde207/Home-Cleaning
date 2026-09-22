# Home Clean App — UML System Design
## Version 1 — Initial UML Architecture

This document converts the current Home Clean App product concept into a UML-oriented system design. It is based on the current product concept and decisions reached during the design discussion.

---

# 1. System Scope

Home Clean is a cleaning-service marketplace and dispatch platform initially targeting Amman, Jordan.

The platform has three primary interfaces:

1. Customer Mobile App — Android/iOS
2. Provider App — used by cleaning companies and their teams
3. Admin Web Dashboard — used by Home Clean operations staff

All three communicate through the Home Clean Backend/API.

Core business flow:

Customer → Home Clean → Dispatch → Cleaning Company/Team → Customer

The customer relationship remains with Home Clean. Cleaning companies operate behind the platform.

---

# 2. Actors

## Primary Actors

- Customer
- Company Manager
- Team Leader / Cleaner
- Home Clean Admin
- Dispatcher / Operations Staff
- Payment Gateway
- Maps/Location Provider
- Notification Service

## Actor Relationship

```plantuml
@startuml
left to right direction

actor Customer
actor "Company Manager" as CompanyManager
actor "Team Leader / Cleaner" as Cleaner
actor "Home Clean Admin" as Admin
actor Dispatcher
actor "Payment Gateway" as Payment
actor "Maps Provider" as Maps
actor "Notification Service" as Notifications

rectangle "Home Clean Platform" {
}

Customer --> "Home Clean Platform"
CompanyManager --> "Home Clean Platform"
Cleaner --> "Home Clean Platform"
Admin --> "Home Clean Platform"
Dispatcher --> "Home Clean Platform"

"Home Clean Platform" --> Payment
"Home Clean Platform" --> Maps
"Home Clean Platform" --> Notifications
@enduml
```

---

# 3. System Context Diagram

```plantuml
@startuml
left to right direction

actor Customer
actor "Company Manager" as Company
actor "Team Leader / Cleaner" as Team
actor "Home Clean Admin / Dispatcher" as Admin

rectangle "Home Clean Platform" as Platform
rectangle "Payment Gateway" as PG
rectangle "Maps / Location Provider" as Maps
rectangle "Push Notification Service" as FCM

Customer --> Platform : Book / Pay / Track
Company --> Platform : Receive / Manage jobs
Team --> Platform : Accept / Start / Complete
Admin --> Platform : Operate / Dispatch / Manage

Platform --> PG : Online payments / refunds
Platform --> Maps : Location / distance / navigation data
Platform --> FCM : Push notifications

@enduml
```

---

# 4. High-Level Component Diagram

```plantuml
@startuml
skinparam componentStyle rectangle

package "Client Applications" {
  [Customer Mobile App] as CustomerApp
  [Provider App] as ProviderApp
  [Admin Web Dashboard] as AdminApp
}

package "Home Clean Backend" {
  [API Gateway / REST API] as API
  [Authentication Module] as Auth
  [Customer Module] as Customer
  [Company Module] as Company
  [Team Module] as Team
  [Service Module] as Service
  [Pricing Engine] as Pricing
  [Booking Engine] as Booking
  [Dispatch Engine] as Dispatch
  [Payment Module] as Payments
  [Settlement Module] as Settlement
  [Notification Module] as Notification
  [Location Module] as Location
  [Reporting Module] as Reporting
}

database "PostgreSQL" as DB

cloud "Payment Gateway" as PG
cloud "Maps Provider" as Maps
cloud "Push Notification Service" as FCM

CustomerApp --> API
ProviderApp --> API
AdminApp --> API

API --> Auth
API --> Customer
API --> Company
API --> Team
API --> Service
API --> Pricing
API --> Booking
API --> Dispatch
API --> Payments
API --> Settlement
API --> Notification
API --> Location
API --> Reporting

Auth --> DB
Customer --> DB
Company --> DB
Team --> DB
Service --> DB
Pricing --> DB
Booking --> DB
Dispatch --> DB
Payments --> DB
Settlement --> DB
Reporting --> DB

Payments --> PG
Location --> Maps
Notification --> FCM
@enduml
```

---

# 5. Deployment Diagram

Target architecture:

```plantuml
@startuml

node "Customer Device" {
  artifact "Home Clean Customer App"
}

node "Provider Device" {
  artifact "Home Clean Provider App"
}

node "Admin Browser" {
  artifact "Home Clean Admin Dashboard"
}

cloud "Internet" as Internet

node "Cloud Application" {
  node "API / Backend" {
    artifact "Backend Services"
  }

  database "PostgreSQL" as DB
}

cloud "External Services" {
  artifact "Payment Gateway"
  artifact "Maps Provider"
  artifact "Push Notifications"
}

"Home Clean Customer App" --> Internet
"Home Clean Provider App" --> Internet
"Home Clean Admin Dashboard" --> Internet

Internet --> "Backend Services"

"Backend Services" --> DB
"Backend Services" --> "Payment Gateway"
"Backend Services" --> "Maps Provider"
"Backend Services" --> "Push Notifications"

@enduml
```

---

# 6. Customer Use Case Diagram

```plantuml
@startuml
left to right direction

actor Customer

rectangle "Customer App" {
  usecase "Register / Login" as UC1
  usecase "Manage Profile" as UC2
  usecase "Manage Addresses" as UC3
  usecase "Browse Services" as UC4
  usecase "Enter Property Details" as UC5
  usecase "Select Date & Time" as UC6
  usecase "Calculate / Review Price" as UC7
  usecase "Choose Payment Method" as UC8
  usecase "Confirm Booking" as UC9
  usecase "Track Booking" as UC10
  usecase "Receive Notifications" as UC11
  usecase "View Booking History" as UC12
  usecase "View Payment History" as UC13
  usecase "Rate Completed Service" as UC14
  usecase "Cancel Booking" as UC15
}

Customer --> UC1
Customer --> UC2
Customer --> UC3
Customer --> UC4
Customer --> UC5
Customer --> UC6
Customer --> UC7
Customer --> UC8
Customer --> UC9
Customer --> UC10
Customer --> UC11
Customer --> UC12
Customer --> UC13
Customer --> UC14
Customer --> UC15

@enduml
```

---

# 7. Provider App Use Case Diagram

The Provider App is intentionally separated from the Admin Dashboard.

A Company Manager can manage the company and its teams. A Team Leader/Cleaner sees operational jobs assigned to their team.

```plantuml
@startuml
left to right direction

actor "Company Manager" as Manager
actor "Team Leader / Cleaner" as Cleaner

rectangle "Provider App" {
  usecase "Login" as P1
  usecase "View Incoming Jobs" as P2
  usecase "View Job Details" as P3
  usecase "Accept Job" as P4
  usecase "Reject Job" as P5
  usecase "View Schedule" as P6
  usecase "Manage Team Availability" as P7
  usecase "View Assigned Jobs" as P8
  usecase "Navigate to Customer" as P9
  usecase "Start Cleaning" as P10
  usecase "Complete Cleaning" as P11
  usecase "Submit Completion Proof" as P12
  usecase "View Company Earnings" as P13
  usecase "View Settlement History" as P14
  usecase "Manage Teams" as P15
}

Manager --> P1
Manager --> P2
Manager --> P3
Manager --> P4
Manager --> P5
Manager --> P6
Manager --> P7
Manager --> P13
Manager --> P14
Manager --> P15

Cleaner --> P1
Cleaner --> P3
Cleaner --> P4
Cleaner --> P5
Cleaner --> P6
Cleaner --> P7
Cleaner --> P8
Cleaner --> P9
Cleaner --> P10
Cleaner --> P11
Cleaner --> P12

@enduml
```

---

# 8. Admin Dashboard Use Case Diagram

```plantuml
@startuml
left to right direction

actor "Home Clean Admin" as Admin
actor Dispatcher

rectangle "Admin Dashboard" {
  usecase "Manage Customers" as A1
  usecase "Manage Companies" as A2
  usecase "Manage Teams" as A3
  usecase "Manage Services" as A4
  usecase "Manage Pricing" as A5
  usecase "View Bookings" as A6
  usecase "Validate Booking" as A7
  usecase "Assign Team Manually" as A8
  usecase "Monitor Dispatch" as A9
  usecase "Manage Payments" as A10
  usecase "Manage Cash Settlements" as A11
  usecase "Manage Refunds" as A12
  usecase "View Reports" as A13
  usecase "View Company Performance" as A14
  usecase "Manage Promotions" as A15
}

Admin --> A1
Admin --> A2
Admin --> A3
Admin --> A4
Admin --> A5
Admin --> A6
Admin --> A7
Admin --> A8
Admin --> A9
Admin --> A10
Admin --> A11
Admin --> A12
Admin --> A13
Admin --> A14
Admin --> A15

Dispatcher --> A6
Dispatcher --> A7
Dispatcher --> A8
Dispatcher --> A9

@enduml
```

---

# 9. Core Domain Class Diagram

This is the initial domain model. It should become the basis for the database ERD later.

```plantuml
@startuml

class User {
  +id: UUID
  +phone: String
  +name: String
  +status: UserStatus
}

class Customer {
  +id: UUID
  +userId: UUID
}

class Company {
  +id: UUID
  +internalCode: String
  +name: String
  +status: CompanyStatus
  +commissionRate: Decimal
}

class Team {
  +id: UUID
  +companyId: UUID
  +internalCode: String
  +status: TeamStatus
  +currentLocation: Location
}

class TeamMember {
  +id: UUID
  +teamId: UUID
  +name: String
  +role: String
}

class Service {
  +id: UUID
  +name: String
  +description: String
  +active: Boolean
}

class Property {
  +id: UUID
  +customerId: UUID
  +type: PropertyType
  +size: Decimal
  +rooms: Integer
  +bathrooms: Integer
}

class Address {
  +id: UUID
  +customerId: UUID
  +label: String
  +addressText: String
  +latitude: Decimal
  +longitude: Decimal
}

class Booking {
  +id: UUID
  +bookingNumber: String
  +customerId: UUID
  +serviceId: UUID
  +propertyId: UUID
  +addressId: UUID
  +scheduledAt: DateTime
  +price: Decimal
  +status: BookingStatus
  +paymentMethod: PaymentMethod
}

class BookingExtra {
  +id: UUID
  +bookingId: UUID
  +name: String
  +price: Decimal
}

class Assignment {
  +id: UUID
  +bookingId: UUID
  +companyId: UUID
  +teamId: UUID
  +assignedAt: DateTime
  +acceptedAt: DateTime
  +status: AssignmentStatus
}

class Payment {
  +id: UUID
  +bookingId: UUID
  +method: PaymentMethod
  +amount: Decimal
  +status: PaymentStatus
  +transactionReference: String
}

class Settlement {
  +id: UUID
  +companyId: UUID
  +bookingId: UUID
  +companyAmount: Decimal
  +platformCommission: Decimal
  +cashCollected: Decimal
  +amountOwed: Decimal
  +status: SettlementStatus
}

class Notification {
  +id: UUID
  +userId: UUID
  +bookingId: UUID
  +type: String
  +status: String
}

User "1" -- "0..1" Customer
Company "1" -- "1..*" Team
Team "1" -- "1..*" TeamMember
Customer "1" -- "0..*" Property
Customer "1" -- "0..*" Address
Customer "1" -- "0..*" Booking
Service "1" -- "0..*" Booking
Property "1" -- "0..*" Booking
Address "1" -- "0..*" Booking
Booking "1" -- "0..*" BookingExtra
Booking "1" -- "0..*" Assignment
Company "1" -- "0..*" Assignment
Team "1" -- "0..*" Assignment
Booking "1" -- "0..*" Payment
Company "1" -- "0..*" Settlement
Booking "1" -- "0..1" Settlement
Booking "1" -- "0..*" Notification

@enduml
```

---

# 10. Booking Sequence Diagram

Normal booking flow:

```plantuml
@startuml

actor Customer
participant "Customer App" as App
participant "Backend API" as API
participant "Pricing Engine" as Pricing
participant "Payment Module" as Pay
participant "Dispatch Engine" as Dispatch
participant "Provider App" as Provider
participant "Notification Service" as Notify

Customer -> App: Enter booking details
App -> API: Create booking request
API -> Pricing: Calculate price
Pricing --> API: Final price
API --> App: Display price

Customer -> App: Select payment method
App -> API: Confirm booking

alt Online Payment
  API -> Pay: Create payment
  Pay --> API: Payment confirmed
else Cash
  API -> Pay: Record cash payment method
  Pay --> API: Cash selected
end

API -> Dispatch: Find eligible teams
Dispatch -> Dispatch: Rank available teams
Dispatch --> API: Selected team

API -> Provider: Send job offer
Provider --> API: Accept job

API -> Notify: Notify customer
Notify --> Customer: Team assigned

API --> App: Booking confirmed

@enduml
```

---

# 11. Provider Job Sequence Diagram

```plantuml
@startuml

participant "Dispatch Engine" as Dispatch
participant "Provider App" as App
actor "Team Leader" as Team
participant "Backend" as API
participant "Customer App" as Customer

Dispatch -> App: New job offer
App -> Team: Show job
Team -> App: Accept
App -> API: Accept assignment

API -> Customer: Team assigned
Customer --> API: Receive status

Team -> App: Start navigation
App -> API: Team on the way
API -> Customer: Team on the way

Team -> App: Start cleaning
App -> API: Cleaning started
API -> Customer: Cleaning started

Team -> App: Complete cleaning
App -> API: Cleaning completed
API -> Customer: Cleaning completed

@enduml
```

---

# 12. Booking State Machine

```plantuml
@startuml

[*] --> REQUESTED

REQUESTED --> PRICE_CONFIRMED
PRICE_CONFIRMED --> PAYMENT_PENDING : Online
PRICE_CONFIRMED --> CASH_SELECTED : Cash

PAYMENT_PENDING --> PAYMENT_CONFIRMED
CASH_SELECTED --> PAYMENT_CONFIRMED

PAYMENT_CONFIRMED --> SEARCHING_FOR_TEAM

SEARCHING_FOR_TEAM --> TEAM_ASSIGNED
SEARCHING_FOR_TEAM --> NO_TEAM_AVAILABLE

TEAM_ASSIGNED --> TEAM_ACCEPTED
TEAM_ASSIGNED --> REJECTED

TEAM_ACCEPTED --> TEAM_ON_THE_WAY
TEAM_ON_THE_WAY --> CLEANING_STARTED
CLEANING_STARTED --> CLEANING_COMPLETED

CLEANING_COMPLETED --> PAYMENT_RECONCILIATION
PAYMENT_RECONCILIATION --> COMPLETED

REQUESTED --> CANCELLED
PRICE_CONFIRMED --> CANCELLED
PAYMENT_PENDING --> CANCELLED
TEAM_ASSIGNED --> CANCELLED

CLEANING_STARTED --> CUSTOMER_NO_SHOW
TEAM_ON_THE_WAY --> TEAM_NO_SHOW

PAYMENT_RECONCILIATION --> REFUND_PENDING
REFUND_PENDING --> REFUNDED

NO_TEAM_AVAILABLE --> [*]
REJECTED --> SEARCHING_FOR_TEAM
CANCELLED --> [*]
CUSTOMER_NO_SHOW --> [*]
TEAM_NO_SHOW --> SEARCHING_FOR_TEAM
REFUNDED --> [*]
COMPLETED --> [*]

@enduml
```

---

# 13. Automatic Dispatch Sequence

```plantuml
@startuml

actor Customer
participant "Backend" as API
participant "Dispatch Engine" as Dispatch
participant "Location Service" as Location
database "Database" as DB
participant "Provider App" as Provider

Customer -> API: Confirm booking

API -> Dispatch: Find team

Dispatch -> DB: Get active teams
DB --> Dispatch: Candidate teams

Dispatch -> Location: Calculate distance/travel time
Location --> Dispatch: Distance / ETA

Dispatch -> Dispatch: Filter eligibility
Dispatch -> Dispatch: Calculate assignment score
Dispatch -> Dispatch: Rank teams

Dispatch -> DB: Create assignment
Dispatch -> Provider: Send job offer

alt Team accepts
  Provider --> Dispatch: Accepted
  Dispatch -> DB: Update assignment
  Dispatch --> API: Team assigned
else Team rejects
  Provider --> Dispatch: Rejected
  Dispatch -> Dispatch: Select next team
end

API --> Customer: Assignment status

@enduml
```

---

# 14. Payment Sequence

```plantuml
@startuml

actor Customer
participant "Customer App" as App
participant "Backend" as API
participant "Payment Module" as Payment
participant "Payment Gateway" as Gateway
database "Database" as DB

Customer -> App: Select Online Payment
App -> API: Confirm booking
API -> Payment: Create payment

Payment -> Gateway: Create payment transaction
Gateway --> Payment: Payment result

alt Successful
  Payment -> DB: Record successful payment
  Payment --> API: Payment confirmed
  API --> App: Booking confirmed
else Failed
  Payment -> DB: Record failed payment
  Payment --> API: Payment failed
  API --> App: Request retry
end

@enduml
```

---

# 15. Cash Payment Sequence

```plantuml
@startuml

actor Customer
participant "Customer App" as App
participant "Backend" as API
participant "Provider App" as Provider
participant "Settlement Module" as Settlement
database "Database" as DB

Customer -> App: Select Cash
App -> API: Confirm booking
API -> DB: Record CASH payment method

API -> Provider: Assign job
Provider -> Customer: Perform cleaning
Customer -> Provider: Pay cash

Provider -> API: Mark cash collected
API -> Settlement: Calculate company/platform amounts
Settlement -> DB: Record settlement

@enduml
```

---

# 16. Settlement Class/Process Diagram

```plantuml
@startuml

class Booking {
  price: Decimal
  paymentMethod: PaymentMethod
}

class Company {
  commissionRate: Decimal
}

class Payment {
  amount: Decimal
  method: PaymentMethod
}

class Settlement {
  companyAmount: Decimal
  platformCommission: Decimal
  cashCollected: Decimal
  amountOwed: Decimal
  status: SettlementStatus
}

Booking --> Payment
Booking --> Settlement
Company --> Settlement

note right of Settlement
Online:
Customer pays platform.
Company amount and commission
are calculated automatically.

Cash:
Customer pays team/company.
Platform tracks the amount owed
according to contract terms.
end note

@enduml
```

---

# 17. Company / Team Structure

```plantuml
@startuml

class Company {
  companyId
  companyName
  internalCode
  serviceAreas
  commissionRate
  status
}

class Team {
  teamId
  internalCode
  status
  currentLocation
  capacity
  capabilities
}

class TeamMember {
  memberId
  name
  role
  status
}

Company "1" *-- "1..*" Team
Team "1" *-- "1..*" TeamMember

@enduml
```

---

# 18. Customer Visibility vs Internal Data

A major architectural rule is that provider identity and internal business data are not exposed unnecessarily to customers.

```plantuml
@startuml

rectangle "Customer View" {
  card "Booking #58291"
  card "Deep Cleaning"
  card "14 Sep — 4:00 PM"
  card "Your cleaning team is assigned"
  card "Arrival ETA"
}

rectangle "Internal Platform Data" {
  card "Company CLN-00127"
  card "Team CLN-00127-T01"
  card "Commission"
  card "Contract Terms"
  card "Settlement Data"
  card "Assignment Score"
}

"Customer View" ..> "Internal Platform Data" : controlled projection

@enduml
```

---

# 19. Main Data Relationships

```plantuml
@startuml

entity CUSTOMER
entity ADDRESS
entity PROPERTY
entity BOOKING
entity SERVICE
entity BOOKING_EXTRA
entity ASSIGNMENT
entity COMPANY
entity TEAM
entity PAYMENT
entity SETTLEMENT

CUSTOMER ||--o{ ADDRESS
CUSTOMER ||--o{ PROPERTY
CUSTOMER ||--o{ BOOKING

SERVICE ||--o{ BOOKING
PROPERTY ||--o{ BOOKING
ADDRESS ||--o{ BOOKING

BOOKING ||--o{ BOOKING_EXTRA
BOOKING ||--o{ ASSIGNMENT
BOOKING ||--o{ PAYMENT
BOOKING ||--o| SETTLEMENT

COMPANY ||--o{ TEAM
COMPANY ||--o{ ASSIGNMENT
COMPANY ||--o{ SETTLEMENT

TEAM ||--o{ ASSIGNMENT

@enduml
```

---

# 20. Recommended Interface Structure

## Customer App

```text
Home
├── Book Cleaning
├── Upcoming Booking
├── Booking History
├── Promotions
└── Profile

Booking Flow
├── Service
├── Property
├── Extras
├── Date & Time
├── Location
├── Price
└── Payment

Active Booking
├── Status
├── Team Assigned
├── ETA
└── Tracking
```

## Provider App

```text
Dashboard
├── Incoming Jobs
├── Today's Jobs
├── Active Job
└── Completed Jobs

Job
├── Details
├── Location
├── Navigation
├── Accept / Reject
├── Start
└── Complete

Company Manager
├── Teams
├── Schedule
├── Earnings
└── Settlements
```

## Admin Dashboard

```text
Dashboard
├── Operations Overview
├── Bookings
├── Customers
├── Companies
├── Teams
├── Services
├── Pricing
├── Dispatch
├── Payments
├── Settlements
├── Promotions
└── Reports
```

---

# 21. Core Architecture Decision

The Provider App should be a first-class part of the architecture.

The recommended MVP structure is:

```text
Customer App
      │
      ▼
Backend
      │
      ├──────────────► Admin Dashboard
      │
      └──────────────► Provider App
                            │
                    ┌───────┴───────┐
                    ▼               ▼
              Company Manager   Team Leader
```

A single Provider App can use role-based permissions rather than creating separate Company and Cleaner applications initially.

---

# 22. UML Diagram Inventory

The project should eventually contain these diagrams:

### Architecture
- System Context Diagram
- Component Diagram
- Deployment Diagram

### Requirements
- Customer Use Case Diagram
- Provider Use Case Diagram
- Admin Use Case Diagram

### Domain / Data
- Domain Class Diagram
- Database ER Diagram
- Company-Team Relationship Diagram
- Payment/Settlement Model

### Behavior
- Booking Sequence Diagram
- Provider Job Sequence Diagram
- Dispatch Sequence Diagram
- Online Payment Sequence Diagram
- Cash Payment Sequence Diagram
- Booking State Machine

### Future / Detailed
- Notification Sequence
- Cancellation/Refund Sequence
- Authentication/OTP Sequence
- Rating Sequence
- Recurring Booking Sequence
- Live Tracking Sequence
- Admin Manual Assignment Sequence
- Automatic Dispatch Algorithm Activity Diagram

---

# 23. Next UML Work

The next design iteration should expand this document with:

1. Detailed database ERD with every table and field
2. Complete API/component interaction diagram
3. Authentication and OTP sequence
4. Detailed pricing engine activity diagram
5. Detailed automatic dispatch activity diagram
6. Cancellation and refund state/sequence diagrams
7. Notification architecture
8. Role and permission matrix
9. Complete provider workflow
10. Complete customer booking workflow
11. Admin operational workflow
12. Full MVP-to-production architecture

This UML document should remain the living architecture reference for the Home Clean project.

---

# PHASE 2 — DATA MODEL & DATABASE UML

## 24. Phase 2 Objective

Phase 2 defines the core data model behind Home Clean.

The model covers:
- Users and customers
- Companies and teams
- Team members
- Services and service extras
- Customer properties and addresses
- Bookings
- Booking extras
- Assignments
- Payments
- Settlements
- Notifications

The database must support the booking lifecycle, provider workflow, dispatch engine, payment flow, cash reconciliation, and admin operations.

## 25. Database ERD

```plantuml
@startuml
hide methods
hide stereotypes
skinparam linetype ortho

entity users {
  * id : UUID <<PK>>
  --
  phone : VARCHAR
  name : VARCHAR
  status : VARCHAR
  created_at : TIMESTAMP
  updated_at : TIMESTAMP
}
entity customers {
  * id : UUID <<PK>>
  --
  user_id : UUID <<FK>>
}
entity companies {
  * id : UUID <<PK>>
  --
  internal_code : VARCHAR <<UNIQUE>>
  name : VARCHAR
  status : VARCHAR
  commission_rate : DECIMAL
  created_at : TIMESTAMP
  updated_at : TIMESTAMP
}
entity teams {
  * id : UUID <<PK>>
  --
  company_id : UUID <<FK>>
  internal_code : VARCHAR <<UNIQUE>>
  status : VARCHAR
  latitude : DECIMAL
  longitude : DECIMAL
  capacity : INTEGER
  current_booking_id : UUID
}
entity team_members {
  * id : UUID <<PK>>
  --
  team_id : UUID <<FK>>
  name : VARCHAR
  role : VARCHAR
  status : VARCHAR
}
entity services {
  * id : UUID <<PK>>
  --
  name : VARCHAR
  description : TEXT
  active : BOOLEAN
}
entity properties {
  * id : UUID <<PK>>
  --
  customer_id : UUID <<FK>>
  type : VARCHAR
  size : DECIMAL
  rooms : INTEGER
  bathrooms : INTEGER
}
entity addresses {
  * id : UUID <<PK>>
  --
  customer_id : UUID <<FK>>
  label : VARCHAR
  address_text : TEXT
  latitude : DECIMAL
  longitude : DECIMAL
}
entity bookings {
  * id : UUID <<PK>>
  --
  booking_number : VARCHAR <<UNIQUE>>
  customer_id : UUID <<FK>>
  service_id : UUID <<FK>>
  property_id : UUID <<FK>>
  address_id : UUID <<FK>>
  scheduled_at : TIMESTAMP
  price : DECIMAL
  status : VARCHAR
  payment_method : VARCHAR
  created_at : TIMESTAMP
  updated_at : TIMESTAMP
}
entity booking_extras {
  * id : UUID <<PK>>
  --
  booking_id : UUID <<FK>>
  name : VARCHAR
  price : DECIMAL
}
entity assignments {
  * id : UUID <<PK>>
  --
  booking_id : UUID <<FK>>
  company_id : UUID <<FK>>
  team_id : UUID <<FK>>
  assigned_at : TIMESTAMP
  accepted_at : TIMESTAMP
  status : VARCHAR
}
entity payments {
  * id : UUID <<PK>>
  --
  booking_id : UUID <<FK>>
  method : VARCHAR
  amount : DECIMAL
  status : VARCHAR
  transaction_reference : VARCHAR
  created_at : TIMESTAMP
}
entity settlements {
  * id : UUID <<PK>>
  --
  company_id : UUID <<FK>>
  booking_id : UUID <<FK>>
  company_amount : DECIMAL
  platform_commission : DECIMAL
  cash_collected : DECIMAL
  amount_owed : DECIMAL
  status : VARCHAR
  created_at : TIMESTAMP
}
entity notifications {
  * id : UUID <<PK>>
  --
  user_id : UUID <<FK>>
  booking_id : UUID <<FK>>
  type : VARCHAR
  status : VARCHAR
  created_at : TIMESTAMP
}

users ||--o| customers
customers ||--o{ addresses
customers ||--o{ properties
customers ||--o{ bookings
companies ||--o{ teams
teams ||--o{ team_members
services ||--o{ bookings
properties ||--o{ bookings
addresses ||--o{ bookings
bookings ||--o{ booking_extras
bookings ||--o{ assignments
companies ||--o{ assignments
teams ||--o{ assignments
bookings ||--o{ payments
companies ||--o{ settlements
bookings ||--o| settlements
users ||--o{ notifications
bookings ||--o{ notifications
@enduml
```

## 26. Core Relationship Rules

- User authentication identity is separated from customer business data.
- A customer can have many addresses and properties.
- A company can have many teams.
- A team can have many team members.
- A booking references one customer, service, property, and service address.
- A booking can have multiple extras.
- Assignment is separate from booking to preserve dispatch/reassignment history.
- A booking can have payment records.
- A completed booking can produce a company settlement record.
- Notifications can reference both a recipient user and a booking.

## 27. Booking-Centric Model

```text
CUSTOMER
   |
   v
BOOKING
   |---- SERVICE
   |---- PROPERTY
   |---- ADDRESS
   |---- BOOKING_EXTRAS
   |
   +---- ASSIGNMENTS ---- COMPANY ---- TEAM ---- TEAM_MEMBER
   |
   +---- PAYMENTS
   |
   +---- SETTLEMENT
```

## 28. Assignment History

Assignments should be historical records rather than a single field on Booking. This supports rejection and reassignment:

```text
Booking #58291
  |
  +-- Assignment 1: Team A -> REJECTED
  +-- Assignment 2: Team B -> REJECTED
  +-- Assignment 3: Team C -> ACCEPTED
```

## 29. Financial Separation

```text
BOOKING
  |
  +-- PAYMENT       = money collected / payment transaction
  |
  +-- SETTLEMENT    = company amount, platform commission,
                      cash reconciliation and amount owed
```

## 30. Provider Data Isolation

Provider access must be scoped by role and ownership:

- Team Leader/Cleaner: assigned team/jobs only.
- Company Manager: company jobs, teams, schedules and financial views permitted to the company.
- Dispatcher: operational booking and dispatch information.
- Home Clean Admin: platform-wide operational and financial administration.

The backend authorization layer must enforce these boundaries rather than relying on the mobile/web UI.

## 31. Recommended Database Constraints

Initial constraints to finalize during implementation:

- Unique company internal code.
- Unique team internal code.
- Unique booking number.
- Foreign keys on all relationships.
- Non-negative monetary values.
- Valid booking, assignment, payment and settlement statuses.
- A team cannot have conflicting active assignments.
- A booking cannot have more than one active assignment at the same time.
- Provider users cannot query records outside their permitted company/team scope.
- Customer addresses used by a booking must belong to that customer.

## 32. Phase 2 Design Decisions

1. Booking is the central operational entity.
2. Assignment is separate from Booking to preserve dispatch history.
3. Company and Team are separate entities.
4. Customer Address and Property are separate entities.
5. Payment and Settlement are separate financial concepts.
6. Provider access is role- and scope-based.

## 33. Next Data-Model Work

Before database implementation, expand the ERD into a production schema covering:

1. Exact columns and data types
2. Primary and foreign keys
3. Indexes
4. Status/enumeration definitions
5. Audit fields
6. Soft deletion strategy
7. Assignment history
8. Payment transaction history
9. Settlement batches
10. User/provider role mapping
11. Service-area mapping
12. Team availability records
13. Pricing rules
14. Booking price snapshots

---

# PHASE 3 — BOOKING BEHAVIOR & STATE MANAGEMENT

## 34. Objective

Phase 3 defines how a booking behaves from creation through completion or exception. The booking lifecycle is the operational backbone of Home Clean.

## 35. Booking State Machine

```plantuml
@startuml
[*] --> REQUESTED
REQUESTED --> PRICE_CONFIRMED
PRICE_CONFIRMED --> PAYMENT_PENDING : online
PRICE_CONFIRMED --> CASH_SELECTED : cash
PAYMENT_PENDING --> PAYMENT_CONFIRMED : success
PAYMENT_PENDING --> CANCELLED : cancellation
CASH_SELECTED --> PAYMENT_CONFIRMED
PAYMENT_CONFIRMED --> SEARCHING_FOR_TEAM
SEARCHING_FOR_TEAM --> TEAM_ASSIGNED : eligible team found
SEARCHING_FOR_TEAM --> NO_TEAM_AVAILABLE : none
TEAM_ASSIGNED --> TEAM_ACCEPTED : provider accepts
TEAM_ASSIGNED --> REJECTED : provider rejects
REJECTED --> SEARCHING_FOR_TEAM : retry
TEAM_ACCEPTED --> TEAM_ON_THE_WAY
TEAM_ON_THE_WAY --> CLEANING_STARTED
TEAM_ON_THE_WAY --> TEAM_NO_SHOW
CLEANING_STARTED --> CLEANING_COMPLETED
CLEANING_COMPLETED --> PAYMENT_RECONCILIATION
PAYMENT_RECONCILIATION --> COMPLETED
PAYMENT_RECONCILIATION --> REFUND_PENDING : refund required
REFUND_PENDING --> REFUNDED
REQUESTED --> CANCELLED
PRICE_CONFIRMED --> CANCELLED
TEAM_ASSIGNED --> CANCELLED
TEAM_NO_SHOW --> SEARCHING_FOR_TEAM
COMPLETED --> [*]
CANCELLED --> [*]
NO_TEAM_AVAILABLE --> [*]
REFUNDED --> [*]
@enduml
```

## 36. Customer Booking Activity

```plantuml
@startuml
start
:Open App;
:Select Service;
:Enter Property Details;
:Select Address;
:Select Date & Time;
:Calculate Price;
:Review Booking;
if (Confirm?) then (Yes)
  :Select Payment Method;
  if (Online?) then (Yes)
    :Process Payment;
    if (Success?) then (Yes)
      :Payment Confirmed;
    else (No)
      :Show Payment Failure;
      stop
    endif
  else (Cash)
    :Record Cash Method;
  endif
  :Create Booking;
  :Search Eligible Teams;
  if (Team Available?) then (Yes)
    :Assign Team;
    :Notify Provider;
  else (No)
    :Set NO_TEAM_AVAILABLE;
  endif
else (No)
  :Exit / Cancel;
endif
stop
@enduml
```

## 37. Provider Job Activity

```plantuml
@startuml
start
:Receive Job Offer;
if (Accept?) then (Yes)
  :Accept Assignment;
  :View Job Details;
  :View Location;
  :Navigate;
  :Mark Team On The Way;
  :Arrive;
  :Start Cleaning;
  :Perform Cleaning;
  :Complete Cleaning;
  :Submit Completion Proof if required;
  :Send Completion to Backend;
else (No)
  :Reject Assignment;
  :Trigger Reassignment;
endif
stop
@enduml
```

## 38. Complete Booking Sequence

```plantuml
@startuml
actor Customer
participant "Customer App" as App
participant "Backend API" as API
participant "Pricing Engine" as Pricing
participant "Payment Module" as Payment
participant "Dispatch Engine" as Dispatch
participant "Provider App" as Provider
participant "Notification Service" as Notify
Customer -> App: Enter booking details
App -> API: Request price
API -> Pricing: Calculate price
Pricing --> API: Price
API --> App: Display price
Customer -> App: Confirm booking
App -> API: Create booking
alt Online
 API -> Payment: Process payment
 Payment --> API: Payment result
else Cash
 API -> Payment: Record cash method
end
API -> Dispatch: Find eligible team
Dispatch -> Dispatch: Filter and rank candidates
Dispatch --> API: Selected team
API -> Provider: Job offer
Provider -> API: Accept
API -> Notify: Team assigned
Notify --> Customer: Team assigned
Provider -> API: Team on the way
API -> Notify: Status update
Notify --> Customer: Team on the way
Provider -> API: Cleaning started
API -> Notify: Status update
Notify --> Customer: Cleaning started
Provider -> API: Cleaning completed
API -> Notify: Completion notification
Notify --> Customer: Cleaning completed
API -> Payment: Reconcile
API -> API: Calculate settlement
API --> App: Booking completed
@enduml
```

## 39. Rejection / Reassignment

A provider rejection should normally reject the **assignment attempt**, not the customer's booking. The dispatch engine can select another eligible team.

```plantuml
@startuml
participant "Dispatch Engine" as D
participant "Provider App" as P
participant "Backend" as B
D -> P: Offer booking
alt Accept
 P -> B: Accept assignment
 B -> D: Confirm
else Reject
 P -> B: Reject assignment
 B -> D: Request next candidate
 D -> D: Rank remaining teams
 D -> P: Offer next team
end
@enduml
```

## 40. Cancellation / Refund

```plantuml
@startuml
actor Customer
participant "Customer App" as App
participant "Backend" as API
participant "Payment Module" as Pay
participant "Provider App" as Provider
Customer -> App: Cancel booking
App -> API: Cancellation request
API -> API: Validate cancellation policy
alt Allowed
 API -> API: Mark CANCELLED
 API -> Provider: Cancel assignment if needed
 alt Refund required
  API -> Pay: Create refund
  Pay --> API: Refund result
  API -> API: REFUNDED or REFUND_PENDING
 end
 API --> App: Cancellation confirmed
else Not allowed
 API --> App: Cancellation rejected
end
@enduml
```

## 41. Booking Status Ownership

| Status | Primary owner |
|---|---|
| REQUESTED | Backend |
| PRICE_CONFIRMED | Backend |
| PAYMENT_PENDING | Payment Module |
| CASH_SELECTED | Backend |
| PAYMENT_CONFIRMED | Payment Module / Backend |
| SEARCHING_FOR_TEAM | Dispatch Engine |
| TEAM_ASSIGNED | Dispatch Engine |
| TEAM_ACCEPTED | Provider App / Backend |
| TEAM_ON_THE_WAY | Provider App / Backend |
| CLEANING_STARTED | Provider App / Backend |
| CLEANING_COMPLETED | Provider App / Backend |
| PAYMENT_RECONCILIATION | Backend |
| COMPLETED | Backend |
| CANCELLED | Customer/Admin/Backend according to policy |
| REJECTED | Provider App / Backend |
| NO_TEAM_AVAILABLE | Dispatch Engine |
| TEAM_NO_SHOW | Provider/Admin |
| REFUND_PENDING | Payment Module |
| REFUNDED | Payment Module |

## 42. Booking Status History

Recommended audit entity:

```text
booking_status_history
- id
- booking_id
- previous_status
- new_status
- changed_by_user_id
- changed_by_role
- reason
- metadata
- created_at
```

Every important status transition should be auditable.

## 43. Phase 3 Design Decisions

1. Backend owns the booking state machine.
2. Apps request actions; they do not arbitrarily set statuses.
3. Provider accept/reject/start/complete actions are explicit operational events.
4. Assignment rejection can trigger reassignment.
5. Financial reconciliation is part of booking closure.
6. Status history should be retained for support, disputes and reporting.

## 44. Next Phase

Phase 4 will define dispatch in detail: team availability, service-area eligibility, capabilities, distance/ETA, assignment scoring, timeouts, rejection handling, reassignment, manual admin dispatch, workload/capacity, and dispatch monitoring.


# PHASE 4 — DISPATCH & AUTOMATIC TEAM ASSIGNMENT

## 45. Dispatch Goals

The dispatch engine selects an eligible cleaning team for a booking using availability, service area, service type/capability, workload/capacity, distance/ETA, reliability and operational constraints. Customer-facing company identity remains hidden.

## 46. Dispatch Eligibility Pipeline

```text
Booking ready for dispatch
  -> validate address/service/date-time
  -> find teams available for requested slot
  -> filter by service area
  -> filter by required service/capabilities
  -> filter by capacity/workload
  -> calculate distance + ETA
  -> score candidates
  -> offer to best candidate
  -> accept => TEAM_ASSIGNED / TEAM_ACCEPTED
  -> reject/timeout => next candidate
  -> none => NO_TEAM_AVAILABLE / admin intervention
```

## 47. Team Availability Model

Recommended operational fields:
- team status: AVAILABLE, BUSY, OFFLINE, PAUSED
- working schedule
- service area
- capacity
- current assignment count
- current location/last known location
- supported services
- active/inactive flag
- reliability/performance indicators

## 48. Service-Area Eligibility

A team is eligible only when its configured service area covers the booking location. Area rules can later support governorate/city/neighborhood polygons or radius rules.

## 49. Team Capability Matching

The dispatch engine checks service type and required skills/equipment before an offer is created.

## 50. Candidate Scoring

Suggested conceptual score:

```text
score =
  availability_score
+ service_match_score
+ capability_score
+ proximity_score
+ workload_score
+ reliability_score
+ performance_score
```

Weights are configurable by Home Clean operations. Exact production weights should be validated with real operational data rather than hard-coded permanently.

## 51. Assignment Offer

An assignment is an offer to a provider team. It should contain booking ID, service summary, scheduled time, location, estimated duration, customer instructions allowed by policy, and an expiration time.

Provider response:
- ACCEPT
- REJECT(reason)
- TIMEOUT

## 52. Reassignment Rules

If a team rejects or times out:
1. record assignment attempt;
2. exclude the failed team for the current attempt unless admin overrides;
3. select the next eligible candidate;
4. repeat until a configured retry limit;
5. if exhausted, mark NO_TEAM_AVAILABLE and alert operations.

## 53. Manual Dispatch

Admin can manually assign or reassign a booking. Manual actions must be authorized and audited with actor, reason and timestamp.

## 54. Dispatch Monitoring

Admin dashboard should expose:
- unassigned bookings
- pending offers
- assignment age
- rejected/expired offers
- team workload
- service-area gaps
- active jobs
- dispatch failures

## 55. Dispatch Activity Diagram

```plantuml
@startuml
start
:Booking ready for dispatch;
:Find available teams;
:Filter service area;
:Filter service/capability;
:Filter workload/capacity;
:Calculate distance/ETA;
:Score candidates;
if (Candidate exists?) then (yes)
  :Send assignment offer;
  if (Accepted?) then (yes)
    :Create active assignment;
    :Notify customer;
  else (no/timeout)
    :Record rejection/timeout;
    if (Retry allowed?) then (yes)
      :Select next candidate;
    else (no)
      :NO_TEAM_AVAILABLE;
      :Alert admin;
    endif
  endif
else (no)
  :NO_TEAM_AVAILABLE;
  :Alert admin;
endif
stop
@enduml
```

## 56. Dispatch Sequence Diagram

```plantuml
@startuml
actor Customer
participant "Home Clean Backend" as API
participant "Dispatch Engine" as D
participant "Provider App" as P
actor Admin

Customer -> API: Create/confirm booking
API -> D: Dispatch booking
D -> D: Build eligible candidate set
D -> D: Score candidates
D -> P: Assignment offer
alt Accept
 P -> D: ACCEPT
 D -> API: Assignment confirmed
 API -> Customer: Team assigned
else Reject/Timeout
 P -> D: REJECT / timeout
 D -> D: Record attempt
 D -> D: Select next candidate
 D -> P: Next assignment offer
else No candidates
 D -> API: NO_TEAM_AVAILABLE
 API -> Admin: Dispatch alert
end
@enduml
```

# PHASE 5 — PRICING, PAYMENTS, CASH & SETTLEMENTS

## 57. Pricing Model

The price shown to the customer should be calculated by Home Clean from service base price plus applicable property/size/duration/extras/rules, before payment selection.

Conceptual formula:

```text
customer_total = base_service_price + extras + applicable_adjustments + fees - discounts
```

Provider payout and Home Clean commission are separate financial concepts.

## 58. Payment Methods

MVP supports:
- online payment
- cash payment

Payment records should include method, amount, status, provider/reference where applicable, timestamps and failure/refund information.

## 59. Online Payment Sequence

```text
Booking -> PRICE CONFIRMED -> PAYMENT PENDING
       -> payment gateway
       -> success webhook/callback
       -> PAYMENT CONFIRMED
       -> dispatch
```

Payment success must be verified server-side. Client success screens are not sufficient evidence of payment.

## 60. Cash Payment Sequence

```text
Booking -> CASH SELECTED -> dispatch
       -> service completed
       -> cash collected/confirmed
       -> reconciliation
       -> COMPLETED
```

## 61. Refund Flow

```text
Refund requested
 -> validate refundable amount
 -> REFUND_PENDING
 -> payment provider refund (online) or cash adjustment policy
 -> REFUNDED / failed-refund exception
```

## 62. Settlement Model

Recommended separation:
- customer payment transaction
- platform revenue/commission
- provider payable
- provider settlement batch
- settlement payment record

A provider should not receive access to another company's financial data.

## 63. Financial State Diagram

```plantuml
@startuml
[*] --> PAYMENT_PENDING
PAYMENT_PENDING --> PAYMENT_CONFIRMED : online success
PAYMENT_PENDING --> CASH_SELECTED : cash chosen
PAYMENT_PENDING --> PAYMENT_FAILED : online failure
PAYMENT_CONFIRMED --> REFUND_PENDING : refundable cancellation
REFUND_PENDING --> REFUNDED : refund confirmed
REFUND_PENDING --> REFUND_FAILED : refund failed
CASH_SELECTED --> CASH_COLLECTED : cash received
PAYMENT_CONFIRMED --> RECONCILED : settlement calculated
CASH_COLLECTED --> RECONCILED : settlement calculated
RECONCILED --> COMPLETED
PAYMENT_FAILED --> PAYMENT_PENDING : retry
@enduml
```

# PHASE 6 — NOTIFICATIONS, MAPS & REAL-TIME OPERATIONS

## 64. Notification Events

Customer notifications:
- booking created
- payment confirmed/failed
- team assigned
- team accepted
- team on the way
- cleaning started
- cleaning completed
- cancellation/refund

Provider notifications:
- new assignment offer
- offer expiring
- booking changes/cancellation
- navigation/job reminders

Admin notifications:
- no team available
- repeated rejection
- payment failure
- team no-show/customer no-show
- operational exceptions

## 65. Notification Architecture

```text
Backend Event
 -> Notification Service
 -> preference/permission check
 -> FCM/APNs/push channel
 -> recipient device
 -> delivery/logging
```

The backend event remains the source of truth; push delivery is a notification mechanism, not a business-state mechanism.

## 66. Maps & Location

Use a map provider for address selection, geocoding, routing and ETA where required. Store the canonical booking location/address snapshot so a later address-profile edit does not silently rewrite historical bookings.

## 67. Real-Time Tracking

For MVP, tracking can be status-based. Later, provider location updates may support customer map tracking. Location sharing should be limited to what is operationally necessary.

## 68. Notification Sequence

```plantuml
@startuml
participant Backend
participant NotificationService
participant PushProvider
participant Customer
participant Provider

Backend -> NotificationService: Booking event
NotificationService -> PushProvider: Send customer notification
PushProvider -> Customer: Push
NotificationService -> PushProvider: Send provider notification
PushProvider -> Provider: Push
NotificationService -> Backend: Delivery/log result
@enduml
```

# PHASE 7 — AUTHENTICATION, AUTHORIZATION & SECURITY

## 69. Identity Model

Roles:
- CUSTOMER
- COMPANY_MANAGER
- TEAM_LEADER / CLEANER
- HOME_CLEAN_ADMIN
- DISPATCHER

Authentication can use phone + OTP as proposed in the initial specification. Session/token handling must be server-controlled.

## 70. Authorization Model

Authorization is role + resource based.

```text
Customer -> own profile, own properties, own bookings, own payments
Company Manager -> own company, own teams, own assigned/eligible jobs, own settlements
Team Leader/Cleaner -> own team jobs and operational actions
Dispatcher -> dispatch operations without unrestricted financial/admin access
Home Clean Admin -> platform-wide operations according to role
```

## 71. Provider Data Isolation

A provider request must be scoped by authenticated company/team identity on the backend. Never rely on hidden UI fields or client-supplied company IDs for isolation.

## 72. Security Controls

- server-side authorization on every protected endpoint
- input validation
- rate limiting for OTP/auth endpoints
- secure token/session expiry and revocation
- encrypted transport
- secrets outside source code
- audit logs for privileged actions
- least-privilege admin roles
- payment webhook signature/verification
- privacy-aware logging

## 73. Authorization Sequence

```plantuml
@startuml
actor User
participant App
participant API
participant Auth
participant Policy
participant DB
User -> App: Request protected action
App -> API: Access token + request
API -> Auth: Validate token
Auth --> API: Identity + roles
API -> Policy: Authorize identity/resource/action
alt Allowed
 Policy --> API: Allow
 API -> DB: Read/write scoped data
 API --> App: Result
else Denied
 Policy --> API: Deny
 API --> App: 403/authorization error
end
@enduml
```

# PHASE 8 — API & INTEGRATION ARCHITECTURE

## 74. API Domains

Suggested REST domains:
- `/auth`
- `/customers`
- `/addresses`
- `/services`
- `/bookings`
- `/assignments`
- `/payments`
- `/providers`
- `/teams`
- `/notifications`
- `/admin`

Exact endpoint names remain implementation choices.

## 75. Core API Pattern

```text
Mobile/Web Client
 -> HTTPS API
 -> authentication middleware
 -> authorization/policy
 -> domain service
 -> transaction/repository
 -> PostgreSQL
 -> event/notification side effects
```

## 76. Booking API Lifecycle

```text
POST booking draft/create
GET pricing/quote
POST booking confirmation
POST payment initiation (online)
POST cash selection
GET booking
POST booking cancellation
GET booking status/history
```

Provider operations:

```text
GET assignment offers
POST assignment accept/reject
POST job on-the-way
POST job start
POST job complete
POST proof upload (if enabled)
```

Admin operations:

```text
GET/search bookings
POST manual assignment
POST reassignment
POST company/team management
GET dispatch monitoring
GET settlements/reports
```

## 77. Webhooks

External providers should call dedicated webhook endpoints. Webhooks must be idempotent and independently verified.

## 78. API Sequence — Booking to Dispatch

```plantuml
@startuml
actor Customer
participant "Customer App" as C
participant API
participant BookingService as B
participant PaymentService as Pay
participant DispatchEngine as D
participant ProviderApp as P

Customer -> C: Confirm booking
C -> API: POST /bookings
API -> B: Create booking
B --> API: Price + booking
API --> C: Booking created
alt Online
 C -> API: Initiate payment
 API -> Pay: Create payment
 Pay --> C: Payment action
 Pay -> API: Verified webhook
 API -> B: Payment confirmed
else Cash
 C -> API: Select cash
 API -> B: Cash selected
end
API -> D: Dispatch
D -> P: Assignment offer
P -> D: Accept
D -> API: Assignment confirmed
API -> C: Team assigned
@enduml
```

# PHASE 9 — ADMIN, PROVIDER & CUSTOMER INTERFACE ARCHITECTURE

## 79. Customer App Screens

```text
Splash / Auth
Home
Services
Service Details
Property / Address
Date & Time
Price Review
Payment Method
Booking Confirmation
Booking Tracking
Booking History
Booking Details
Rating / Review
Profile
Notifications
Support / Help
```

## 80. Provider App Screens

Company Manager:
```text
Dashboard
Incoming Jobs
All Jobs
Job Details
Teams
Team Schedule
Team Performance
Earnings
Settlements
Company Profile
Notifications
```

Team Leader/Cleaner:
```text
My Jobs
Job Details
Customer Location / Navigation
Accept / Reject
On The Way
Start Cleaning
Complete Cleaning
Proof / Notes
Job History
```

## 81. Admin Dashboard Screens

```text
Overview
Live Dispatch
Bookings
Calendar / Schedule
Customers
Companies
Teams
Services
Pricing
Payments
Cash Collection
Settlements
Refunds
Notifications
Reports
Audit Logs
Settings
```

## 82. UI-to-Backend Boundary

UI actions should map to explicit domain commands. Example:

```text
Provider taps Accept
 -> POST accept-assignment command
 -> backend validates assignment + expiry + team status
 -> backend changes assignment/booking state
 -> backend records history
 -> backend emits notification
```

# PHASE 10 — TESTING, DEPLOYMENT, OBSERVABILITY & SCALING

## 83. Testing Pyramid

Unit tests:
- pricing rules
- dispatch scoring
- state transitions
- authorization policies
- settlement calculations

Integration tests:
- booking + DB
- payment webhook + idempotency
- dispatch + provider acceptance
- notification event flow

End-to-end tests:
- customer booking
- online payment
- cash booking
- provider acceptance/rejection
- reassignment
- completion
- refund/cancellation

## 84. State-Machine Test Matrix

Every transition must test:
- valid actor
- valid previous state
- required data
- invalid actor
- invalid previous state
- duplicate request/idempotency
- audit record creation
- notification side effect where applicable

## 85. Deployment Architecture

```text
Flutter Customer App      Flutter Provider App
          \                    /
           \                  /
             HTTPS API / Load Balancer
                       |
                Node.js/NestJS Backend
          _________|___________
         |         |           |
     PostgreSQL  Redis     Job/Worker Queue
         |         |           |
         |      cache      notifications
         |
  Object Storage (proof/media)
         |
 External services: Maps / Push / Payment

React/Next.js Admin Dashboard -> HTTPS API
```

## 86. Observability

Track:
- API latency/error rates
- booking conversion
- payment success/failure
- dispatch success rate
- average assignment time
- rejection/timeout rate
- no-team-available rate
- provider completion rate
- notification failures
- cash reconciliation differences

## 87. Auditability

Audit high-impact actions:
- price changes
- manual assignment/reassignment
- cancellation/refund
- payment state changes
- settlement changes
- company/team activation
- role/permission changes

## 88. Backup & Recovery

Production should include:
- automated PostgreSQL backups
- tested restore procedure
- retention policy
- monitoring/alerting
- disaster-recovery documentation

## 89. Scaling Strategy

Start as a modular backend rather than prematurely splitting into microservices. Separate modules/services by domain boundaries first. Scale stateless API instances horizontally, move asynchronous workloads to workers/queues, and introduce caching/read optimization as traffic requires.

## 90. Production Readiness Checklist

- [ ] Customer app
- [ ] Provider app
- [ ] Admin dashboard
- [ ] Auth + RBAC
- [ ] Booking state machine
- [ ] Database constraints
- [ ] Dispatch engine
- [ ] Pricing engine
- [ ] Online payment
- [ ] Cash workflow
- [ ] Settlement workflow
- [ ] Notifications
- [ ] Maps/address handling
- [ ] Audit logs
- [ ] Automated tests
- [ ] Backups
- [ ] Monitoring
- [ ] CI/CD
- [ ] App-store deployment
- [ ] Operational support process

# FINAL UML INVENTORY — COMPLETE

| Phase | Scope | Main diagrams/artifacts |
|---|---|---|
| 1 | System & Roles | Context, components, deployment, use cases, class, sequences |
| 2 | Database | ERD, domain relationships, constraints |
| 3 | Booking Behavior | State machine, activities, sequences, exceptions |
| 4 | Dispatch | Eligibility, scoring, assignment, rejection, reassignment |
| 5 | Finance | Pricing, online payment, cash, refund, settlement |
| 6 | Operations | Notifications, maps, real-time events |
| 7 | Security | Auth, RBAC, isolation, authorization |
| 8 | API | API domains, lifecycle, webhooks, integrations |
| 9 | Interfaces | Customer, Provider, Admin screen architecture |
| 10 | Production | Testing, deployment, observability, backups, scaling |

# FINAL ARCHITECTURAL RULES

1. Backend owns business state and financial truth.
2. Customers book with Home Clean, not directly with underlying companies.
3. Provider companies/teams operate through the Provider App and are isolated by company/team scope.
4. Customer-facing company identity may remain hidden as specified.
5. Dispatch is a backend responsibility with auditable assignment attempts.
6. Online payment confirmation must be server-verified.
7. Cash must have an explicit collection/reconciliation workflow.
8. Manual admin overrides are allowed but audited.
9. Apps request domain actions; they do not directly mutate arbitrary statuses.
10. Historical booking, address, payment and settlement data should remain auditable.
11. MVP may operate provider fulfillment through admin first, but the Provider App is the intended operational interface.
12. Exact pricing weights, dispatch weights, cancellation windows and settlement cadence should be configurable and validated operationally before production lock-in.

# PHASE 11 — FLUTTER + BACKEND IMPLEMENTATION TECHNICAL SPECIFICATION

## 91. Phase 11 Objective

Phase 11 converts the completed UML architecture into an implementation-ready technical blueprint. The mobile applications are standardized on **Flutter/Dart** for Android and iOS. The backend remains a modular **Node.js/NestJS** application backed by PostgreSQL. The Admin Dashboard remains a web application.

This phase defines the recommended code boundaries, application structure, API contracts, database implementation direction, state-management rules, authentication, networking, real-time behavior, payments, notifications, maps, testing, environments, and implementation order.

The specification preserves the architectural decisions established in Phases 1–10: Home Clean owns the customer relationship; provider companies operate behind the platform; the Provider App is a first-class application; the backend owns business state and financial truth; and provider/customer data must be isolated server-side.

---

## 92. Technology Baseline

| Layer | Technology | Purpose |
|---|---|---|
| Customer mobile | Flutter + Dart | Android/iOS customer application |
| Provider mobile | Flutter + Dart | Company Manager / Team Leader operational application |
| Mobile state | Riverpod | Predictable reactive state and dependency injection |
| Mobile navigation | go_router | Declarative, role-aware routing |
| Mobile networking | Dio | HTTP client, interceptors, retries and API errors |
| Mobile models | Freezed + json_serializable | Immutable models and JSON serialization |
| Backend | Node.js + NestJS + TypeScript | Modular REST API and domain services |
| ORM/data access | Prisma recommended | PostgreSQL schema, migrations and typed data access |
| Database | PostgreSQL | Transactional source of truth |
| Cache/queue | Redis | Caching, locks and asynchronous jobs |
| Async workers | NestJS workers / BullMQ | Notifications, dispatch retries, webhook jobs and other async work |
| Real-time | WebSocket gateway | Booking/provider operational updates |
| Push | Firebase Cloud Messaging + APNs delivery path | Mobile push notifications |
| Maps | Google Maps Platform or equivalent | Address, geocoding, routing and ETA |
| Payments | Jordan-compatible gateway | Online payment, verification and refunds |
| Admin | React / Next.js | Operations and administration |
| Media | Object storage | Completion proof and permitted media |
| API documentation | OpenAPI/Swagger | Developer-facing API contract |

Technology choices above are implementation recommendations. The business rules from earlier phases remain the source of truth.

---

## 93. Application Topology

```text
                         ┌─────────────────────┐
                         │   Customer Flutter   │
                         │       Android/iOS    │
                         └──────────┬──────────┘
                                    │ HTTPS/WSS
                         ┌──────────▼──────────┐
                         │    API / Backend    │
                         │     NestJS/Node     │
                         └─────┬──────┬────────┘
                               │      │
                 ┌─────────────┘      └──────────────┐
                 ▼                                   ▼
        ┌────────────────┐                   ┌───────────────┐
        │  PostgreSQL    │                   │ Redis/Workers │
        └────────────────┘                   └───────────────┘
                 ▲                                   │
                 │                                   ▼
        ┌────────┴────────┐                ┌──────────────────┐
        │                 │                │ Push / Webhooks │
        ▼                 ▼                └──────────────────┘
┌───────────────┐  ┌──────────────────┐
│ Provider      │  │ Admin Dashboard  │
│ Flutter App   │  │ React / Next.js  │
└───────────────┘  └──────────────────┘
```

All clients communicate through authenticated backend APIs. Direct mobile-to-database access is prohibited.

---

## 94. Flutter Repository Strategy

The mobile product should use a shared Flutter codebase strategy so common logic is not duplicated between Customer and Provider applications.

Recommended repository layout:

```text
home_clean_mobile/
├── apps/
│   ├── customer/
│   │   └── lib/
│   └── provider/
│       └── lib/
├── packages/
│   ├── core/
│   ├── design_system/
│   ├── networking/
│   ├── authentication/
│   ├── maps/
│   ├── notifications/
│   ├── payments/
│   └── shared_models/
├── assets/
├── test/
└── pubspec.yaml
```

If maintaining a Flutter monorepo is unnecessary for the first MVP, a single Flutter application with role-based flows is acceptable. The backend authorization model must remain unchanged regardless of the repository arrangement.

---

## 95. Flutter Feature Architecture

Each major feature should follow a predictable structure:

```text
feature/
├── data/
│   ├── datasources/
│   ├── dto/
│   └── repositories/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
└── presentation/
    ├── providers/
    ├── screens/
    └── widgets/
```

Recommended features:

```text
customer/
auth/
profile/
addresses/
services/
booking/
tracking/
payments/
notifications/
rating/
support/

provider/
provider_auth/
job_offers/
assigned_jobs/
team_schedule/
team_management/
provider_earnings/
settlements/
```

The presentation layer must not contain business rules that belong to the backend.

---

## 96. Flutter State Management

Riverpod is the recommended state-management layer.

State should be divided into:

```text
Session State
  ├── authenticated user
  ├── role
  └── token/session status

Remote State
  ├── services
  ├── bookings
  ├── job offers
  ├── payments
  └── notifications

Local UI State
  ├── selected service
  ├── selected date/time
  ├── form values
  └── loading/error presentation
```

Server state must not be treated as permanently authoritative in local memory. After important commands, the app should refresh or reconcile against the backend response.

---

## 97. Flutter Navigation

Customer routes:

```text
/splash
/auth
/home
/services
/services/:id
/booking/property
/booking/address
/booking/schedule
/booking/review
/booking/payment
/booking/confirmation
/bookings/:id
/bookings/:id/tracking
/bookings/history
/profile
/notifications
/support
```

Provider routes:

```text
/provider/login
/provider/dashboard
/provider/offers
/provider/offers/:id
/provider/jobs
/provider/jobs/:id
/provider/jobs/:id/navigation
/provider/jobs/:id/start
/provider/jobs/:id/complete
/provider/teams
/provider/schedule
/provider/earnings
/provider/settlements
/provider/profile
```

Route guards must be based on authenticated identity and backend-authorized role/scope.

---

## 98. Shared Mobile API Layer

```text
Flutter UI
   ↓
Use Case / Controller
   ↓
Repository
   ↓
API Client
   ↓
HTTPS
   ↓
NestJS Controller
   ↓
Domain Service
   ↓
Repository / Transaction
   ↓
PostgreSQL
```

Dio interceptors should handle:

- authorization header
- correlation/request ID
- common API error parsing
- token/session refresh where applicable
- timeout handling
- safe retry policy for idempotent requests

Payment, booking confirmation and state-changing operations must not be blindly retried unless the endpoint is designed to be idempotent.

---

## 99. Backend Module Structure

Recommended NestJS structure:

```text
src/
├── app.module.ts
├── common/
│   ├── guards/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── config/
├── auth/
├── users/
├── customers/
├── providers/
├── companies/
├── teams/
├── services/
├── addresses/
├── properties/
├── bookings/
├── pricing/
├── dispatch/
├── assignments/
├── payments/
├── settlements/
├── notifications/
├── locations/
├── ratings/
├── support/
├── promotions/
├── admin/
├── audit/
└── health/
```

Each domain should expose controllers, application/domain services, repositories and DTOs without allowing unrelated modules to bypass business boundaries.

---

## 100. Database Implementation Direction

The Phase 2 ERD becomes the starting point, but implementation should add production fields required for auditing, concurrency, security and historical snapshots.

Core tables:

```text
users
customers
companies
teams
team_members
services
service_extras
properties
addresses
bookings
booking_extras
booking_status_history
assignments
assignment_events
payments
payment_events
refunds
settlements
settlement_items
settlement_payments
notifications
notification_deliveries
device_tokens
roles
permissions
user_roles
team_availability
company_service_areas
team_service_capabilities
pricing_rules
booking_price_snapshots
ratings
support_tickets
audit_logs
```

The exact schema is to be finalized during the database implementation phase. Historical snapshots are required where changing master data must not rewrite past bookings.

---

## 101. Important Database Rules

### Monetary values

Use fixed-precision numeric/decimal types for money. Do not use floating-point values for financial calculations.

### Timestamps

Store timestamps consistently in UTC at the backend/database boundary. Convert to the user's operational timezone for presentation.

### IDs

Use UUIDs for internal entity identifiers. Booking numbers may use a separate human-friendly public reference.

### Concurrency

Booking assignment and payment confirmation must protect against duplicate concurrent operations using transactions, unique constraints, idempotency keys and/or distributed locking where appropriate.

### Historical data

A booking should preserve relevant snapshots such as:

- booked address/location
- service price
- extras and prices
- pricing version/rule reference
- applicable discount
- payment amount
- assigned company/team history

---

## 102. Authentication Flow

Recommended MVP flow:

```text
User enters phone
      ↓
POST /auth/request-otp
      ↓
OTP provider / verification service
      ↓
POST /auth/verify-otp
      ↓
Backend identifies/creates user
      ↓
Issue access + refresh session
      ↓
Flutter stores credentials securely
      ↓
GET /auth/me
      ↓
Route according to role
```

Provider onboarding should not allow an arbitrary customer to self-register as a company manager or cleaner. Provider identities and company/team relationships should be provisioned or approved through authorized Home Clean operations.

---

## 103. Authorization Model

Every protected request is evaluated using:

```text
Authenticated User
      ↓
Role
      ↓
Company scope, if applicable
      ↓
Team scope, if applicable
      ↓
Resource ownership
      ↓
Requested action
      ↓
Policy decision
```

Example:

```text
POST /assignments/{id}/accept

Allowed when:
- authenticated provider user
- assignment is active
- assignment belongs to user's permitted team/company
- offer has not expired
- booking state allows acceptance
- team is operationally eligible
```

The client must never be trusted merely because it sends a companyId or teamId.

---

## 104. Core REST API Contract

API versioning:

```text
/api/v1/...
```

Core domains:

```text
POST   /api/v1/auth/request-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me

GET    /api/v1/services
GET    /api/v1/services/:id

GET    /api/v1/customers/me
GET    /api/v1/customers/me/addresses
POST   /api/v1/customers/me/addresses
PATCH  /api/v1/customers/me/addresses/:id
DELETE /api/v1/customers/me/addresses/:id

POST   /api/v1/bookings/quote
POST   /api/v1/bookings
GET    /api/v1/bookings/:id
GET    /api/v1/bookings/:id/history
POST   /api/v1/bookings/:id/confirm
POST   /api/v1/bookings/:id/cancel
GET    /api/v1/bookings

POST   /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/retry
POST   /api/v1/webhooks/payments/:provider

GET    /api/v1/provider/offers
POST   /api/v1/provider/assignments/:id/accept
POST   /api/v1/provider/assignments/:id/reject
POST   /api/v1/provider/jobs/:id/on-the-way
POST   /api/v1/provider/jobs/:id/start
POST   /api/v1/provider/jobs/:id/complete
POST   /api/v1/provider/jobs/:id/proof

GET    /api/v1/provider/teams
GET    /api/v1/provider/schedule
GET    /api/v1/provider/earnings
GET    /api/v1/provider/settlements

GET    /api/v1/admin/bookings
POST   /api/v1/admin/bookings/:id/assign
POST   /api/v1/admin/bookings/:id/reassign
GET    /api/v1/admin/dispatch
GET    /api/v1/admin/settlements
```

Exact route naming may be refined during implementation; the domain boundaries should remain.

---

## 105. API Response Standard

Recommended response shape:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Error example:

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_INVALID_STATE",
    "message": "The booking cannot be cancelled in its current state.",
    "details": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

Do not expose internal database errors, stack traces, provider commission information, or sensitive operational data to customers.

---

## 106. Booking Command Model

The API should model state-changing operations as explicit commands rather than allowing clients to submit arbitrary status values.

```text
CreateBooking
ConfirmBooking
SelectCashPayment
InitiateOnlinePayment
CancelBooking
AcceptAssignment
RejectAssignment
MarkOnTheWay
StartCleaning
CompleteCleaning
SubmitCompletionProof
CollectCash
CreateRefund
ManualAssignBooking
ManualReassignBooking
```

Avoid endpoints such as:

```text
PATCH /bookings/:id
{
  "status": "COMPLETED"
}
```

because they bypass the business state machine.

---

## 107. Booking Confirmation Idempotency

Booking creation/confirmation must support an idempotency key.

```text
Client generates request key
       ↓
POST /bookings/confirm
Idempotency-Key: <unique-key>
       ↓
Backend checks existing operation
       ↓
If processed -> return original result
If new -> execute transaction
       ↓
Persist result against key
```

This prevents duplicate bookings when the customer taps twice or a mobile connection retries a request.

---

## 108. Online Payment Integration

The payment architecture must use a server-verified payment lifecycle:

```text
Customer App
   ↓
Backend creates payment intent/transaction
   ↓
Payment Gateway
   ↓
Customer completes payment
   ↓
Gateway callback/webhook
   ↓
Backend verifies signature/reference/status
   ↓
Payment transaction recorded
   ↓
Booking PAYMENT_CONFIRMED
   ↓
Dispatch triggered
```

The Flutter application must never be the final authority for payment success.

Payment webhook processing must be idempotent.

---

## 109. Cash Payment Implementation

Cash is a controlled financial workflow:

```text
Customer chooses CASH
        ↓
Booking confirmed
        ↓
Provider performs service
        ↓
Cash collected
        ↓
Provider confirms collection
        ↓
Backend records collection event
        ↓
Settlement calculated
        ↓
Company balance updated
        ↓
Admin reconciliation
```

The exact proof/confirmation method and settlement cadence should be configured according to Home Clean's commercial agreements.

---

## 110. Dispatch Integration Contract

The Booking module should call the Dispatch module only when the booking is eligible for assignment.

```text
BookingService
    ↓
DispatchService.dispatch(bookingId)
    ↓
CandidateRepository
    ↓
Eligibility filters
    ↓
Distance/ETA provider
    ↓
Scoring engine
    ↓
Assignment transaction
    ↓
Provider notification
```

Dispatch must not directly alter unrelated financial data.

---

## 111. Assignment Offer Contract

An assignment offer should include only information required for the provider to decide and execute the job.

Example:

```json
{
  "assignmentId": "uuid",
  "bookingId": "uuid",
  "bookingNumber": "HC-58291",
  "service": {
    "name": "Deep Cleaning"
  },
  "scheduledAt": "2026-09-20T13:00:00Z",
  "estimatedDurationMinutes": 180,
  "location": {
    "latitude": 31.95,
    "longitude": 35.91,
    "addressText": "..."
  },
  "expiresAt": "2026-09-20T12:05:00Z"
}
```

Commission, platform margin, other companies' data and unrelated internal scoring details must not be included unless explicitly required by provider policy.

---

## 112. Provider App Operational Flow

```text
LOGIN
  ↓
DASHBOARD
  ↓
INCOMING OFFER
  ├── ACCEPT → ASSIGNED JOB
  └── REJECT → NEXT OFFER / NO TEAM AVAILABLE

ASSIGNED JOB
  ↓
NAVIGATION
  ↓
ON THE WAY
  ↓
ARRIVED
  ↓
START CLEANING
  ↓
COMPLETE CLEANING
  ↓
PROOF / NOTES
  ↓
BACKEND COMPLETION
```

The Provider App should remain usable under imperfect mobile connectivity. Important commands should display clear pending/success/failure states and reconcile with the backend after reconnecting.

---

## 113. Real-Time Architecture

Use WebSockets for operational events where low-latency updates improve the experience.

Customer examples:

```text
booking.updated
assignment.accepted
team.on_the_way
cleaning.started
cleaning.completed
payment.updated
```

Provider examples:

```text
assignment.created
assignment.expiring
booking.changed
booking.cancelled
```

Admin examples:

```text
dispatch.unassigned
assignment.rejected
assignment.timeout
team.location.updated
payment.failed
```

Push notifications remain the fallback/background communication mechanism. WebSocket delivery must never be the only way the app learns critical state; the app can refetch authoritative state.

---

## 114. Maps & Location Implementation

Customer:

- address search/selection
- map pin confirmation
- geocoding
- stored latitude/longitude
- address snapshot on booking

Provider:

- customer destination
- navigation handoff
- optional in-app map
- team location update when enabled

Backend:

- distance calculation
- ETA estimation
- service-area checks
- dispatch candidate scoring

Location data should be collected and retained only to the extent required by the product and operational policies.

---

## 115. Notification Architecture

```text
Domain Event
    ↓
Event/Queue
    ↓
Notification Service
    ↓
Recipient + preference lookup
    ↓
Push / SMS / email if configured
    ↓
Delivery record
```

Notification templates should be versioned/configurable rather than embedded throughout business logic.

Example event mapping:

```text
TEAM_ASSIGNED
→ Customer: "Your cleaning team has been assigned."

ASSIGNMENT_CREATED
→ Provider: "New cleaning job available."

NO_TEAM_AVAILABLE
→ Admin: "Booking requires manual dispatch."
```

---

## 116. Media / Completion Proof

If completion proof is enabled:

```text
Provider App
   ↓
Request upload authorization
   ↓
Object Storage
   ↓
Upload media
   ↓
Backend receives metadata
   ↓
Attach proof to assignment/booking
   ↓
Audit record
```

Do not route large media files through the main API unnecessarily. Access URLs should be controlled and time-limited where appropriate.

---

## 117. Pricing Engine Architecture

Pricing should be represented as deterministic rules with a version/snapshot.

```text
Booking Inputs
   ↓
Base Service Price
   ↓
Property/size adjustments
   ↓
Extras
   ↓
Applicable fees
   ↓
Discounts/promotions
   ↓
Customer Total
   ↓
Price Snapshot
```

The backend should return a quote with enough information for the customer to understand the total without exposing internal provider commission calculations.

Recommended quote fields:

```text
quoteId
pricingVersion
basePrice
extras[]
adjustments[]
discount
fees
total
currency
expiresAt
```

The final booking should preserve the pricing snapshot used at confirmation.

---

## 118. Admin Dashboard Technical Boundary

The Admin Dashboard should use the same backend API rather than direct database access.

Admin capabilities include:

```text
Operations
├── bookings
├── live dispatch
├── manual assignment
├── cancellations
└── exceptions

Master Data
├── services
├── pricing
├── companies
├── teams
└── service areas

Finance
├── payments
├── refunds
├── cash collection
└── settlements

Governance
├── users
├── roles
├── audit logs
└── settings
```

High-risk actions require explicit permissions and audit records.

---

## 119. Error Handling Strategy

Errors should be classified:

```text
AUTH_*                  Authentication/session
FORBIDDEN_*             Authorization
VALIDATION_*            Invalid input
BOOKING_*               Booking lifecycle
ASSIGNMENT_*            Dispatch/provider
PAYMENT_*               Payment processing
REFUND_*                Refund processing
SETTLEMENT_*            Financial reconciliation
LOCATION_*              Maps/location
CONFLICT_*              Concurrency/idempotency
SYSTEM_*                Unexpected/internal failure
```

Flutter should map these codes to user-friendly messages without exposing implementation details.

---

## 120. Logging and Observability

Every request should have a request/correlation ID.

Important logs/events:

```text
request received
booking created
booking state transition
payment webhook received
payment verified
assignment created
assignment rejected
assignment expired
manual dispatch action
cash collected
settlement generated
refund initiated/completed
notification sent/failed
```

Sensitive personal and payment data must be excluded or redacted from logs.

---

## 121. Environment Strategy

Use separate environments:

```text
local
  ↓
development
  ↓
staging
  ↓
production
```

Environment configuration must contain:

```text
DATABASE_URL
REDIS_URL
JWT/SESSION secrets
OTP provider credentials
PAYMENT gateway credentials
MAP provider credentials
FCM/APNs credentials
OBJECT_STORAGE credentials
WEBHOOK secrets
```

Secrets must never be committed to Git.

Flutter should use environment-specific configuration for API base URLs and non-secret public configuration.

---

## 122. Flutter Security Requirements

- use secure storage for sensitive session material
- do not hard-code private API/payment secrets
- validate backend responses
- avoid logging tokens or payment data
- use HTTPS only in production
- handle session expiration cleanly
- restrict provider features by authenticated role
- treat local storage as untrusted from a business-rule perspective

---

## 123. Backend Security Requirements

- DTO validation on every external input
- authentication guard on protected routes
- authorization policy checks
- rate limiting for OTP and sensitive endpoints
- webhook signature verification
- database constraints
- parameterized/typed database access
- audit logs for privileged actions
- encrypted transport
- secret management
- secure HTTP headers
- controlled CORS
- backup and restore procedures

---

## 124. Testing Architecture

Flutter:

```text
Unit
├── pricing display logic
├── validators
├── state/controllers
└── mappers

Widget
├── booking flow
├── payment states
├── job offer
└── tracking screens

Integration/E2E
├── login
├── booking
├── payment
├── provider acceptance
└── completion
```

Backend:

```text
Unit
├── pricing
├── dispatch scoring
├── state machine
├── authorization
└── settlement calculations

Integration
├── database transactions
├── payment webhooks
├── dispatch
├── notifications
└── provider scope

E2E
├── complete online booking
├── complete cash booking
├── rejection/reassignment
├── cancellation/refund
└── completion/settlement
```

---

## 125. CI/CD Pipeline

Recommended pipeline:

```text
Git Push / Pull Request
        ↓
Lint
        ↓
Static analysis
        ↓
Unit tests
        ↓
Build backend
        ↓
Build Flutter apps
        ↓
Integration tests
        ↓
Staging deployment
        ↓
Smoke tests
        ↓
Manual production approval
        ↓
Production deployment
```

Database migrations must be reviewed and executed as part of controlled deployments.

---

## 126. MVP Development Order

### Sprint 1 — Foundation

```text
Repository setup
Flutter foundation
NestJS foundation
PostgreSQL
Environment configuration
CI
Authentication
```

### Sprint 2 — Customer Core

```text
Customer profile
Addresses
Services
Property details
Booking draft
Pricing quote
```

### Sprint 3 — Booking Engine

```text
Booking confirmation
Booking state machine
Booking history
Cancellation
Status history
```

### Sprint 4 — Provider Operations

```text
Provider authentication
Company/team scope
Job offers
Accept/reject
On-the-way
Start
Complete
```

### Sprint 5 — Dispatch

```text
Availability
Service areas
Capabilities
Candidate filtering
Scoring
Offer timeout
Reassignment
Admin manual dispatch
```

### Sprint 6 — Payments

```text
Online payment
Webhook verification
Cash workflow
Refunds
Settlement calculations
```

### Sprint 7 — Operations

```text
Notifications
Maps
ETA
Admin monitoring
Audit logs
Reports
```

### Sprint 8 — Production Hardening

```text
E2E tests
Security testing
Performance testing
Backups
Monitoring
App-store preparation
Production deployment
```

---

## 127. Definition of Done for MVP

A feature is not complete merely because its screen exists.

For each business capability, the definition of done is:

```text
UI
+ API
+ backend business logic
+ authorization
+ database persistence
+ validation
+ error handling
+ audit/history where required
+ notification where required
+ automated tests
```

Example: “Accept Job” is complete only when the Provider App command is authorized, the backend validates offer expiry/team scope/state, the database records the accepted assignment transactionally, the booking state is updated, history is recorded, the customer is notified, and duplicate requests are safely handled.

---

## 128. Initial Flutter Screen Build Priority

Customer MVP priority:

```text
1. Auth
2. Home
3. Services
4. Service Details
5. Property/Address
6. Date & Time
7. Price Review
8. Payment
9. Confirmation
10. Active Booking
11. Booking History
12. Profile
```

Provider MVP priority:

```text
1. Auth
2. Dashboard
3. Incoming Offer
4. Job Details
5. Accept/Reject
6. Active Job
7. Navigation
8. Start Cleaning
9. Complete Cleaning
10. Job History
```

Admin MVP priority:

```text
1. Auth
2. Operations Overview
3. Bookings
4. Live Dispatch
5. Manual Assignment
6. Companies
7. Teams
8. Services/Pricing
9. Payments/Cash
10. Settlements
11. Audit Logs
```

---

## 129. Phase 11 Implementation Decisions

1. **Flutter is the official mobile framework** for both Customer and Provider applications.
2. Android and iOS share Flutter/Dart code rather than separate native implementations for normal product functionality.
3. Customer and Provider experiences remain separate product surfaces even when code/packages are shared.
4. NestJS is the recommended backend framework and remains the central business authority.
5. PostgreSQL is the transactional source of truth.
6. Redis/worker infrastructure is introduced for asynchronous and concurrency-sensitive workloads where required.
7. REST is the primary API style; WebSockets supplement it for real-time operational updates.
8. Clients issue explicit business commands rather than arbitrary state mutations.
9. Payment confirmation is server verified.
10. Provider authorization is scoped by authenticated company/team identity.
11. Historical booking and financial snapshots are retained.
12. MVP should remain a modular backend rather than prematurely becoming a microservice system.

---

## 130. Phase 11 Deliverables

The implementation package produced from this phase should eventually include:

```text
/home_clean/
├── mobile/
│   ├── customer_flutter/
│   └── provider_flutter/
├── backend/
│   └── nestjs/
├── admin/
│   └── nextjs/
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── database.md
│   └── deployment.md
└── README.md
```

The next implementation phase should create the actual repository structure, PostgreSQL schema/migrations, NestJS modules, API DTOs/controllers/services, and the Flutter application foundations described here.

---

# PHASE 11 COMPLETE — NEXT: PHASE 12 IMPLEMENTATION FOUNDATION

Phase 12 should move from specification to code by creating the initial Home Clean repository and implementing the backend/database/mobile foundations in a controlled order.

---

# 21. Phase 12 — Implementation Foundation

## Goal

Move from the approved architecture/specification into the initial repository, database schema, backend modules, mobile foundations, and admin foundation.

## First implementation slice

1. Local PostgreSQL + Redis
2. Prisma schema and seed
3. NestJS health endpoint
4. NestJS booking foundation
5. Customer Flutter shell
6. Provider Flutter shell
7. Next.js admin shell
8. Environment templates

## Deliberate non-goals in this slice

- Production payment gateway integration
- Real OTP provider integration
- Live maps/routing credentials
- Full dispatch scoring implementation
- Production WebSocket gateway
- Store publishing

Those follow after the foundation is validated.

---

# 22. Phase 12A — PostgreSQL + Prisma + Complete Database Migration Foundation

## Status

**Implemented as the Phase 12A database foundation.**

This phase converts the Phase 11 database specification into a versioned PostgreSQL/Prisma implementation. It is intentionally limited to the database foundation; business workflows remain in later backend phases.

## Source of truth

Phase 12A follows the approved Home Clean architecture and Phase 11 technical specification:

- PostgreSQL is the transactional system of record.
- Prisma is the application ORM/schema layer.
- UUIDs are used for internal identifiers.
- Money uses fixed-precision `DECIMAL(12,2)` values.
- Currency defaults to JOD.
- Timestamps use PostgreSQL `TIMESTAMPTZ` and the application treats persisted timestamps as UTC.
- Booking state is represented by the documented `BookingStatus` enum and is changed by backend domain commands rather than arbitrary client status mutation.
- Historical booking information is preserved with price and address/location snapshots.
- Assignment, payment, settlement, notification, audit, and booking-status history are separate records so operational history is not overwritten.

## Improvements made in Phase 12A

### 1. Completed Prisma relation graph

The foundation schema previously contained several one-sided relations. These are now explicitly connected:

- `User.deviceTokens -> DeviceToken.user`
- `User.statusHistory -> BookingStatusHistory.changedByUser`
- `Settlement.payments -> SettlementPayment.settlement`
- `Rating.booking/customer -> Booking/Customer`
- `SupportTicket.booking/customer -> Booking/Customer`
- `ServiceExtra.bookingExtras -> BookingExtra.serviceExtra`

This makes the Prisma client relation graph complete for the implemented model.

### 2. Booking historical address/location snapshot

`Booking` now stores:

- `addressSnapshot` JSONB
- `locationLatitude`
- `locationLongitude`

The booking keeps the canonical customer address relationship while also preserving the address/location used when the booking was created. This prevents later edits to a customer's saved address from rewriting historical booking context.

### 3. Booking extras preserve their price

`BookingExtra.price` remains independent from the current `ServiceExtra.price`. A nullable `serviceExtraId` links the selected extra to the catalog when available, while the booking record retains the historical name and price used for that booking.

### 4. Operational indexes

Indexes were added for common access patterns described by the architecture:

- active services/extras
- team/company status
- booking by customer/status/service and schedule
- assignment by booking/team/company and status
- payment/refund/payment-event history
- settlement by company/status
- notification/device-token lookup
- service-area lookup
- pricing/promotion active windows
- booking status history and audit history

Indexes are intended to support the MVP query patterns without prematurely introducing specialized infrastructure.

### 5. Payment transaction uniqueness

`Payment(method, transactionReference)` is unique. PostgreSQL still permits multiple rows where `transactionReference` is NULL, which is appropriate for cash payments or payment records that have not received a gateway reference yet.

### 6. Versioned pricing rules

`PricingRule(name, version)` is unique. This allows pricing definitions to be versioned while `BookingPriceSnapshot.pricingVersion` preserves the pricing version used for a booking.

### 7. Role and permission seed foundation

The seed now creates the five documented roles and a baseline permission catalog, then assigns permissions according to the role model:

- CUSTOMER
- COMPANY_MANAGER
- TEAM_LEADER_CLEANER
- DISPATCHER
- HOME_CLEAN_ADMIN

The seed is intentionally an initial authorization baseline. Resource ownership/company scoping remains a backend authorization concern and must not be inferred solely from a role name.

### 8. Referential integrity defaults

Foreign keys use restrictive deletion for core business history. This prevents accidental deletion of customers, bookings, payments, assignments, settlements, and other records that are needed for financial/operational history. Optional notification/support relationships can use `SET NULL` where retaining the record without the referenced object is consistent with the model.

## Migration layout

```text
database/
└── prisma/
    ├── schema.prisma
    ├── seed.ts
    └── migrations/
        ├── migration_lock.toml
        └── 0001_init/
            └── migration.sql
```

## First database bootstrap

From the repository root:

```bash
docker compose up -d postgres redis
```

Set `DATABASE_URL` for the backend/database environment. The expected local form is:

```text
postgresql://homeclean:homeclean@localhost:5432/homeclean?schema=public
```

Then, from the NestJS project after dependencies are installed:

```bash
npm install
npx prisma generate --schema ../../database/prisma/schema.prisma
npx prisma migrate deploy --schema ../../database/prisma/schema.prisma
npx prisma db seed --schema ../../database/prisma/schema.prisma
```

For local development where a new migration must be generated from a changed Prisma schema, use Prisma Migrate in development rather than editing an already-applied migration.

## Migration safety rules

1. Never edit an already-applied migration in a shared/deployed environment.
2. Schema changes are made in `schema.prisma` and represented by a new migration.
3. Production migrations must be reviewed for data-loss operations before deployment.
4. Seed data must remain deterministic/idempotent.
5. Financial and booking history must not be deleted merely because a user-facing object is removed or deactivated.
6. All application writes involving booking/payment/settlement state must use backend transactions and domain commands.
7. Do not expose database credentials to Flutter apps or the admin browser.

## Database boundaries

### PostgreSQL owns

- transactional persistence
- relational integrity
- financial amounts and settlement records
- booking state/history records
- authorization assignments
- audit history

### Redis does not replace PostgreSQL

Redis is reserved for cache, locks where appropriate, queues, and transient operational state. The database remains the source of truth.

## Deliberate non-goals

Phase 12A does not implement:

- OTP persistence/provider integration
- payment gateway integration
- dispatch scoring/locking workflow
- live location storage/streaming
- production WebSocket infrastructure
- admin business logic
- Flutter persistence/network integration

Those belong to subsequent implementation phases.

## Validation status

The schema and SQL migration were constructed to match the documented model and relation graph. The current execution environment does not have a validated PostgreSQL/Prisma CLI toolchain available, so the migration has **not** been truthfully reported as executed against a live database in this phase artifact.

The next implementation step should run, in an environment with PostgreSQL and Prisma dependencies installed:

```bash
npx prisma validate --schema ../../database/prisma/schema.prisma
npx prisma generate --schema ../../database/prisma/schema.prisma
npx prisma migrate deploy --schema ../../database/prisma/schema.prisma
npx prisma db seed --schema ../../database/prisma/schema.prisma
```

Any Prisma-generated migration differences or validation errors discovered during that execution must be fixed in a new documented change rather than hidden.

## Phase 12A completion checklist

- [x] PostgreSQL migration directory created
- [x] Initial migration SQL created
- [x] Prisma schema expanded to complete relation graph
- [x] Booking address/location snapshot implemented
- [x] Booking extra historical pricing preserved
- [x] Core indexes added
- [x] Role/permission seed foundation added
- [x] Deterministic service seed added
- [x] Migration lock created
- [x] Phase 12A decisions documented in this file
- [ ] Live PostgreSQL migration execution validated
- [ ] Prisma CLI validation/generation executed in the project runtime

## Backend Prisma command contract

The backend `package.json` points Prisma at the shared database schema outside the NestJS source tree:

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
```

This avoids a path mismatch between the repository's shared `database/prisma` layout and the NestJS backend directory.

---

# 23. Phase 12 Implementation Changelog

## Phase 12 Foundation

- Created repository foundation for Flutter customer/provider apps, NestJS backend, Next.js admin, PostgreSQL/Prisma, Redis, and documentation.
- Added initial Prisma domain model and seed foundation.
- Added Docker Compose PostgreSQL + Redis development services.

## Phase 12A — PostgreSQL + Prisma

- Reworked `schema.prisma` into the Phase 12A database contract.
- Completed previously one-sided Prisma relations.
- Added booking address/location snapshot fields to preserve historical booking location.
- Added optional `BookingExtra.serviceExtraId` while retaining booking-time name/price.
- Added operational indexes for booking, dispatch, payment, settlement, notification, pricing, team, and audit access patterns.
- Added uniqueness for `Payment(method, transactionReference)`.
- Added uniqueness for `PricingRule(name, version)`.
- Added deterministic role/permission seed data.
- Added idempotent service seed data.
- Added `database/prisma/migrations/0001_init/migration.sql`.
- Added Prisma migration lock for PostgreSQL.
- Added `docs/phase12a-postgresql-prisma.md` as the authoritative Phase 12A implementation record.
- Added `database/README.md`.
- Corrected backend Prisma npm scripts to reference the shared `database/prisma/schema.prisma` and seed file.
- Added dedicated Prisma validate/deploy commands and Prisma seed configuration.

## Validation note

The available execution environment did not provide a validated PostgreSQL + Prisma CLI toolchain, so live migration execution is intentionally left as an explicit checklist item rather than claimed as complete.

---

# 24. Implementation Order After Phase 12A

1. Infrastructure: PostgreSQL + Redis
2. Prisma migrations + seed data
3. Auth and identity
4. Customer profile/address/property/service APIs
5. Quote/pricing engine
6. Booking state machine + history
7. Provider/company/team authorization
8. Assignment/dispatch engine
9. Online payment webhook verification
10. Cash collection + settlement
11. Notifications
12. Maps/ETA
13. Admin operations
14. Flutter production screens
15. Automated tests and CI/CD

---

# 25. Codex Readiness and Pre-Implementation Gate

## Purpose

Actual implementation will be performed in **Codex**. This document is the project specification and implementation record; Codex is the execution environment that will modify the repository, install dependencies, run migrations, run tests, and validate the implementation.

## Is another architecture phase required before Codex?

**No major product-design phase is required before starting Codex.** The project already has the architecture/specification through Phase 12A.

There is, however, a short **pre-Codex readiness gate** that should be completed before asking Codex to implement the project.

## Pre-Codex checklist

### 1. Repository

- [ ] Put the Phase 12A repository in the Git repository that Codex will use.
- [ ] Ensure the repository has a clean baseline or clearly documented uncommitted changes.
- [ ] Keep the project structure from Phase 12A intact unless a documented architectural change is approved.

### 2. Source-of-truth documentation

The following documents should remain available to Codex:

```text
docs/
├── phase12-foundation.md
├── phase12-changelog.md
├── phase12a-postgresql-prisma.md
└── implementation-order.md

database/
└── README.md
```

The consolidated project document is also maintained as the full specification through Phase 12A.

### 3. Environment

Codex should have access to the required local development toolchains when it begins execution:

- Node.js / npm
- PostgreSQL
- Redis
- Prisma CLI through the project dependencies
- Flutter SDK / Dart SDK
- Android tooling for Android validation
- Xcode/CocoaPods where iOS validation is required
- Git
- Docker, if Docker Compose is used for local services

The exact versions should be pinned/documented by Codex after inspecting the repository and current supported dependency versions.

### 4. Secrets

Do not commit real credentials.

Use environment files or secret-management mechanisms for:

- database credentials
- OTP provider credentials
- payment gateway credentials
- maps API keys
- push notification credentials
- object-storage credentials
- JWT/session secrets

Only safe example values belong in `.env.example` files.

### 5. Database gate

Before considering Phase 12A validated, Codex must actually execute:

```bash
docker compose up -d postgres redis
npm install
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

The exact working directory for each command must follow the repository structure and the scripts defined in `package.json`.

### 6. Validation evidence

Codex should record successful execution of:

- Prisma schema validation
- Prisma client generation
- PostgreSQL migration deployment
- Database seed
- Backend TypeScript compilation
- Backend tests once available
- Flutter dependency resolution
- Flutter analyzer
- Flutter tests once available
- Admin TypeScript/build validation once available

Failures must be fixed or explicitly documented. They must not be marked as successful merely because source files exist.

### 7. Documentation discipline

Every material implementation improvement must be recorded in Markdown.

At minimum, update:

```text
docs/phase12-changelog.md
```

and, when the change affects architecture or a technical contract, update the relevant authoritative documentation file as well.

Each implementation phase should record:

- Objective
- Files/modules changed
- Architecture decisions
- Database changes
- API changes
- Security/authorization changes
- Validation commands
- Validation results
- Known limitations
- Remaining work
- Next phase

### 8. Do not silently change business rules

Codex should not invent or alter core business rules when implementation details are missing.

If implementation exposes an architectural ambiguity that materially affects behavior, record the ambiguity and resolve it deliberately before encoding the rule into the backend.

### 9. Backend authority

The backend remains authoritative for:

- authentication and authorization
- booking state
- pricing
- assignment
- payment state
- settlement calculations
- operational history

Flutter clients and the admin frontend must not be treated as authoritative sources for these business states.

## Recommended first Codex task

Start with **Phase 12A validation and backend database integration preparation**, rather than immediately building UI screens.

Codex should first:

1. Inspect the Phase 12A repository and documentation.
2. Install backend dependencies.
3. Validate and generate Prisma.
4. Start PostgreSQL/Redis.
5. Apply the migration.
6. Run the seed.
7. Fix any schema/migration/seed issues discovered.
8. Record every fix in the Markdown changelog.
9. Only after the database foundation is validated, proceed to the NestJS `PrismaService` and database integration layer.

## Codex implementation rule

Use this project document as the **approved specification through Phase 12A**.

Do not mark a requirement as implemented merely because it has been designed. A requirement becomes:

- **SPECIFIED** when defined by the architecture/documentation.
- **IMPLEMENTED** when code/configuration has been written.
- **VALIDATED** when the relevant implementation has actually been executed and verified.
- **BLOCKED** when validation or implementation cannot proceed because a dependency, decision, or environment requirement is missing.

This status distinction must be preserved throughout future phases.

---

# 26. Current Project Status — End of Phase 12A

```text
Phase 1–11 Architecture / Specification    COMPLETE
Phase 12 Repository Foundation             IMPLEMENTED
Phase 12A PostgreSQL + Prisma Foundation   IMPLEMENTED

Live PostgreSQL Validation                  PENDING
Prisma CLI Validation                       PENDING
Backend Database Integration                NEXT
Authentication                              LATER
Customer Booking Workflow                   LATER
Provider Operations                         LATER
Dispatch Engine                             LATER
Payments / Settlements                      LATER
Notifications / Maps                        LATER
Admin Operations                            LATER
Flutter Production UI                       LATER
Testing / CI/CD                             LATER
```

**This document intentionally stops here. No Phase 12B implementation has been added.**
