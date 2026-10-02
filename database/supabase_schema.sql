-- Shared Supabase registry schema. Safe to run repeatedly.
-- Tenant clinical tables are provisioned separately in each tenant schema.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS nexus;

CREATE TABLE IF NOT EXISTS nexus.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  db_name VARCHAR(255),
  plan VARCHAR(50),
  default_pwd VARCHAR,
  primary_dark VARCHAR(50),
  primary_accent VARCHAR(50),
  app_bg VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  code VARCHAR(255),
  domain VARCHAR(255),
  shard_id VARCHAR(255),
  admin_email VARCHAR(255),
  background_color VARCHAR(50) DEFAULT '#ffffff',
  text_color VARCHAR(50) DEFAULT '#1e293b',
  hero_background_color VARCHAR(50) DEFAULT '#f8fafc',
  overall_text_color VARCHAR(50) DEFAULT '#475569',
  ui_settings JSONB DEFAULT '{}'::jsonb,
  sensitive_settings JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS code VARCHAR(255);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS shard_id VARCHAR(255);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS primary_dark VARCHAR(50);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS primary_accent VARCHAR(50);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS app_bg VARCHAR(50);
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS background_color VARCHAR(50) DEFAULT '#ffffff';
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS text_color VARCHAR(50) DEFAULT '#1e293b';
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS hero_background_color VARCHAR(50) DEFAULT '#f8fafc';
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS overall_text_color VARCHAR(50) DEFAULT '#475569';
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS ui_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE nexus.tenants ADD COLUMN IF NOT EXISTS sensitive_settings JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nexus_tenants_name_unique
  ON nexus.tenants (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nexus_tenants_db_name_unique
  ON nexus.tenants (db_name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'nexus.tenants'::regclass
      AND conname = 'tenants_domain_key'
  ) THEN
    ALTER TABLE nexus.tenants
      ADD CONSTRAINT tenants_domain_key UNIQUE (domain);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS nexus.tenant_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES nexus.tenants(id),
  contact_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  address VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nexus.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255),
  subject VARCHAR(255),
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(20) DEFAULT 'Open',
  message TEXT,
  response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE nexus.support_tickets ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE nexus.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS nexus.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255),
  subject VARCHAR(255),
  recipient VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nexus.utilization_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255),
  db_size_mb DECIMAL(10, 2),
  total_records INT,
  active_users INT,
  created_at TIMESTAMP DEFAULT NOW()
);