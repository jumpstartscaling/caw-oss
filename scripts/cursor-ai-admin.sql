-- Creates a role 'cursor_ai' with full DDL/DML on the public schema
-- Run as superuser (postgres) or owner of the database.
-- Set a strong password and store in .env or a secrets manager.

CREATE ROLE cursor_ai WITH LOGIN PASSWORD 'CHANGE_ME';

-- Full access to public schema
GRANT ALL PRIVILEGES ON SCHEMA public TO cursor_ai;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cursor_ai;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cursor_ai;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO cursor_ai;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cursor_ai;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cursor_ai;
