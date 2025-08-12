-- Example migration: create tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(100),
  cpf VARCHAR(20),
  address JSON,
  preferences JSON,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock INT DEFAULT 0,
  images TEXT[],
  specifications JSON,
  is_active BOOLEAN DEFAULT TRUE,
  min_quantity INT DEFAULT 1
);
-- Add more tables as needed
