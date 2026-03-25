create table if not exists public.borrowers (
  id uuid primary key references auth.users (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text not null,
  occupation text,
  guarantor_name text,
  phone_number text not null,
  guarantor_phone_number text,
  address text,
  passport_path text,
  marital_status text not null
    check (marital_status in ('single', 'married', 'divorced', 'widowed', 'separated')),
  must_change_password boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists borrowers_email_lower_key
on public.borrowers (lower(email));

create unique index if not exists borrowers_phone_number_key
on public.borrowers (phone_number);

drop trigger if exists set_borrowers_updated_at on public.borrowers;
create trigger set_borrowers_updated_at
  before update on public.borrowers
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.borrowers enable row level security;

drop policy if exists "Admins can view all borrowers" on public.borrowers;
create policy "Admins can view all borrowers"
on public.borrowers
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can create borrowers" on public.borrowers;
create policy "Admins can create borrowers"
on public.borrowers
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update borrowers" on public.borrowers;
create policy "Admins can update borrowers"
on public.borrowers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete borrowers" on public.borrowers;
create policy "Admins can delete borrowers"
on public.borrowers
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Borrowers can view their own record" on public.borrowers;
create policy "Borrowers can view their own record"
on public.borrowers
for select
to authenticated
using ((select auth.uid()) = id);
