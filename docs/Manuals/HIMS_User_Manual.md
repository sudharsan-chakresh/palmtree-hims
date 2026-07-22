# Jioplix HIMS: Tiered User Manual

## Table of Contents
1. [Overview](#overview)
2. [Basic Tier Manual](#basic-tier-manual)
3. [Standard Tier Manual](#standard-tier-manual)
4. [Professional Tier Manual](#professional-tier-manual)
5. [Enterprise Tier Manual](#enterprise-tier-manual)

---

## Overview
Welcome to The Jioplix Health Information Management System (HIMS). Our platform is designed to streamline hospital operations through a scalable, multi-tenant architecture. 

---

## Basic Tier Manual
**Target:** Small Clinics and Private Practices.
**Objective:** Digitize OPD and patient communications.

### Core Workflows:
1. **Patient Registration**: Search or create patient records. Generate unique MRNs.
2. **Appointments**: Manage daily schedules and check-in statuses.
3. **Consultation Desk**: Doctors can capture vitals, chief complaints, and history. Generate digital prescriptions instantly.
4. **Billing**: Raise invoices for consultations and procedures.
5. **Message Board**: Post internal announcements for staff visibility.
6. **Support Tickets**: Raise issues directly to the Nexus team for resolution.

---

## Standard Tier Manual
**Target:** Clinics with in-house Pharmacy and Diagnostics.
**Objective:** Unified management of clinical services.

### Core Workflows (Includes Basic Tier):
1. **Pharmacy (PIMS)**: Manage medicine inventory, stock alerts, and prescription fulfillment.
2. **Laboratory (LIS)**: Create lab orders from consultations. Log test results and generate reports.
3. **Inventory Management**: Track stock levels across pharmacy and general hospital supplies.

---

## Professional Tier Manual
**Target:** Multi-speciality Hospitals with In-patient departments.
**Objective:** Complete hospital orchestration.

### Core Workflows (Includes Standard Tier):
1. **IPD Admission**: Manage the complete patient journey from admission desk to bed allocation.
2. **Bed Map**: Real-time visualization of ward occupancy and bed availability.
3. **Nursing Station**: Manage patient vitals, intake/output, and medication charts.
4. **Discharge Workflow**: Streamlined discharge process with automated billing clearance.
5. **Insurance**: Manage TPA claims and pre-authorization requests.

---

## Enterprise Tier Manual
**Target:** Large Hospitals and Hospital Chains.
**Objective:** Advanced AI-driven healthcare.

### Core Workflows (Includes Professional Tier):
1. **AI Summary**: Automatically generate patient history summaries using Google Gemini.
2. **AI Discharge Summary**: Generate professional PDF discharge summaries with AI-drafted clinical sections.
3. **Global Signal Monitoring**: (For Admin) Monitor all communication signals across the hospital chain.
4. **Advanced RBAC**: Granular control over department-level permissions and security.

---

## Recent Product Updates (May 18-20, 2026)
- **Doctor Scheduling Engine**: Week navigation and calendar rendering have been optimized for faster loading and smoother doctor availability browsing.
- **Appointment Booking Flow**: Unified booking flow improvements now reduce navigation friction and support more robust rescheduling and calendar alignment.
- **Tenant Schema Maintenance**: New tenant schema reconciliation and index maintenance scripts were added to ensure all shard databases stay consistent and performant.
- **Invoice and Billing Fixes**: `invoice_items` now include correct `created_at` tracking in tenant schema creation and healing routes.
- **AI and Clinical Workflows**: Enhanced AI summary and discharge features continue to improve patient documentation across the Professional and Enterprise tiers.
