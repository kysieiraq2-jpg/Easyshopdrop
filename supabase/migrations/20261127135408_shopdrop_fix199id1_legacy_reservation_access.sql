-- Fix 199I-D1: retire direct customer access to obsolete reservation mutators.
-- Retain the existing functions and backend grants; current checkout, payment and expiry functions are unchanged.
REVOKE EXECUTE ON FUNCTION public.reserve_product_inventory(uuid,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_inventory_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_product_inventory(uuid,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_inventory_reservation(uuid) TO service_role;
