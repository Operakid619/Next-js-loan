alter table public.borrowers
  add column if not exists guarantor_occupation text,
  add column if not exists borrower_id_name text,
  add column if not exists borrower_id_image_path text,
  add column if not exists guarantor_id_name text,
  add column if not exists guarantor_id_image_path text;

insert into storage.buckets (id, name, public)
values ('borrower-documents', 'borrower-documents', false)
on conflict (id) do nothing;
