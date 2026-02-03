insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  'corentin.cbrenovation@gmail.com',
  crypt('Batipro56920@', gen_salt('bf')),
  now(),
  now(),
  now()
);
