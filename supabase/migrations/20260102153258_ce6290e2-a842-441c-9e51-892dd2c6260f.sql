-- Step 1: Add new enum values (must be committed before use)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'line_manager';