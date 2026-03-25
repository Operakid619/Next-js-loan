alter table public.borrowers
  add column if not exists passport_path text,
  add column if not exists guarantor_passport_path text;
