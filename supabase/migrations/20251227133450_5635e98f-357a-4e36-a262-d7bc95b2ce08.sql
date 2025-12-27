-- Fix 1: Make documents bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';

-- Fix 2: Add rate limiting for email enumeration protection
-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  identifier text PRIMARY KEY,
  call_count int DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

-- Enable RLS on rate limits table (internal table, no user access)
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  func_name text,
  identifier text,
  max_calls int,
  window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
  current_window_start timestamptz;
BEGIN
  -- Get or create rate limit record
  SELECT call_count, rpc_rate_limits.window_start 
  INTO current_count, current_window_start
  FROM public.rpc_rate_limits
  WHERE rpc_rate_limits.identifier = check_rate_limit.identifier;
  
  -- Reset if window expired or no record exists
  IF current_window_start IS NULL OR current_window_start < now() - (window_seconds || ' seconds')::interval THEN
    INSERT INTO public.rpc_rate_limits (identifier, call_count, window_start)
    VALUES (check_rate_limit.identifier, 1, now())
    ON CONFLICT (identifier) DO UPDATE
    SET call_count = 1, window_start = now();
    RETURN true;
  END IF;
  
  -- Check limit
  IF current_count >= max_calls THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  UPDATE public.rpc_rate_limits
  SET call_count = call_count + 1
  WHERE rpc_rate_limits.identifier = check_rate_limit.identifier;
  
  RETURN true;
END;
$$;

-- Update verify_signup_email with rate limiting and normalized responses
CREATE OR REPLACE FUNCTION public.verify_signup_email(check_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  signup_record record;
  client_ip text;
BEGIN
  -- Get client IP for rate limiting
  client_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  );
  
  -- Rate limit: 10 calls per 5 minutes per IP
  IF NOT check_rate_limit('verify_signup_email', client_ip, 10, 300) THEN
    -- Return same response as invalid to prevent enumeration
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid'
    );
  END IF;
  
  SELECT email, is_used, employee_id 
  INTO signup_record
  FROM public.allowed_signups 
  WHERE email = lower(check_email);
  
  -- Normalize error responses to prevent enumeration
  IF signup_record IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid'
    );
  END IF;
  
  IF signup_record.is_used THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid'
    );
  END IF;
  
  -- If valid, return success with employee_id for fetching details
  RETURN jsonb_build_object(
    'allowed', true,
    'employee_id', signup_record.employee_id
  );
END;
$$;

-- Create cleanup function for old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rpc_rate_limits 
  WHERE window_start < now() - interval '1 hour';
END;
$$;