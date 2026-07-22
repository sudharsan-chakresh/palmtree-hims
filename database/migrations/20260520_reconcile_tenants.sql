-- Reconcile missing tables, functions, and triggers in tenant schemas
-- Use {schema} placeholder; runner replaces with actual schema name
SET search_path = {schema};

-- Ensure suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure medicines table (minimal columns used by pharmacy_inwards FK)
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255)
);

-- Ensure pharmacy_inwards
CREATE TABLE IF NOT EXISTS pharmacy_inwards (
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

-- Ensure doctor_availability
CREATE TABLE IF NOT EXISTS doctor_availability (
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

-- Ensure audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- Ensure functions
CREATE OR REPLACE FUNCTION calculate_age_from_dob()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.dob IS NOT NULL THEN
        NEW.age := EXTRACT(YEAR FROM AGE(NEW.dob));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'users') THEN
    PERFORM pg_catalog.set_config('search_path', current_schema(), true);
    EXECUTE 'DROP TRIGGER IF EXISTS trg_calculate_user_age ON ' || quote_ident(current_schema()) || '.users';
    EXECUTE 'CREATE TRIGGER trg_calculate_user_age BEFORE INSERT OR UPDATE OF dob ON ' || quote_ident(current_schema()) || '.users FOR EACH ROW EXECUTE FUNCTION calculate_age_from_dob()';
    EXECUTE 'DROP TRIGGER IF EXISTS update_users_modtime ON ' || quote_ident(current_schema()) || '.users';
    EXECUTE 'CREATE TRIGGER update_users_modtime BEFORE UPDATE ON ' || quote_ident(current_schema()) || '.users FOR EACH ROW EXECUTE FUNCTION update_modified_column()';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'patients') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_calculate_patient_age ON ' || quote_ident(current_schema()) || '.patients';
    EXECUTE 'CREATE TRIGGER trg_calculate_patient_age BEFORE INSERT OR UPDATE OF dob ON ' || quote_ident(current_schema()) || '.patients FOR EACH ROW EXECUTE FUNCTION calculate_age_from_dob()';
    EXECUTE 'DROP TRIGGER IF EXISTS update_patients_modtime ON ' || quote_ident(current_schema()) || '.patients';
    EXECUTE 'CREATE TRIGGER update_patients_modtime BEFORE UPDATE ON ' || quote_ident(current_schema()) || '.patients FOR EACH ROW EXECUTE FUNCTION update_modified_column()';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'encounters') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_encounters_modtime ON ' || quote_ident(current_schema()) || '.encounters';
    EXECUTE 'CREATE TRIGGER update_encounters_modtime BEFORE UPDATE ON ' || quote_ident(current_schema()) || '.encounters FOR EACH ROW EXECUTE FUNCTION update_modified_column()';
  END IF;
END$$;
