CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR,
  phone VARCHAR
);

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT,
  author_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE communication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient VARCHAR(255),
  subject VARCHAR(255),
  type VARCHAR(50), -- EMAIL, SMS, SIGNAL
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
