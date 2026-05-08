-- ============================================
-- SEED DATA
-- ============================================
-- The database starts empty.
-- The sole admin account is created automatically at application
-- startup using the ADMIN_EMAIL and ADMIN_PASSWORD env vars.
-- All other users (managers, teachers, students) must be created
-- through the Admin portal once the admin has logged in.
-- ============================================

-- Ensure no leftover non-admin data from any previous seed runs.
DELETE FROM enrollments;
DELETE FROM video_templates;
DELETE FROM topics;
DELETE FROM class_subjects;
DELETE FROM subjects;
DELETE FROM classes;
DELETE FROM branches;
DELETE FROM schools;
DELETE FROM users;
