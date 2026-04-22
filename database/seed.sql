-- ============================================
-- SEED DATA
-- Only the default admin user is created here.
-- All other users (managers, teachers, students)
-- must be created through the application.
-- ============================================

-- ============================================
-- ADMIN PASSWORD HASH
-- ============================================

-- Requires pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set password for the default admin account (created in schema.sql)
UPDATE users
SET password_hash = crypt('Admin@123', gen_salt('bf', 12))
WHERE role = 'admin';

/*
DEFAULT ADMIN ACCOUNT:
  Email:    admin@education.com
  Password: Admin@123

All other schools, branches, managers, teachers, and students
must be created through the Admin portal.
Change the admin password after first login.
*/
