DO $$
BEGIN
  IF to_regclass('public.company_settings') IS NOT NULL THEN
    ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS default_payment_terms text,
    ADD COLUMN IF NOT EXISTS default_legal_mentions text,
    ADD COLUMN IF NOT EXISTS default_waste_management text;
  END IF;
END $$;
