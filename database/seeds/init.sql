-- Example seed: insert initial data
INSERT INTO users (id, phone_number, name, email) VALUES (gen_random_uuid(), '5511999999999', 'Admin', 'admin@exemplo.com');
INSERT INTO products (id, name, category, price) VALUES (gen_random_uuid(), 'Produto Exemplo', 'Categoria', 99.99);
