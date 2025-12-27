-- Add RLS policy for rate limits table (internal use only via SECURITY DEFINER functions)
-- No direct user access needed - table is managed only by check_rate_limit and cleanup_rate_limits functions
CREATE POLICY "No direct access to rate limits"
ON public.rpc_rate_limits
FOR ALL
USING (false);