-- Fix 199I-D2: preserve permanent advertiser numbers while keeping profile editing.
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, full_name, country_code, mobile_number, whatsapp_number, created_at, updated_at, seller_public_alias) ON public.profiles TO authenticated;
GRANT UPDATE (id, full_name, country_code, mobile_number, whatsapp_number, created_at, updated_at, seller_public_alias) ON public.profiles TO authenticated;
REVOKE INSERT (advertiser_public_number), UPDATE (advertiser_public_number) ON public.profiles FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX shopdrop_profiles_advertiser_public_number_199id2 ON public.profiles (advertiser_public_number);
