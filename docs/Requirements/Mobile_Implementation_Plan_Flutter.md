# Implementation Plan: HIMS Mobile App (Flutter)

## 1. Project Objective
Develop a high-performance, cross-platform mobile application using **Flutter** to provide doctors and patients with portable access to the Jioplix HIMS ecosystem.

---

## 2. Target Users & Core Features

### **Phase 1: Doctor App (Clinical Co-pilot)**
*   **Live Dashboard**: Real-time view of daily appointments and IPD rounds.
*   **Mobile EMR**: View patient history, vitals, and lab results on the go.
*   **AI Voice Dictation**: Use Gemini-powered voice-to-text for clinical notes.
*   **Notifications**: Instant alerts for critical lab values or emergency admissions.
*   **Tele-Consultation**: Integrated video consultations for remote follow-ups.

### **Phase 2: Patient App (Personal Health Record)**
*   **ABHA Management**: Digital ABHA card and health record linking.
*   **Appointment Booking**: Easy scheduling with doctor availability grids.
*   **Lab Reports**: Instant access to verified diagnostic reports.
*   **Online Payments**: Seamless billing and insurance tracking.

---

## 3. Technical Architecture

### **Frontend (Flutter)**
*   **Framework**: Flutter 3.x (Dart)
*   **State Management**: `Riverpod` or `Bloc` for predictable data flow.
*   **Networking**: `Dio` with interceptors for JWT and Multi-tenant Header management.
*   **UI Library**: Material 3 for a modern, premium clinical aesthetic.
*   **Local Storage**: `Hive` or `Flutter Secure Storage` for caching and security tokens.

### **Backend Integration (Existing Node.js APIs)**
*   **API Gateway**: Reuses the existing Express.js infrastructure.
*   **Authentication**: JWT-based login with biometric fallback (Fingerprint/FaceID).
*   **Multi-Tenancy**: The mobile app will send the `x-tenant-id` in all headers, just like the web client.

---

## 4. Implementation Roadmap

### **Milestone 1: Foundation & Auth (2 Weeks)**
- Setup Flutter project structure and design tokens.
- Implement Tenant-aware Login (Web + Mobile parity).
- Integration with biometric security.

### **Milestone 2: Clinical Dashboard (3 Weeks)**
- Real-time Appointment Grid.
- Patient Record Viewer (Timeline View).
- Integration with current `aiService` for clinical summaries.

### **Milestone 3: Diagnostic Hub (2 Weeks)**
- PDF Lab Report viewer with zoom/search.
- ABHA Card display and QR code generation.

### **Milestone 4: Push Notifications & Tele-health (3 Weeks)**
- Firebase Cloud Messaging (FCM) integration.
- Video call module using Agora or Jitsi.

---

## 5. UI/UX Principles
*   **Zero-Latency Design**: Optimistic UI updates for high-speed clinical environments.
*   **One-Handed Navigation**: Bottom navigation with a central "Action Hub" for common tasks (e.g., adding a note).
*   **High Contrast Mode**: Optimized for use in bright clinics or dimly lit hospital wards.

---

## 6. Security & Compliance
*   **End-to-End Encryption**: All data transmitted over HTTPS/TLS 1.3.
*   **No Local PHI**: Patient Health Information (PHI) is cached only in memory and cleared on logout.
*   **App Shielding**: Root/Jailbreak detection to prevent data leakage on compromised devices.
