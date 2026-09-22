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
