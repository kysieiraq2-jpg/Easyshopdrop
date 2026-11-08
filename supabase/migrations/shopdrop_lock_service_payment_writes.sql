
-- Shop&Drop: Restrict direct service payment writes.
-- Preserve authenticated SELECT access.
-- Preserve backend SECURITY DEFINER functions.
-- No live payment activation.

DO $shopdrop$
BEGIN
  -- Direct payment and booking changes must
  -- go through authorized backend functions.
  REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.service_payments
  FROM authenticated, anon, PUBLIC;

  REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.service_bookings
  FROM authenticated, anon, PUBLIC;

  -- Preserve backend processing.
  GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.service_payments
  TO service_role;

  GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.service_bookings
  TO service_role;

  -- Keep row-level security enabled.
  ALTER TABLE public.service_payments
    ENABLE ROW LEVEL SECURITY;

  ALTER TABLE public.service_bookings
    ENABLE ROW LEVEL SECURITY;
END;
$shopdrop$;

