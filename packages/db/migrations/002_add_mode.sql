-- Add mode column to jobs table for test/real mode distinction
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'test';
