create or replace function public.jwt_claim_text(claim text)
returns text language sql stable as $$
  select coalesce((auth.jwt() ->> claim), '');
$$;

create or replace function public.jwt_claim_uuid(claim text)
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> claim, '')::uuid;
$$;

create or replace function public.is_intervenant_portal()
returns boolean language sql stable as $$
  select (auth.jwt() ->> 'access_role') = 'INTERVENANT';
$$;
