# Jioplix :: Patient Journey Workflows

This document outlines the clinical journey for patients across the three HIMS service tiers, highlighting critical checkpoints such as clinical vitals capture.

---

## 📋 Core OPD Vitals & Triage Workflow (Current Stage)

To ensure clinical safety, the system enforces a vitals capture checkpoint between patient registration and the doctor's consultation. Below is the workflow mapping how patient vitals are captured and where the transition occurs:

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    actor Receptionist as Front Desk Receptionist
    actor Nurse as Triage Nurse (OPD Queue)
    actor Doctor as Consulting Doctor
    participant System as Jioplix EMR

    Patient->>Receptionist: Arrives at Clinic for Registration
    Receptionist->>System: Registers Patient (Weight, Height, BP, Temp are OPTIONAL)
    Note over Receptionist, System: Staff skips optional vitals for high-velocity front-desk billing
    System->>System: Patient added to Live OPD Queue (Status: PENDING VITALS)
    Patient->>Nurse: Proceeds to Nurse/Triage Desk
    Nurse->>System: Views OPD Queue (See "PENDING VITALS" flag)
    Nurse->>Patient: Measures clinical vitals (BP, Temp, Pulse)
    Nurse->>System: Clicks "Capture Vitals" & records raw clinical telemetry
    System->>System: Vitals Status updated to display raw values; Button changes to "Start Consult"
    Nurse->>Patient: Routes patient to doctor's room
    Doctor->>System: Clicks "Start Consult" in OPD Queue
    System->>Doctor: Loads Core EMR Consultation Page pre-populated with live vitals
    Doctor->>Patient: Diagnoses, records notes, and prints prescription
```

### 🔍 Where Vitals are Captured in the Current Stage:
1. **At Front-Desk Registration (Optional)**: If the receptionist has vitals equipment at the front desk, they can capture it during registration.
2. **At Triage Station / Nurse Desk (Mandatory Checkpoint)**: If skipped at registration (common in busy clinics), the patient shows as `PENDING VITALS` in the live queue. The nurse captures the actual BP, temperature, and pulse on the live queue page before the consult starts. **Consultation cannot start until vitals are captured.**

---

## 🟢 Tier 1: JIOPLIX BASIC (OP Focused) [STABLE & VALIDATED]
**Designed for**: Individual Doctors & Small Clinics.
**Focus**: Rapid consultation and records management.

1.  **Front Desk**: Patient walks in → Receptionist searches/registers patient (optional Vitals entry) → Assigns to Doctor's Queue.
2.  **Triage / Nurse Station**: Triage Nurse sees patient with `PENDING VITALS` in Live OPD Queue → Measures & captures raw clinical telemetry (BP, Temp, Pulse) → Clicks **Start Consult** to authorize doctor review.
3.  **Clinical Encounter**: Doctor loads patient EMR consultation → Reviews pre-populated vitals → Enters Diagnosis & Notes → Prints Prescription.
4.  **Checkout**: Front Desk collects Consultation Fee → Generates Bill → Encounter Completed.

---

## 🔵 Tier 2: JIOPLIX STANDARD (OP + Lab & Pharmacy) [STABLE & VALIDATED]
**Designed for**: Multi-specialty Clinics & Nursing Homes.
**Focus**: Integrated diagnostic and medication workflow.

1.  **Front Desk**: Patient registration & clinic check-in → Assigned to consulting Doctor.
2.  **Triage / Nurse Station**: Nurse screens patient on the Live OPD Queue, records raw clinical vitals (BP, Temp, Pulse).
3.  **Consultation**: Doctor clicks **Start Consult** → Evaluates patient EMR and captured vitals → Records diagnosis → **Orders Laboratory Tests** → Prescribes medications from Pharmacy Inventory.
4.  **Lab Desk**: Technician sees pending order → Collects Sample → Records & Authorizes Results.
5.  **Pharmacy Hub**: Pharmacist views prescription → Dispenses drugs (Inventory automatically deducted).
6.  **Smart Billing**: Receptionist generates a consolidated bill (Consultation + Lab Tests + Pharmacy Items) → Payment collected → Visit Closed.

---

## 🟣 Tier 3: JIOPLIX PROFESSIONAL (IP + Day Care) [STABLE & VALIDATED]
**Designed for**: Large Hospitals & Tertiary Care Centers.
**Focus**: Continuous care and facility management.

1.  **Admission Desk**: Patient arrives for IPD → Admin checks **Live Bed Map** → Assigns Patient to General Ward or Private Room.
2.  **Inpatient Care**: Nursing staff manages bed occupancy → Nurses continuously monitor and record clinical vitals (stored in patient's continuous EMR chart) → Doctors perform rounds and update clinical records.
3.  **Cross-Module Services**: Lab orders and Pharmacy dispensing continue as needed during the stay.
4.  **Discharge & Billing**: Final bill aggregation including Bed Charges (per day) + Clinical Fees + Lab + Pharmacy → Insurance reconciliation → Discharge.

---
*Last Validated: 2026-05-21*
