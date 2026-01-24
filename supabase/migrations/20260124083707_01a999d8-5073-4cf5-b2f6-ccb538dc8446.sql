-- Add client_id column to clients table
ALTER TABLE public.clients ADD COLUMN client_id TEXT;

-- Create unique index on client_id (allowing nulls for existing records)
CREATE UNIQUE INDEX idx_clients_client_id ON public.clients(client_id) WHERE client_id IS NOT NULL;