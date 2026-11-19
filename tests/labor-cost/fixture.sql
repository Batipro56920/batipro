create role anon;
create role authenticated;
create table public.intervenants (
 id uuid primary key, status text not null,
 hourly_cost_ht numeric, daily_rate_ht numeric
);
create table public.chantier_budget_settings (
 chantier_id uuid primary key, taux_horaire_mo_ht numeric not null
);
create table public.chantier_time_entries (
 id uuid primary key default gen_random_uuid(),
 chantier_id uuid not null, intervenant_id uuid not null,
 work_date date not null, duration_hours numeric,
 note text
);
insert into public.intervenants(id,status,hourly_cost_ht,daily_rate_ht) values
 ('00000000-0000-0000-0000-000000000001','employee',24.92,null),
 ('00000000-0000-0000-0000-000000000002','subcontractor',null,245),
 ('00000000-0000-0000-0000-000000000003','employee',null,null);
insert into public.chantier_budget_settings(chantier_id,taux_horaire_mo_ht)
 values ('00000000-0000-0000-0000-000000000011',48);
-- Existing records are deliberately not backfilled with a guessed historical rate.
insert into public.chantier_time_entries(chantier_id,intervenant_id,work_date,duration_hours)
 values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','2026-10-01',5);
