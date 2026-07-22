# HIMS by Jioplix – Product Requirements Document (PRD)

## 1. Product Vision
Cloud-native multi-tenant Hospital Information Management System (HIMS) supporting clinics (OPD) and hospitals (OPD + IPD), with an AI-First architecture focused on operational efficiency and clinical intelligence.

---

## 2. Product Scope & Tiers
The Jioplix HIMS follows a 4-tier subscription model, enabling hospitals to scale as they grow.

### Tier 1: Basic (OPD & Communications)
- Patient Management (MRN Generation)
- **ABHA Identity Integration**: Aadhaar-based OTP verification & mobile discovery (ABDM M1).
- Appointment Scheduling
- OPD Consultation (Core EMR)
- Prescription Generation
- Invoicing & Billing
- **Smart Scheduling**: Doctor availability management with persistent blocking and recurring pattern support.
- Message Board (Internal Announcements)
- Mail Management (Signal Tracking)
- Support Ticketing System

### Tier 2: Standard (Clinical Services)
- All Basic Features
- Laboratory Information System (LIS) with Command Center
- Pharmacy Information Management (PIMS)
- Stock & Inventory Management
- **Request-to-Revenue Bridge**: Automated linkage between clinical orders and financial invoicing.

### Tier 3: Professional (IPD & Analytics)
- All Standard Features
- IPD Admission / Discharge Workflow
- Bed Management & Real-time Bed Map
- Nursing Workflows & Vitals
- Insurance Management
- **Isolated AI Chatbot**: Tenant-locked assistant for real-time facility metrics and operational support.

### Tier 4: Enterprise (AI & Multi-Tenant)
- All Professional Features
- AI-Powered Discharge Summaries
- AI Clinical Insights & History Summaries
- **Multi-Model AI Orchestration**: Seamless integration of Google Gemini (Complex Medical Processing) and Llama 3.3/Groq (High-Velocity CDS).
- **AI Lab Assistant**: OCR-driven external report parsing and pathological interpretation.
- Nexus Multi-Tenant Management
- Global Communication Hub & Signal History

---

## 3. Architecture

### Multi-Tenant Model
- **Nexus (Control Plane)**: Centralized orchestration for provisioning, ticketing triage, and global signal monitoring.
- **Tenant DB (Isolated Shards)**: Secure, isolated data storage for each hospital instance.

### AI Router Pattern
- **Orchestration Layer**: Decoupled AI service for compute-intensive tasks (OCR, Summarization).
- **Tenant-Lock Security**: Strict data isolation via backend context injection (HIPAA Compliance).

### Infrastructure Reliability
- **Self-Healing Shards**: Automated table and column provisioning per-tenant to eliminate environment-related runtime crashes.
- **Atomic Revenue Hub**: Consolidated billing queue that synchronizes Lab, Pharmacy, and IPD service charges in real-time.

---

## 4. User Roles
### Nexus Admin (Super Admin)
- Shard Provisioning & Lifecycle
- Support Ticket Resolution
- Global Communication Monitoring

### Tenant Staff
- Doctor (Clinical)
- Nurse (In-patient care)
- Receptionist (OPD Front desk)
- Pharmacist (Dispensing)
- Lab Technician (Diagnostics)
- Billing Staff (Finance / Revenue Center)

---

## 5. Core Operational Flow: Request-to-Revenue
The system enforces a strict operational lifecycle:
1.  **Clinical Initiation**: Doctor creates an order (Lab, Pharmacy, Procedure).
2.  **Execution**: Technician/Nurse processes the order.
3.  **Financial Catch**: Automated entry into the department-specific Billing Center.
4.  **Verification**: Final report/dispensing is only "Published" once payment/insurance is reconciled.

---

## 6. Security & Compliance
- **JWT Authentication**: Secure token-based access.
- **RBAC**: Role-Based Access Control mapped to dynamic sidebars.
- **Data Isolation**: PostgreSQL Schema-per-tenant ensures zero data leakage between shards (HIPAA Alignment).
- **Audit Logs**: Comprehensive tracking of all clinical and financial transactions.

---

## 7. UI/UX & Design Experience
The HIMS platform utilizes a **Premium Clinical Design System** optimized for high-velocity environments:
- **Dynamic Branding Engine**: Real-time theme injection allowing hospitals to customize primary colors, accent highlights, and corporate logos via a centralized Settings module.
- **Accordion Workflow Navigation**: A structured navigation hierarchy that groups modules into Clinical, Services, Billing, and Management clusters, reducing cognitive load for hospital staff.
- **Zero-Jump Architecture**: CSS-optimized layout persistence that eliminates UI shifting during navigation, ensuring a stable and predictable experience for medical practitioners.
- **Accessibility & Contrast**: High-contrast, theme-aware interfaces designed for varied lighting conditions in hospital wards and labs.

---

## 8. Success Metrics
- **Consultation Speed**: < 2 minutes per patient.
- **Prescription Efficiency**: < 3 clicks.
- **Revenue Capture**: 100% linkage between clinical orders and invoices.
- **Identity Integrity**: > 90% patient verification rate via ABHA/ABDM.
- **Onboarding**: < 5 minutes for new hospital shards.
