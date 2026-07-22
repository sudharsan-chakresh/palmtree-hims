CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR,
  db_name VARCHAR,
  plan VARCHAR,
  default_pwd VARCHAR,
  -- Branding Overrides (Nexus Controlled)
  primary_dark VARCHAR(50),
  primary_accent VARCHAR(50),
  app_bg VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tenant_admin_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  address VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255), -- References tenants(id)
  subject VARCHAR(255),
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(20) DEFAULT 'Open',
  message TEXT,
  response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
