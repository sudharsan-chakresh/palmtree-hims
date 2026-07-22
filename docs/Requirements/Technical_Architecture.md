# Jioplix HIMS Technical Architecture

## 1. System Overview
Jioplix HIMS is a high-velocity, multi-tenant clinical platform designed for enterprise scalability. It utilizes a **Shared-Instance, Separate-Schema** database architecture to ensure maximum performance and data isolation.

---

## 2. Environment & Port Mapping
- **Frontend (Local)**: `http://localhost:3000` (Vite)
- **Backend (Local)**: `http://localhost:4000` (Express)
- **Monitoring (Local)**: `http://localhost:5000` (Prometheus/Grafana)
- **Production (Vercel)**: Unified architecture with `/api/*` routing.

---

## 3. Technology Stack

### **Core Infrastructure**
- **Frontend**: React (Vite) + Lucide Icons + Vanilla CSS (Adaptive Design)
- **Backend**: Node.js (Express)
- **Mobile**: **Flutter (Dart)** for cross-platform Doctor & Patient applications
- **Database**: PostgreSQL with **Prisma ORM**
- **Architecture**: Multi-tenant schema isolation (Tenant-ID locked)
- **Analytics & Observability**: **PostHog** (User behavior tracking and operational heatmaps)
- **Testing**: Playwright (E2E Regression)

### **AI & Generative AI (GenAI)**
We utilize an **API-first GenAI Architecture** for clinical intelligence:
- **LLM Engines**: 
  - **Google Gemini 1.5 (Pro/Flash)**: Primary engine for multi-modal clinical OCR (Lab reports, PDFs) and complex medical summarization.
  - **Llama 3.3 (via Groq)**: High-speed engine (ultra-low latency) for real-time Clinical Decision Support (CDS) and medicine suggestions.
- **Foundational Patterns**:
  - **Context-Injection**: Dynamic injection of hospital-specific metrics and patient history into LLM prompts (Foundational RAG).
  - **Multi-Modal OCR**: Vision-based extraction of structured findings from hand-written or printed medical documents.
- **Predictive Analytics Layer**: Node.js-based inference engine that processes live clinical data through LLMs to generate operational forecasts (Time, Complexity, Resource Needs).
- **Clinical Summarization Engine**: 
  - **Medication Summaries**: Automatic consolidation of medication regimens into human-readable patient instructions.
  - **Smart Discharge Summaries**: AI-driven synthesis of IPD stays, laboratory results, and treatment outcomes into structured discharge documents.

---

## 4. ABHA Identity Integration (ABDM M1)
The platform is fully integrated with India's **National Digital Health Stack (ABDM)** using an Enterprise flow.

### **Architecture**
- **Security**: Mandatory RSA Encryption (PKCS1Padding) using the native Node.js `crypto` module for all Aadhaar/OTP payloads.
- **Enterprise Onboarding Flow**:
  1. **Mobile Discovery**: Fast-track lookup of existing ABHA profiles by mobile number.
  2. **Consent-Driven**: Mandatory digital consent flag before any identity verification.
  3. **Aadhaar-Based Creation**: Secure fallback for new identity generation via Aadhaar OTP.
- **Traceability**: Unified **ABHA Audit Logs** tracking every gateway transaction for compliance.
- **Demo Mode**: Environment-locked simulation layer for development without gateway dependency (`ABHA_DEMO_MODE=true`).

---

## 5. Cloud Resource Monitoring (Nexus)
- **Telemetry**: Infrastructure tracking via `prom-client`.
- **Dashboard**: Real-time visualization of database utilization, active tenants, and cloud resource consumption.
- **Persistence**: Daily cron-based snapshotting of infrastructure actuals for historical trend analysis.

---

## 6. Security & Compliance
- **RBAC**: Role-Based Access Control integrated with multi-tenant shard validation.
- **Data Privacy**: Strict tenant isolation at the database schema level.
- **Audit Trails**: Global and tenant-specific audit logs for all clinical and administrative actions.

---

## 7. Recent Architecture Updates (May 18-20, 2026)
- Added tenant schema reconciliation and self-healing migration tooling to keep all shard schemas aligned with the canonical model.
- Introduced index maintenance and per-schema migration scripts under `database/migrations/` to improve performance for patient-journey and clinical queries.
- The scheduling engine now caches weekly slot maps for doctor availability, reducing frontend re-render cost and improving week navigation performance.
- Invoice and billing schema changes include explicit transaction timestamps on `invoice_items` and stronger support for schema versioning during tenant onboarding.
