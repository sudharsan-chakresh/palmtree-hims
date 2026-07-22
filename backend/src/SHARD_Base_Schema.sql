
-- HIMS COMPLETE TENANT SCHEMA (PRODUCTION SYNC)
-- Auto-generated from JS ensure* functions. Applied fresh to new tenants.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================= TENANT & RBAC =================
DROP TABLE IF EXISTS tenant_settings CASCADE;
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name VARCHAR(255),
  tenant_code VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  currency VARCHAR(10) DEFAULT 'INR',
  -- Branding Settings
  primary_dark VARCHAR(50) DEFAULT '#0f172a',
  primary_accent VARCHAR(50) DEFAULT '#3b82f6',
  app_bg VARCHAR(50) DEFAULT '#f8fafc',
  text_main VARCHAR(50) DEFAULT '#1e293b',
  hero_bg VARCHAR(50) DEFAULT '#ffffff',
  hero_text VARCHAR(50) DEFAULT '#0f172a',
  logo_url TEXT,
  font_size INTEGER DEFAULT 14,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS contractor_vendors CASCADE;
CREATE TABLE contractor_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  role VARCHAR(50) DEFAULT 'staff',
  license_number VARCHAR(100),
  gender VARCHAR(20),
  dob DATE,
  age INTEGER,
  doj DATE,
  qualifications TEXT,
  experience_years INTEGER,
  specialization VARCHAR(100),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  employment_type VARCHAR(50) DEFAULT 'Permanent',
  vendor_id UUID REFERENCES contractor_vendors(id),
  is_manager BOOLEAN DEFAULT FALSE,
  -- HIPAA Compliance Fields
  privacy_level VARCHAR(20) DEFAULT 'LIMITED',
  last_login TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked BOOLEAN DEFAULT FALSE,
  phone VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic RBAC Tables
DROP TABLE IF EXISTS rbac_roles CASCADE;
CREATE TABLE rbac_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS rbac_menus CASCADE;
CREATE TABLE rbac_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) NOT NULL,
    path VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    required_plan VARCHAR(50) DEFAULT 'basic',
    parent_id UUID REFERENCES rbac_menus(id),
    sort_order INT DEFAULT 0
);

DROP TABLE IF EXISTS rbac_permissions CASCADE;
CREATE TABLE rbac_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

DROP TABLE IF EXISTS rbac_role_menus CASCADE;
CREATE TABLE rbac_role_menus (
    role_id UUID REFERENCES rbac_roles(id),
    menu_id UUID REFERENCES rbac_menus(id),
    PRIMARY KEY (role_id, menu_id)
);

DROP TABLE IF EXISTS rbac_role_permissions CASCADE;
CREATE TABLE rbac_role_permissions (
    role_id UUID REFERENCES rbac_roles(id),
    permission_id UUID REFERENCES rbac_permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

DROP TABLE IF EXISTS rbac_user_roles CASCADE;
CREATE TABLE rbac_user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES rbac_roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- ================= MASTERS HUB TABLES =================

DROP TABLE IF EXISTS departments CASCADE;
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  description TEXT,
  hod VARCHAR(255),
  specialty VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Active',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS designations CASCADE;
CREATE TABLE designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100)
);

DROP TABLE IF EXISTS specialities CASCADE;
CREATE TABLE specialities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  base_consultation_fee NUMERIC DEFAULT 0,
  description TEXT,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS consultation_modes CASCADE;
CREATE TABLE consultation_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  surcharge_percent NUMERIC DEFAULT 0,
  is_virtual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS diseases CASCADE;
CREATE TABLE diseases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  category VARCHAR(100),
  icd_code VARCHAR(50),
  severity_level VARCHAR(50) DEFAULT 'Moderate',
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS diagnostic_types CASCADE;
CREATE TABLE diagnostic_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100)
);

DROP TABLE IF EXISTS diagnostics CASCADE;
CREATE TABLE diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  type_id UUID REFERENCES diagnostic_types(id),
  category VARCHAR(100),
  price NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS treatments CASCADE;
CREATE TABLE treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  category VARCHAR(100),
  price NUMERIC DEFAULT 0,
  description TEXT,
  cpt_code VARCHAR(50),
  estimated_duration INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS services CASCADE;
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  type VARCHAR(50),
  category VARCHAR(100),
  service_code VARCHAR(50),
  price NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  reference_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS drug_categories CASCADE;
CREATE TABLE drug_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100)
);

DROP TABLE IF EXISTS drug_generics CASCADE;
CREATE TABLE drug_generics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  drug_class VARCHAR(100),
  category_id UUID REFERENCES drug_categories(id)
);

DROP TABLE IF EXISTS suppliers CASCADE;
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS medicines CASCADE;
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Other',
  composition TEXT,
  dosage_adult VARCHAR(100),
  dosage_pediatric VARCHAR(100),
  instructions TEXT,
  unit_price NUMERIC(12,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  uom VARCHAR(50) DEFAULT 'Tablet',
  batch_number VARCHAR(100),
  expiry_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS pharmacy_inwards CASCADE;
CREATE TABLE pharmacy_inwards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inward_no VARCHAR(50),
  supplier_id UUID REFERENCES suppliers(id),
  medicine_id UUID REFERENCES medicines(id),
  batch_number VARCHAR(100),
  invoice_number VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  uom VARCHAR(50),
  purchase_price NUMERIC DEFAULT 0,
  mrp NUMERIC DEFAULT 0,
  mfd_date DATE,
  expiry_date DATE,
  received_at TIMESTAMP DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  remarks TEXT
);

DROP TABLE IF EXISTS wards CASCADE;
CREATE TABLE wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  capacity INTEGER DEFAULT 10,
  type VARCHAR(50) DEFAULT 'General',
  floor VARCHAR(20),
  base_charge NUMERIC DEFAULT 0,
  rate_mode VARCHAR(10) DEFAULT 'DAY',
  min_age INTEGER DEFAULT 0,
  max_age INTEGER DEFAULT 120,
  gender_restriction VARCHAR(20) DEFAULT 'Any',
  age_validation_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS beds CASCADE;
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID REFERENCES wards(id),
  bed_number VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Vacant',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= PATIENTS & CLINICAL =================

DROP TABLE IF EXISTS patients CASCADE;
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  gender VARCHAR(20),
  dob DATE,
  age INTEGER,
  phone VARCHAR(50),
  email VARCHAR(255),
  blood_group VARCHAR(10),
  occupation VARCHAR(100),
  address TEXT,
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(50),
  medical_history TEXT,
  allergies TEXT,
  ai_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS encounters CASCADE;
CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  type VARCHAR(50) DEFAULT 'OPD',
  status VARCHAR(50) DEFAULT 'Draft',
  diagnosis TEXT,
  notes TEXT,
  vitals JSONB,
  complaints TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS consultation_events CASCADE;
CREATE TABLE consultation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id),
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS consultation_predictions CASCADE;
CREATE TABLE consultation_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id),
  predicted_time_mins INTEGER,
  complexity VARCHAR(50),
  triage_priority INTEGER,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS complaints CASCADE;
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID,
  encounter_id UUID REFERENCES encounters(id),
  complaint TEXT
);

DROP TABLE IF EXISTS vitals CASCADE;
CREATE TABLE vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID,
  encounter_id UUID REFERENCES encounters(id),
  bp VARCHAR(20),
  pulse INTEGER,
  temperature NUMERIC
);

DROP TABLE IF EXISTS diagnoses CASCADE;
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID,
  encounter_id UUID REFERENCES encounters(id),
  diagnosis TEXT
);

DROP TABLE IF EXISTS follow_ups CASCADE;
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  scheduled_date DATE,
  status VARCHAR(50) DEFAULT 'Pending'
);

-- ================= APPOINTMENTS & VISITS =================
DROP TABLE IF EXISTS appointments CASCADE;
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES users(id),
  appointment_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS visits CASCADE;
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES users(id),
  visit_type VARCHAR(50),
  visit_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= DOCTOR AVAILABILITY =================
DROP TABLE IF EXISTS doctor_availability CASCADE;
CREATE TABLE doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  recurring_pattern VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(doctor_id, date, start_time)
);

-- ================= ENTERPRISE SCHEDULING =================

DROP TABLE IF EXISTS doctor_schedules CASCADE;
CREATE TABLE doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id),
  weekday INTEGER NOT NULL,
  session_name VARCHAR(100),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration INTEGER DEFAULT 30,
  consultation_type VARCHAR(50) DEFAULT 'OPD',
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS doctor_leaves CASCADE;
CREATE TABLE doctor_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id),
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  is_emergency BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS doctor_overrides CASCADE;
CREATE TABLE doctor_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES users(id),
  override_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- ================= PHARMACY =================
DROP TABLE IF EXISTS drug_brands CASCADE;
CREATE TABLE drug_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_id UUID REFERENCES drug_generics(id),
  brand_name VARCHAR(255)
);

DROP TABLE IF EXISTS pharmacy_batches CASCADE;
CREATE TABLE pharmacy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES drug_brands(id),
  batch_number VARCHAR(100),
  expiry_date DATE,
  quantity INTEGER
);

DROP TABLE IF EXISTS pharmacy_dispenses CASCADE;
CREATE TABLE pharmacy_dispenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id)
);

DROP TABLE IF EXISTS pharmacy_dispense_items CASCADE;
CREATE TABLE pharmacy_dispense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_id UUID REFERENCES pharmacy_dispenses(id),
  medicine_id UUID REFERENCES medicines(id),
  quantity INTEGER
);

DROP TABLE IF EXISTS prescriptions CASCADE;
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES encounters(id),
  patient_id UUID REFERENCES patients(id),
  visit_id UUID REFERENCES visits(id),
  status VARCHAR(50) DEFAULT 'Pending',
  is_paid BOOLEAN DEFAULT false,
  instructions TEXT,
  attachment_url TEXT,
  prescription_url TEXT,
  pdf_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS prescription_items CASCADE;
CREATE TABLE prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id),
  medicine_id UUID REFERENCES medicines(id),
  drug_name VARCHAR(255),
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  instructions TEXT,
  unit_price NUMERIC DEFAULT 0,
  prescription_url TEXT,
  attachment_url TEXT,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= LAB =================
DROP TABLE IF EXISTS lab_orders CASCADE;
CREATE TABLE lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  diagnostic_id UUID REFERENCES diagnostics(id),
  test_name VARCHAR(255),
  doctor_id UUID REFERENCES users(id),
  priority VARCHAR(50) DEFAULT 'Normal',
  status VARCHAR(50) DEFAULT 'Pending',
  results JSONB,
  technician_notes TEXT,
  is_paid BOOLEAN DEFAULT false,
  report_url TEXT,
  attachment_url TEXT,
  pdf_path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS lab_results CASCADE;
CREATE TABLE lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID REFERENCES lab_orders(id),
  result JSONB
);

-- ================= BILLING & INSURANCE =================
DROP TABLE IF EXISTS invoices CASCADE;
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  bill_type VARCHAR(50),
  payment_mode VARCHAR(50),
  subtotal NUMERIC DEFAULT 0,
  tax_total NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Unpaid',
  insurance_claim_amount NUMERIC DEFAULT 0,
  patient_copay_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS invoice_items CASCADE;
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  description VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  source_queue_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  amount NUMERIC,
  payment_mode VARCHAR(50)
);

DROP TABLE IF EXISTS insurance_providers CASCADE;
CREATE TABLE insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  tpa_name VARCHAR(255),
  contact_person VARCHAR(100),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS insurance_claims CASCADE;
CREATE TABLE insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  provider_id UUID,
  policy_number VARCHAR(100),
  insurer_id VARCHAR(100),
  claim_type VARCHAR(50) DEFAULT 'CASHLESS',
  billed_amount NUMERIC DEFAULT 0,
  sanctioned_amount NUMERIC DEFAULT 0,
  reference_number VARCHAR(100),
  claim_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PRE-AUTH PENDING',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS insurance_plans CASCADE;
CREATE TABLE insurance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_coverage NUMERIC DEFAULT 0,
  copay_percent NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS patient_insurance CASCADE;
CREATE TABLE patient_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  plan_id UUID NOT NULL REFERENCES insurance_plans(id),
  policy_number VARCHAR(100),
  total_limit NUMERIC DEFAULT 0,
  remaining_limit NUMERIC DEFAULT 0,
  copay_percent NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  valid_till DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= CLINICAL BILLING LEDGER =================
CREATE TABLE billing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    encounter_id UUID REFERENCES encounters(id),
    source_module VARCHAR(50),
    source_id UUID,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    tax_percent NUMERIC DEFAULT 0,
    is_discountable BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================= DISCHARGE & IPD =================
DROP TABLE IF EXISTS ipd_admissions CASCADE;
CREATE TABLE ipd_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  bed_id UUID REFERENCES beds(id),
  ward_id UUID REFERENCES wards(id),
  encounter_id UUID REFERENCES encounters(id),
  admitting_doctor_id UUID REFERENCES users(id),
  admission_reason TEXT,
  daily_charge NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Admitted',
  admitted_at TIMESTAMP DEFAULT NOW(),
  discharged_at TIMESTAMP,
  pharmacy_cleared BOOLEAN DEFAULT FALSE,
  billing_cleared BOOLEAN DEFAULT FALSE,
  clinical_cleared BOOLEAN DEFAULT FALSE,
  original_admitted_at TIMESTAMP DEFAULT NOW(),
  age_appropriate BOOLEAN DEFAULT true,
  validation_warnings TEXT[] DEFAULT '{}',
  validated_by UUID REFERENCES users(id)
);

DROP TABLE IF EXISTS ipd_notes CASCADE;
CREATE TABLE ipd_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES ipd_admissions(id),
  doctor_id UUID REFERENCES users(id),
  doctor_name VARCHAR(255),
  note_text TEXT NOT NULL,
  note_type VARCHAR(50) DEFAULT 'Progress',
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS discharge_summaries CASCADE;
CREATE TABLE discharge_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID UNIQUE,
  patient_id UUID,
  doctor_id UUID,
  summary_text TEXT,
  pdf_path TEXT,
  discharge_type VARCHAR(50) DEFAULT 'STANDARD',
  status VARCHAR(50) DEFAULT 'Draft',
  is_authenticated BOOLEAN DEFAULT false,
  authenticated_at TIMESTAMP,
  discharge_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS admission_recommendations CASCADE;
CREATE TABLE admission_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= PHARMACY ORDERS (Replenishment) =================
DROP TABLE IF EXISTS pharmacy_orders CASCADE;
CREATE TABLE pharmacy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID,
  medicine_name VARCHAR(255),
  supplier_id UUID,
  supplier_name VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Ordered',
  notes TEXT,
  ordered_by VARCHAR(150),
  ordered_at TIMESTAMP DEFAULT NOW(),
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= TENANT CONFIG =================
DROP TABLE IF EXISTS tenant_sensitive_settings CASCADE;
CREATE TABLE tenant_sensitive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- ================= COMMUNICATIONS & TICKETING =================
DROP TABLE IF EXISTS communications CASCADE;
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  author_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS communication_logs CASCADE;
CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255),
  subject VARCHAR(255),
  type VARCHAR(50),
  status VARCHAR(50),
  channel VARCHAR(20) DEFAULT 'SMS',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= REMINDER TRACKER =================

DROP TABLE IF EXISTS reminder_tracker CASCADE;
CREATE TABLE reminder_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID REFERENCES follow_ups(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_phone VARCHAR(50),
  doctor_phone VARCHAR(50),
  scheduled_date DATE NOT NULL,
  reminder_type VARCHAR(20) NOT NULL DEFAULT 'BOTH',
  channel VARCHAR(20) DEFAULT 'SMS',
  patient_reminder_sent_at TIMESTAMP,
  doctor_reminder_sent_at TIMESTAMP,
  patient_reminder_status VARCHAR(20) DEFAULT 'PENDING',
  doctor_reminder_status VARCHAR(20) DEFAULT 'PENDING',
  patient_response VARCHAR(20) DEFAULT 'PENDING',
  doctor_acknowledged BOOLEAN DEFAULT FALSE,
  follow_up_status VARCHAR(20) DEFAULT 'PENDING',
  follow_up_completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_tracker_doctor ON reminder_tracker (doctor_id);
CREATE INDEX IF NOT EXISTS idx_reminder_tracker_patient ON reminder_tracker (patient_id);
CREATE INDEX IF NOT EXISTS idx_reminder_tracker_date ON reminder_tracker (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_reminder_tracker_status ON reminder_tracker (follow_up_status);

-- ================= BED CATEGORY RATES =================

DROP TABLE IF EXISTS bed_category_rates CASCADE;
CREATE TABLE bed_category_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_type VARCHAR(50) NOT NULL UNIQUE,
  rate_per_hour NUMERIC DEFAULT 0,
  rate_per_day NUMERIC DEFAULT 0,
  min_charge NUMERIC DEFAULT 0,
  partial_day_hours INTEGER DEFAULT 12,
  rate_mode VARCHAR(10) DEFAULT 'DAY',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO bed_category_rates (ward_type, rate_per_hour, rate_per_day, min_charge, partial_day_hours, rate_mode) VALUES
  ('Regular Care',   100,  1500, 500,  12, 'DAY'),
  ('Special Care',   250,  3500, 1000, 12, 'MIXED'),
  ('ICU',            500,  7500, 2000, 12, 'MIXED'),
  ('Emergency',      300,  4500, 1500, 12, 'MIXED'),
  ('Daycare',        80,   1000, 300,  8,  'HOUR')
ON CONFLICT (ward_type) DO NOTHING;

-- ================= ACCOUNTING =================
DROP TABLE IF EXISTS accounts CASCADE;
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  type VARCHAR(50)
);

DROP TABLE IF EXISTS journal_entries CASCADE;
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

DROP TABLE IF EXISTS journal_lines CASCADE;
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID REFERENCES journal_entries(id),
  debit NUMERIC,
  credit NUMERIC
);

-- ================= RECRUITMENT & LEAVE =================
DROP TABLE IF EXISTS resource_requisitions CASCADE;
CREATE TABLE resource_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  number_of_positions INTEGER DEFAULT 1,
  job_description TEXT,
  experience_required VARCHAR(100),
  qualifications_required VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending',
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS candidates CASCADE;
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  experience_years INTEGER DEFAULT 0,
  skills TEXT,
  education TEXT,
  resume_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS requisition_matches CASCADE;
CREATE TABLE requisition_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES resource_requisitions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  match_score NUMERIC DEFAULT 0,
  match_analysis TEXT,
  status VARCHAR(50) DEFAULT 'Matched',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requisition_id, candidate_id)
);

DROP TABLE IF EXISTS employee_leaves CASCADE;
CREATE TABLE employee_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) DEFAULT 'CASUAL',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'Pending',
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================= HIPAA COMPLIANCE AUDIT =================
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  resource_id UUID,
  details TEXT,
  ip_address INET,
  user_agent TEXT,
  risk_level VARCHAR(20) DEFAULT 'LOW',
  pii_accessed VARCHAR(500),
  compliance_violation BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= SEED DATA (PRODUCTION MASTERS) =================
-- 1. Departments
INSERT INTO departments (name, description, hod, specialty, status) VALUES
('General Medicine', 'Primary care and internal medicine', 'Dr. Sankaran R', 'Internal Medicine', 'Active'),
('Cardiology', 'Heart and vascular care', 'Dr. Maheswaran R', 'Cardiologist', 'Active'),
('Pediatrics', 'Child health and development', 'Dr. Aravind Kumar', 'Pediatrician', 'Active'),
('Orthopedics', 'Bone and joint care', 'Dr. Brown', 'Orthopedic Surgeon', 'Active'),
('Emergency & Trauma', '24/7 Critical care', 'Dr. Wilson', 'Emergency Medicine', 'Active'),
('Laboratory', 'Diagnostic testing and pathology', 'Alice LabTech', 'Pathology', 'Active'),
('Pharmacy', 'Medicine dispensing', 'John Pharmacist', 'Pharmacology', 'Active');

-- 2. Specialities
INSERT INTO specialities (name, base_consultation_fee, description) VALUES
('General Physician', 500, 'Primary consultation for all ailments'),
('Senior Cardiologist', 1500, 'Expert cardiac care and consultation'),
('Pediatric Surgeon', 1200, 'Surgical care for children'),
('Orthopedic Consultant', 1000, 'Bone and joint specialist');

-- 3. Wards & Beds (Full Infrastructure)
-- General Ward
INSERT INTO wards (id, name, type, capacity, base_charge, floor) 
VALUES ('11111111-1111-1111-1111-111111111111', 'General Ward - A', 'Regular Care', 20, 1500, '2nd Floor');

INSERT INTO beds (ward_id, bed_number, status)
SELECT '11111111-1111-1111-1111-111111111111', 'GW-A-' || lpad(s::text, 2, '0'), 'Vacant'
FROM generate_series(1, 20) s;

-- ICU
INSERT INTO wards (id, name, type, capacity, base_charge, floor) 
VALUES ('22222222-2222-2222-2222-222222222222', 'Critical Care Unit (ICU)', 'ICU', 10, 7500, '1st Floor');

INSERT INTO beds (ward_id, bed_number, status)
SELECT '22222222-2222-2222-2222-222222222222', 'ICU-' || lpad(s::text, 2, '0'), 'Vacant'
FROM generate_series(1, 10) s;

-- Private
INSERT INTO wards (id, name, type, capacity, base_charge, floor) 
VALUES ('33333333-3333-3333-3333-333333333333', 'Premium Private Wing', 'Special Care', 15, 4500, '3rd Floor');

INSERT INTO beds (ward_id, bed_number, status)
SELECT '33333333-3333-3333-3333-333333333333', 'PVT-' || lpad(s::text, 2, '0'), 'Vacant'
FROM generate_series(1, 15) s;

-- Additional IPD Care Categories
INSERT INTO wards (name, floor, type, capacity, base_charge, min_age, max_age, gender_restriction, age_validation_required) VALUES
('Emergency Triage', 'Ground Floor', 'Emergency', 10, 2500, 0, 120, 'Any', true),
('Critical Care ICU', '1st Floor', 'ICU', 8, 6000, 18, 120, 'Any', true),
('Special Care Wing', '2nd Floor', 'Special Care', 15, 4000, 0, 120, 'Any', true),
('Regular Medical Ward', '3rd Floor', 'Regular Care', 25, 1500, 12, 65, 'Any', false),
('Surgical Recovery', '2nd Floor', 'Regular Care', 20, 1800, 12, 65, 'Any', false),
('Pediatric Daycare', 'Ground Floor', 'Daycare', 10, 900, 0, 12, 'Any', true)
ON CONFLICT DO NOTHING;

-- 4. Services & Masters
INSERT INTO consultation_modes (name, surcharge_percent, is_virtual) VALUES
('In-Person', 0, FALSE),
('Video Call', 10, TRUE),
('Emergency Home Visit', 50, FALSE);

INSERT INTO diagnostics (name, price, category) VALUES 
('Complete Blood Count (CBC)', 450, 'Hematology'),
('Chest X-Ray', 800, 'Radiology'),
('Lipid Profile', 1200, 'Biochemistry'),
('MRI Brain (Plain)', 8500, 'Radiology'),
('ECG (Resting)', 350, 'Cardiology'),
('Blood Sugar (Fasting)', 150, 'Biochemistry');

INSERT INTO treatments (name, price, category, description, estimated_duration) VALUES
('Wound Dressing', 200, 'Minor Procedure', 'Cleaning and dressing of minor wounds', 15),
('Physiotherapy Session', 800, 'Therapy', '30-minute physical therapy session', 30),
('IV Infusion Charge', 1200, 'Nursing', 'Administration of IV fluids', 60);

INSERT INTO medicines (name, category, stock_quantity, unit_price, is_active) VALUES
('Paracetamol 500mg', 'Tablet', 500, 5, true),
('Amoxicillin 250mg', 'Antibiotic', 200, 15, true),
('Insulin Glargine', 'Injectable', 45, 850, true),
('Ibuprofen 400mg', 'NSAID', 350, 8, true),
('Cetirizine 10mg', 'Antihistamine', 150, 4, true),
('Pantoprazole 40mg', 'Antacid', 400, 12, true);

-- RBAC BOOTSTRAP SEEDING - HIPAA Compliant Roles
INSERT INTO rbac_roles (name, description) VALUES 
('ADMIN', 'Full system access with PII masking for audit purposes'),
('DOCTOR', 'Clinical access to full patient information for treatment'),
('NURSE', 'Clinical access to patient information for care delivery'),
('PHARMACIST', 'Access to pharmacy functions with masked patient PII'),
('LAB_ASSISTANT', 'Access to laboratory functions with masked patient PII'),
('RECEPTIONIST', 'Front desk access with limited patient PII'),
('SUPPORT', 'Administrative support with masked patient PII');

-- Menu Registry with Subscription Mapping (Revised 4-Tier Model)
INSERT INTO rbac_menus (label, path, icon, sort_order, required_plan) VALUES
('Dashboard', '/tenant/dashboard', 'Dashboard', 1, 'basic'),
('OPD Registration', '/tenant/opd/registration', 'OPD', 2, 'basic'),
('Doctor''s Queue', '/tenant/opd/queue', 'Doctor', 3, 'basic'),
('Laboratory', '/tenant/lab', 'Lab', 4, 'standard'),
('Pharmacy Dashboard', '/tenant/pharmacy/dashboard', 'Pharmacy', 5, 'standard'),
('Stock Inventory', '/tenant/pharmacy/inventory', 'Pill', 6, 'standard'),
('Prescription Queue', '/tenant/pharmacy/queue', 'Receipt', 7, 'standard'),
('Admission Desk', '/tenant/ipd/admission-desk', 'Bed', 7, 'professional'),
('IPD Bed Map', '/tenant/ipd/beds', 'Bed', 8, 'professional'),
('IPD Census & Daycare', '/tenant/ipd/admissions', 'Clipboard', 9, 'professional'),
('Invoicing & Billing', '/billing', 'Billing', 10, 'basic'),
('Hospital Settings (Masters)', '/tenant/masters', 'Settings', 11, 'standard'),
('Branding & UI Settings', '/tenant/settings', 'Dashboard', 12, 'basic'),
('Staff & RBAC', '/tenant/staff', 'Doctor', 13, 'basic'),
('Discharge Summaries', '/tenant/ipd/discharge', 'Receipt', 15, 'professional'),
('Ticketing Management System', '/tenant/support', 'Receipt', 16, 'basic'),
('Message Board', '/tenant/communication', 'Dashboard', 17, 'basic');

-- Role-Menu Mappings (ADMIN - ALL)
INSERT INTO rbac_role_menus (role_id, menu_id)
SELECT r.id, m.id FROM rbac_roles r, rbac_menus m WHERE r.name = 'ADMIN';

-- Role-Menu Mappings (DOCTOR)
INSERT INTO rbac_role_menus (role_id, menu_id)
SELECT r.id, m.id FROM rbac_roles r, rbac_menus m 
WHERE r.name = 'DOCTOR' AND m.label IN ('Dashboard', 'Doctor''s Queue', 'Laboratory', 'IPD Census', 'Bed Map');

-- Role-Menu Mappings (PHARMACIST)
INSERT INTO rbac_role_menus (role_id, menu_id)
SELECT r.id, m.id FROM rbac_roles r, rbac_menus m 
WHERE r.name = 'PHARMACIST' AND m.label IN ('Dashboard', 'Pharmacy Dashboard', 'Stock Inventory', 'Prescription Queue');

-- Role-Menu Mappings (LAB_ASSISTANT)
INSERT INTO rbac_role_menus (role_id, menu_id)
SELECT r.id, m.id FROM rbac_roles r, rbac_menus m 
WHERE r.name = 'LAB_ASSISTANT' AND m.label IN ('Dashboard', 'Laboratory');

-- Role-Menu Mappings (SUPPORT)
INSERT INTO rbac_role_menus (role_id, menu_id)
SELECT r.id, m.id FROM rbac_roles r, rbac_menus m 
WHERE r.name = 'SUPPORT' AND m.label IN ('Dashboard', 'OPD Registration', 'Invoicing & Billing');

-- HIPAA Compliant Permissions Registry
INSERT INTO rbac_permissions (key, description) VALUES
('PATIENT_PII_VIEW_FULL', 'Ability to view complete unmasked patient information'),
('PATIENT_PII_VIEW_MASKED', 'Ability to view masked patient information (limited PII)'),
('PATIENT_PII_VIEW_DEIDENTIFIED', 'Ability to view de-identified patient information only'),
('CLINICAL_ACCESS_FULL', 'Full clinical access including diagnosis, prescriptions, vitals'),
('CLINICAL_ACCESS_LIMITED', 'Limited clinical access with PII masking'),
('PHARMACY_ACCESS_FULL', 'Full pharmacy access including patient PII'),
('PHARMACY_ACCESS_MASKED', 'Pharmacy access with masked patient PII'),
('LAB_ACCESS_FULL', 'Full laboratory access including patient PII'),
('LAB_ACCESS_MASKED', 'Laboratory access with masked patient PII'),
('FRONT_DESK_ACCESS_FULL', 'Full front desk access including patient PII'),
('FRONT_DESK_ACCESS_MASKED', 'Front desk access with masked patient PII'),
('USER_MANAGE', 'Ability to manage user accounts and roles'),
('ROLE_MANAGE', 'Ability to manage role assignments and permissions'),
('SYSTEM_CONFIG', 'Ability to modify system settings and configurations'),
('AUDIT_VIEW', 'Ability to view audit logs and compliance reports'),
('DATA_EXPORT', 'Ability to export system data (with compliance checks)'),
('BILLING_ACCESS_FULL', 'Full access to billing and financial information'),
('BILLING_ACCESS_MASKED', 'Limited billing access with PII masking'),
('IPD_MANAGE', 'Ability to manage IPD admissions and bed assignments'),
('EMERGENCY_OVERRIDE', 'Ability to override access controls in emergency situations'),
('LAB_MANAGE', 'Ability to manage laboratory operations'),
('PHARMACY_MANAGE', 'Ability to manage pharmacy operations'),
('MASTERS_MANAGE', 'Ability to manage master data settings'),
('BILLING_MANAGE', 'Ability to manage billing operations');

-- Assign Permissions to ADMIN (ALL)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'ADMIN';

-- Assign Permissions to DOCTOR (Full Clinical Access)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'DOCTOR' AND p.key IN ('CLINICAL_ACCESS_FULL', 'PATIENT_PII_VIEW_FULL', 'LAB_MANAGE', 'PHARMACY_MANAGE', 'IPD_MANAGE')
ON CONFLICT DO NOTHING;

-- Assign Permissions to NURSE (Clinical Access with PII)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'NURSE' AND p.key IN ('CLINICAL_ACCESS_FULL', 'PATIENT_PII_VIEW_FULL', 'IPD_MANAGE')
ON CONFLICT DO NOTHING;

-- Assign Permissions to PHARMACIST (Pharmacy with PII)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'PHARMACIST' AND p.key IN ('PHARMACY_ACCESS_FULL', 'PATIENT_PII_VIEW_FULL', 'BILLING_ACCESS_FULL')
ON CONFLICT DO NOTHING;

-- Assign Permissions to LAB_ASSISTANT (Lab with PII)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'LAB_ASSISTANT' AND p.key IN ('LAB_ACCESS_FULL', 'PATIENT_PII_VIEW_FULL', 'BILLING_ACCESS_FULL')
ON CONFLICT DO NOTHING;

-- Assign Permissions to RECEPTIONIST (Front Desk with Limited PII)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'RECEPTIONIST' AND p.key IN ('FRONT_DESK_ACCESS_MASKED', 'PATIENT_PII_VIEW_MASKED', 'BILLING_ACCESS_MASKED')
ON CONFLICT DO NOTHING;

-- Assign Permissions to SUPPORT (Admin with Masked PII)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM rbac_roles r, rbac_permissions p 
WHERE r.name = 'SUPPORT' AND p.key IN ('USER_MANAGE', 'ROLE_MANAGE', 'SYSTEM_CONFIG', 'AUDIT_VIEW', 'PATIENT_PII_VIEW_MASKED', 'MASTERS_MANAGE', 'BILLING_MANAGE')
ON CONFLICT DO NOTHING;

-- ================= AUTOMATION & TRIGGERS =================

-- 1. Automated Age Calculation Trigger
CREATE OR REPLACE FUNCTION calculate_age_from_dob()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.dob IS NOT NULL THEN
        NEW.age := EXTRACT(YEAR FROM AGE(NEW.dob));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_user_age ON users;
CREATE TRIGGER trg_calculate_user_age
BEFORE INSERT OR UPDATE OF dob ON users
FOR EACH ROW EXECUTE FUNCTION calculate_age_from_dob();

DROP TRIGGER IF EXISTS trg_calculate_patient_age ON patients;
CREATE TRIGGER trg_calculate_patient_age
BEFORE INSERT OR UPDATE OF dob ON patients
FOR EACH ROW EXECUTE FUNCTION calculate_age_from_dob();

-- 2. Automated Updated At Trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_patients_modtime ON patients;
CREATE TRIGGER update_patients_modtime BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_encounters_modtime ON encounters;
CREATE TRIGGER update_encounters_modtime BEFORE UPDATE ON encounters FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================================
-- PERFORMANCE INDEXES - Patient Journey OPD & IPD Flows
-- =============================================================

-- patients: free-text search & lookup
CREATE INDEX IF NOT EXISTS idx_patients_name    ON patients (name);
CREATE INDEX IF NOT EXISTS idx_patients_phone   ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_patients_mrn     ON patients (mrn);

-- appointments: lookup by patient / doctor / time
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id  ON appointments (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time       ON appointments (appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON appointments (status);

-- encounters: OPD consult list & recent-visit queries
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id   ON encounters (patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_doctor_id    ON encounters (doctor_id);
CREATE INDEX IF NOT EXISTS idx_encounters_created_at   ON encounters (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_status       ON encounters (status);

-- consultation_events: join on encounter
CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_id ON consultation_events (encounter_id);
CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_created_at ON consultation_events (encounter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_events_encounter_event_created_at ON consultation_events (encounter_id, event_type, created_at DESC);

-- predictions lookup by encounter
CREATE INDEX IF NOT EXISTS idx_consultation_predictions_encounter ON consultation_predictions (encounter_id);

-- prescriptions & items
CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter_id       ON prescriptions (encounter_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id         ON prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription  ON prescription_items (prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status             ON prescriptions (status);

-- lab orders
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id   ON lab_orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_encounter_id ON lab_orders (encounter_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status       ON lab_orders (status);

-- billing
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id     ON invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_encounter_id   ON invoices (encounter_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice   ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_patient   ON billing_queue (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_encounter ON billing_queue (encounter_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_status    ON billing_queue (status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_source_id ON billing_queue (source_id);

-- IPD admissions
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_patient  ON ipd_admissions (patient_id);
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_bed      ON ipd_admissions (bed_id);
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_ward     ON ipd_admissions (ward_id);
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_status   ON ipd_admissions (status);
CREATE INDEX IF NOT EXISTS idx_ipd_notes_admission     ON ipd_notes (admission_id);
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_admitted_at ON ipd_admissions (admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ipd_notes_admission_created_at ON ipd_notes (admission_id, created_at DESC);

-- beds
CREATE INDEX IF NOT EXISTS idx_beds_ward_id            ON beds (ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_status             ON beds (status);

-- insurance
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON insurance_claims (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient ON patient_insurance (patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_provider  ON insurance_plans (provider_id);

-- doctor schedules
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor  ON doctor_schedules (doctor_id);

-- doctor availability & overrides
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor ON doctor_availability (doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_date   ON doctor_availability (date);
CREATE INDEX IF NOT EXISTS idx_doctor_leaves_doctor       ON doctor_leaves (doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_overrides_doctor    ON doctor_overrides (doctor_id);

-- pharmacy
CREATE INDEX IF NOT EXISTS idx_pharmacy_inwards_medicine  ON pharmacy_inwards (medicine_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inwards_supplier  ON pharmacy_inwards (supplier_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status     ON pharmacy_orders (status);

-- recruitment & leave
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON resource_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisition_matches_score ON requisition_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_emp ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status ON employee_leaves(status);

-- discharge summaries
CREATE INDEX IF NOT EXISTS idx_discharge_summaries_admission ON discharge_summaries (admission_id);
CREATE INDEX IF NOT EXISTS idx_discharge_summaries_status    ON discharge_summaries (status);

-- audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_user     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);

-- admission recommendations
CREATE INDEX IF NOT EXISTS idx_admission_recommendations_status ON admission_recommendations (status);
