-- Migration: Add canvas_fields column to company_settings
-- This migration adds support for global field configuration

-- Check if column exists (PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'company_settings'
        AND column_name = 'canvas_fields'
    ) THEN
        ALTER TABLE company_settings ADD COLUMN canvas_fields TEXT;
    END IF;
END $$;
